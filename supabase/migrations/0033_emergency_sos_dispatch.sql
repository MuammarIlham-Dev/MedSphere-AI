-- Migration 0033: Emergency SOS dispatch, responder acknowledgement and secure realtime
-- Database remains authoritative. Clients cannot directly mutate emergency/ambulance state.

create type emergency_dispatch_status as enum (
  'offered', 'accepted', 'declined', 'cancelled', 'completed'
);

alter table public.emergencies
  add column if not exists city text,
  add column if not exists updated_at timestamptz not null default now();

-- Existing trigger helper is already present from the core schema.
select public.apply_updated_at('public.emergencies');

create index if not exists emergencies_status_city_idx
  on public.emergencies(status, city, created_at desc);

create table if not exists public.emergency_dispatches (
  id uuid primary key default gen_random_uuid(),
  emergency_id uuid not null references public.emergencies(id) on delete cascade,
  ambulance_id uuid not null references public.ambulances(id),
  operator_id uuid not null references public.profiles(id),
  driver_id uuid not null references public.profiles(id),
  status emergency_dispatch_status not null default 'offered',
  distance_km numeric(8,2),
  offered_at timestamptz not null default now(),
  responded_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists emergency_dispatch_one_active_per_emergency
  on public.emergency_dispatches(emergency_id)
  where status in ('offered','accepted');

create unique index if not exists emergency_dispatch_one_active_per_ambulance
  on public.emergency_dispatches(ambulance_id)
  where status in ('offered','accepted');

create index if not exists emergency_dispatch_driver_status_idx
  on public.emergency_dispatches(driver_id, status, offered_at desc);

create index if not exists emergency_dispatch_emergency_idx
  on public.emergency_dispatches(emergency_id, created_at desc);

alter table public.emergency_dispatches enable row level security;

-- Lock down legacy direct writes: all state transitions must use the RPCs below.
drop policy if exists emergencies_insert on public.emergencies;
drop policy if exists emergencies_update on public.emergencies;
drop policy if exists ambulances_write on public.ambulances;

drop policy if exists ambulances_read on public.ambulances;
create policy ambulances_read on public.ambulances
for select using (
  driver_id = auth.uid()
  or public.is_admin()
  or hospital_id in (select id from public.hospitals where owner_id = auth.uid())
);

-- Validate and persist the caller's own SOS. City is sourced from the caller profile;
-- the client-supplied city is only a compatibility hint and is never trusted.
create or replace function public.trigger_emergency_sos(
  p_lat double precision,
  p_lng double precision,
  p_type text default 'medical',
  p_address text default null,
  p_city text default null
) returns public.emergencies
language plpgsql security definer set search_path = public as $$
declare
  result public.emergencies;
  reporter_city text;
  normalized_type text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_lat is null or p_lat < -90 or p_lat > 90
     or p_lng is null or p_lng < -180 or p_lng > 180 then
    raise exception 'Invalid emergency coordinates';
  end if;

  normalized_type := lower(trim(coalesce(p_type, 'medical')));
  if normalized_type not in ('medical','accident','fire','police','other') then
    normalized_type := 'medical';
  end if;

  select city into reporter_city
  from public.profiles
  where id = auth.uid();

  perform pg_advisory_xact_lock(hashtextextended('sos_' || auth.uid()::text, 0));

  select * into result
  from public.emergencies
  where reporter_id = auth.uid()
    and status in ('active','dispatched','on_scene','transporting','arrived')
  order by created_at desc
  limit 1;

  if found then
    return result;
  end if;

  insert into public.emergencies (
    reporter_id, type, status, lat, lng, address, city, log
  ) values (
    auth.uid(),
    normalized_type,
    'active',
    p_lat,
    p_lng,
    nullif(left(trim(coalesce(p_address,'')), 500), ''),
    nullif(trim(coalesce(reporter_city, nullif(p_city, ''))), ''),
    jsonb_build_array(jsonb_build_object(
      'at', now(),
      'event', 'sos_created',
      'by', auth.uid()
    ))
  )
  returning * into result;

  if result.id is null then
    raise exception 'Failed to create emergency SOS';
  end if;

  return result;
end;
$$;

-- Preserve the existing four-argument RPC signature for older clients.
create or replace function public.trigger_emergency_sos(
  p_lat double precision,
  p_lng double precision,
  p_type text default 'medical',
  p_address text default null
) returns public.emergencies
language sql security definer set search_path = public as $$
  select public.trigger_emergency_sos(p_lat, p_lng, p_type, p_address, null);
$$;

revoke all on function public.trigger_emergency_sos(double precision,double precision,text,text) from public;
revoke all on function public.trigger_emergency_sos(double precision,double precision,text,text,text) from public;
grant execute on function public.trigger_emergency_sos(double precision,double precision,text,text) to authenticated;
grant execute on function public.trigger_emergency_sos(double precision,double precision,text,text,text) to authenticated;

-- Top nearby, currently-available ambulances for an operator.
create or replace function public.get_emergency_dispatch_candidates(
  p_emergency_id uuid,
  p_limit int default 8
) returns table (
  ambulance_id uuid,
  driver_id uuid,
  hospital_id uuid,
  hospital_name text,
  hospital_city text,
  vehicle_no text,
  ambulance_type text,
  equipment text[],
  status ambulance_status,
  current_lat double precision,
  current_lng double precision,
  location_updated_at timestamptz,
  distance_km numeric
)
language plpgsql security definer set search_path = public as $$
declare
  e public.emergencies;
  caller_city text;
begin
  if public.current_role() not in ('emergency_operator','admin','super_admin') then
    raise exception 'Unauthorized emergency dispatch access';
  end if;

  select * into e from public.emergencies where id = p_emergency_id;
  if not found then raise exception 'Emergency not found'; end if;

  select city into caller_city from public.profiles where id = auth.uid();

  if public.current_role() = 'emergency_operator'
     and caller_city is not null
     and e.city is not null
     and caller_city <> e.city then
    raise exception 'Emergency is outside your dispatch region';
  end if;

  if e.status not in ('active','dispatched','on_scene','transporting') then
    raise exception 'Emergency is no longer dispatchable';
  end if;

  return query
  select
    a.id,
    a.driver_id,
    a.hospital_id,
    h.name,
    h.city,
    a.vehicle_no,
    a.type,
    a.equipment,
    a.status,
    a.current_lat,
    a.current_lng,
    a.updated_at,
    case
      when coalesce(a.current_lat,h.lat) is null or coalesce(a.current_lng,h.lng) is null
        then null::numeric
      else round((
        6371.0 * 2.0 * asin(sqrt(
          power(sin(radians((coalesce(a.current_lat,h.lat) - e.lat) / 2.0)), 2)
          + cos(radians(e.lat))
            * cos(radians(coalesce(a.current_lat,h.lat)))
            * power(sin(radians((coalesce(a.current_lng,h.lng) - e.lng) / 2.0)), 2)
        ))
      )::numeric, 2)
    end as distance_km
  from public.ambulances a
  left join public.hospitals h on h.id = a.hospital_id
  where a.status = 'available'
    and a.driver_id is not null
    and (h.id is null or h.verification = 'verified')
    and (e.city is null or h.city = e.city or a.current_lat is not null)
  order by distance_km nulls last, a.updated_at desc
  limit greatest(1, least(coalesce(p_limit,8), 20));
end;
$$;

revoke all on function public.get_emergency_dispatch_candidates(uuid,int) from public;
grant execute on function public.get_emergency_dispatch_candidates(uuid,int) to authenticated;

-- Offer the nearest available ambulance. Offering does not yet change the emergency
-- status to "dispatched"; the mission becomes dispatched only after driver acceptance.
create or replace function public.dispatch_nearest_ambulance(
  p_emergency_id uuid
) returns public.emergency_dispatches
language plpgsql security definer set search_path = public as $$
declare
  e public.emergencies;
  candidate public.ambulances;
  hospital_row public.hospitals;
  op_city text;
  distance numeric(8,2);
  result public.emergency_dispatches;
begin
  if public.current_role() not in ('emergency_operator','admin','super_admin') then
    raise exception 'Unauthorized emergency dispatch access';
  end if;

  select * into e from public.emergencies where id = p_emergency_id for update;
  if not found then raise exception 'Emergency not found'; end if;

  select city into op_city from public.profiles where id = auth.uid();
  if public.current_role() = 'emergency_operator'
     and op_city is not null and e.city is not null and op_city <> e.city then
    raise exception 'Emergency is outside your dispatch region';
  end if;

  if e.status <> 'active' then
    raise exception 'Emergency is not awaiting initial dispatch';
  end if;

  if exists (
    select 1 from public.emergency_dispatches d
    where d.emergency_id = e.id and d.status in ('offered','accepted')
  ) then
    raise exception 'An ambulance is already assigned or awaiting acknowledgement';
  end if;

  select a.* into candidate
  from public.ambulances a
  left join public.hospitals h on h.id = a.hospital_id
  where a.status = 'available'
    and a.driver_id is not null
    and (h.id is null or h.verification = 'verified')
    and (e.city is null or h.city = e.city or a.current_lat is not null)
  order by
    case
      when coalesce(a.current_lat,h.lat) is null or coalesce(a.current_lng,h.lng) is null then 1
      else 0
    end,
    case
      when coalesce(a.current_lat,h.lat) is null or coalesce(a.current_lng,h.lng) is null then null
      else
        6371.0 * 2.0 * asin(sqrt(
          power(sin(radians((coalesce(a.current_lat,h.lat) - e.lat) / 2.0)), 2)
          + cos(radians(e.lat))
            * cos(radians(coalesce(a.current_lat,h.lat)))
            * power(sin(radians((coalesce(a.current_lng,h.lng) - e.lng) / 2.0)), 2)
        ))
    end asc,
    a.updated_at desc
  for update of a skip locked
  limit 1;

  if not found then
    raise exception 'No available ambulance in the dispatch region';
  end if;

  select * into hospital_row from public.hospitals where id = candidate.hospital_id;
  if coalesce(candidate.current_lat,hospital_row.lat) is not null
     and coalesce(candidate.current_lng,hospital_row.lng) is not null then
    distance := (
      6371.0 * 2.0 * asin(sqrt(
        power(sin(radians((coalesce(candidate.current_lat,hospital_row.lat) - e.lat) / 2.0)), 2)
        + cos(radians(e.lat))
          * cos(radians(coalesce(candidate.current_lat,hospital_row.lat)))
          * power(sin(radians((coalesce(candidate.current_lng,hospital_row.lng) - e.lng) / 2.0)), 2)
      ))
    )::numeric(8,2);
  end if;

  update public.ambulances
  set status = 'dispatched', updated_at = now()
  where id = candidate.id and status = 'available';

  if not found then raise exception 'Ambulance was claimed by another dispatcher'; end if;

  insert into public.emergency_dispatches (
    emergency_id, ambulance_id, operator_id, driver_id, status, distance_km
  ) values (
    e.id, candidate.id, auth.uid(), candidate.driver_id, 'offered', distance
  ) returning * into result;

  insert into public.audit_logs(actor_id, action, table_name, record_id, old_data, new_data)
  values (
    auth.uid(),
    'emergency_dispatch.offered',
    'emergency_dispatches',
    result.id,
    null,
    jsonb_build_object('emergency_id', e.id, 'ambulance_id', candidate.id, 'distance_km', distance)
  );

  return result;
end;
$$;

revoke all on function public.dispatch_nearest_ambulance(uuid) from public;
grant execute on function public.dispatch_nearest_ambulance(uuid) to authenticated;

create or replace function public.get_my_ambulance()
returns table (
  ambulance_id uuid,
  hospital_id uuid,
  hospital_name text,
  vehicle_no text,
  ambulance_type text,
  equipment text[],
  status ambulance_status,
  current_lat double precision,
  current_lng double precision,
  updated_at timestamptz
)
language sql security definer set search_path = public as $$
  select a.id, a.hospital_id, h.name, a.vehicle_no, a.type, a.equipment,
         a.status, a.current_lat, a.current_lng, a.updated_at
  from public.ambulances a
  left join public.hospitals h on h.id = a.hospital_id
  where a.driver_id = auth.uid()
  order by a.updated_at desc
  limit 1;
$$;

revoke all on function public.get_my_ambulance() from public;
grant execute on function public.get_my_ambulance() to authenticated;

create or replace function public.get_my_emergency_dispatches()
returns table (
  dispatch_id uuid,
  emergency_id uuid,
  emergency_type text,
  emergency_status emergency_status,
  emergency_lat double precision,
  emergency_lng double precision,
  emergency_address text,
  hospital_id uuid,
  hospital_name text,
  dispatch_status emergency_dispatch_status,
  distance_km numeric,
  vehicle_no text,
  ambulance_id uuid,
  offered_at timestamptz,
  accepted_at timestamptz
)
language sql security definer set search_path = public as $$
  select d.id, e.id, e.type, e.status, e.lat, e.lng, e.address,
         e.assigned_hospital_id, h.name, d.status, d.distance_km,
         a.vehicle_no, a.id, d.offered_at, d.accepted_at
  from public.emergency_dispatches d
  join public.emergencies e on e.id = d.emergency_id
  join public.ambulances a on a.id = d.ambulance_id
  left join public.hospitals h on h.id = e.assigned_hospital_id
  where d.driver_id = auth.uid()
    and d.status in ('offered','accepted')
    and e.status <> 'resolved'
    and e.status <> 'cancelled'
  order by
    case when d.status = 'offered' then 0 else 1 end,
    d.offered_at desc;
$$;

revoke all on function public.get_my_emergency_dispatches() from public;
grant execute on function public.get_my_emergency_dispatches() to authenticated;

create or replace function public.accept_emergency_dispatch(
  p_dispatch_id uuid
) returns public.emergencies
language plpgsql security definer set search_path = public as $$
declare
  d public.emergency_dispatches;
  e public.emergencies;
  a public.ambulances;
begin
  if public.current_role() <> 'ambulance_driver' then
    raise exception 'Only ambulance drivers can accept dispatches';
  end if;

  select * into d from public.emergency_dispatches where id = p_dispatch_id for update;
  if not found or d.driver_id <> auth.uid() then raise exception 'Dispatch not found'; end if;
  if d.status <> 'offered' then raise exception 'Dispatch is no longer available'; end if;

  select * into e from public.emergencies where id = d.emergency_id for update;
  select * into a from public.ambulances where id = d.ambulance_id for update;

  if e.status <> 'active' then raise exception 'Emergency is no longer awaiting dispatch'; end if;
  if a.driver_id <> auth.uid() or a.status <> 'dispatched' then
    raise exception 'Ambulance is no longer reserved for this dispatch';
  end if;

  update public.emergency_dispatches
  set status='accepted', responded_at=now(), accepted_at=now()
  where id=d.id;

  update public.emergencies
  set status='dispatched',
      assigned_ambulance_id=a.id,
      assigned_hospital_id=a.hospital_id,
      updated_at=now(),
      log=coalesce(log,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'at',now(),'event','dispatch_accepted','by',auth.uid()
      ))
  where id=e.id;

  update public.ambulances
  set status='busy', updated_at=now()
  where id=a.id;

  insert into public.notifications(user_id,type,title,body,priority,data)
  values (
    e.reporter_id,
    'emergency_dispatch',
    'Ambulance accepted your SOS',
    'A responder has accepted the emergency dispatch. Stay where you are if it is safe.',
    'critical',
    jsonb_build_object('emergency_id',e.id)
  );

  insert into public.audit_logs(actor_id, action, table_name, record_id, old_data, new_data)
  values (
    auth.uid(),'emergency_dispatch.accepted','emergency_dispatches',d.id,
    jsonb_build_object('status','offered'),
    jsonb_build_object('status','accepted','emergency_id',e.id,'ambulance_id',a.id)
  );

  select * into e from public.emergencies where id=e.id;
  return e;
end;
$$;

revoke all on function public.accept_emergency_dispatch(uuid) from public;
grant execute on function public.accept_emergency_dispatch(uuid) to authenticated;

create or replace function public.decline_emergency_dispatch(
  p_dispatch_id uuid
) returns public.emergency_dispatches
language plpgsql security definer set search_path = public as $$
declare
  d public.emergency_dispatches;
begin
  if public.current_role() <> 'ambulance_driver' then
    raise exception 'Only ambulance drivers can decline dispatches';
  end if;

  select * into d from public.emergency_dispatches where id=p_dispatch_id for update;
  if not found or d.driver_id <> auth.uid() then raise exception 'Dispatch not found'; end if;
  if d.status <> 'offered' then raise exception 'Dispatch is no longer pending'; end if;

  update public.emergency_dispatches
  set status='declined', responded_at=now(), declined_at=now()
  where id=d.id
  returning * into d;

  update public.ambulances
  set status='available', updated_at=now()
  where id=d.ambulance_id and driver_id=auth.uid();

  return d;
end;
$$;

revoke all on function public.decline_emergency_dispatch(uuid) from public;
grant execute on function public.decline_emergency_dispatch(uuid) to authenticated;

create or replace function public.cancel_emergency_dispatch(
  p_dispatch_id uuid
) returns public.emergency_dispatches
language plpgsql security definer set search_path = public as $$
declare
  d public.emergency_dispatches;
begin
  if public.current_role() not in ('emergency_operator','admin','super_admin') then
    raise exception 'Unauthorized dispatch cancellation';
  end if;

  select * into d from public.emergency_dispatches where id=p_dispatch_id for update;
  if not found or d.status not in ('offered','accepted') then
    raise exception 'Dispatch is no longer active';
  end if;

  update public.emergency_dispatches
  set status='cancelled', responded_at=coalesce(responded_at,now())
  where id=d.id
  returning * into d;

  if d.status = 'cancelled' then
    update public.ambulances
    set status='available', updated_at=now()
    where id=d.ambulance_id and status in ('dispatched','busy');

    update public.emergencies
    set assigned_ambulance_id=null,
        assigned_hospital_id=null,
        status=case when status='dispatched' then 'active'::emergency_status else status end,
        updated_at=now(),
        log=coalesce(log,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
          'at',now(),'event','dispatch_cancelled','by',auth.uid()
        ))
    where id=d.emergency_id and status in ('active','dispatched');
  end if;

  return d;
end;
$$;

revoke all on function public.cancel_emergency_dispatch(uuid) from public;
grant execute on function public.cancel_emergency_dispatch(uuid) to authenticated;

create or replace function public.update_emergency_status(
  p_emergency_id uuid,
  p_status emergency_status
) returns public.emergencies
language plpgsql security definer set search_path = public as $$
declare
  e public.emergencies;
  a public.ambulances;
  hr public.hospitals;
  allowed boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into e from public.emergencies where id=p_emergency_id for update;
  if not found then raise exception 'Emergency not found'; end if;

  select * into a from public.ambulances where id=e.assigned_ambulance_id for update;
  select * into hr from public.hospitals where id=e.assigned_hospital_id;

  if public.current_role() = 'ambulance_driver' then
    if a.id is null or a.driver_id <> auth.uid() then
      raise exception 'You are not the assigned ambulance driver';
    end if;
    allowed :=
      (e.status='dispatched' and p_status='on_scene') or
      (e.status='on_scene' and p_status='transporting') or
      (e.status='transporting' and p_status='arrived');
  elsif public.current_role() in ('hospital') then
    allowed := hr.owner_id = auth.uid()
      and e.status='arrived' and p_status='resolved';
  elsif public.current_role() in ('emergency_operator','admin','super_admin') then
    allowed :=
      (e.status='dispatched' and p_status in ('on_scene','cancelled')) or
      (e.status='on_scene' and p_status in ('transporting','cancelled')) or
      (e.status='transporting' and p_status in ('arrived','cancelled','resolved')) or
      (e.status='arrived' and p_status='resolved');
  end if;

  if not allowed then
    raise exception 'Invalid emergency status transition';
  end if;

  update public.emergencies
  set status=p_status,
      resolved_at=case when p_status='resolved' then now() else resolved_at end,
      updated_at=now(),
      log=coalesce(log,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'at',now(),'event','status_' || p_status::text,'by',auth.uid()
      ))
  where id=e.id
  returning * into e;

  if p_status='resolved' or p_status='cancelled' then
    update public.emergency_dispatches
    set status='completed',
        completed_at=now()
    where emergency_id=e.id and status='accepted';

    if a.id is not null then
      update public.ambulances
      set status='available', updated_at=now()
      where id=a.id and driver_id=a.driver_id;
    end if;
  end if;

  return e;
end;
$$;

revoke all on function public.update_emergency_status(uuid,emergency_status) from public;
grant execute on function public.update_emergency_status(uuid,emergency_status) to authenticated;



-- Region-scoped operator feed: operators only see active emergencies in their assigned city.
create or replace function public.get_emergency_operator_feed()
returns setof public.emergencies
language plpgsql security definer set search_path = public as $$
declare
  r app_role;
  operator_city text;
begin
  r := public.current_role();
  if r not in ('emergency_operator','admin','super_admin') then
    raise exception 'Unauthorized emergency operator feed access';
  end if;

  select city into operator_city from public.profiles where id = auth.uid();

  if r = 'emergency_operator' and operator_city is not null then
    return query
      select e from public.emergencies e
      where e.status in ('active','dispatched','on_scene','transporting','arrived')
        and e.city = operator_city
      order by
        case when e.status='active' then 0 else 1 end,
        e.created_at asc;
  else
    return query
      select e from public.emergencies e
      where e.status in ('active','dispatched','on_scene','transporting','arrived')
      order by
        case when e.status='active' then 0 else 1 end,
        e.created_at asc;
  end if;
end;
$$;

revoke all on function public.get_emergency_operator_feed() from public;
grant execute on function public.get_emergency_operator_feed() to authenticated;

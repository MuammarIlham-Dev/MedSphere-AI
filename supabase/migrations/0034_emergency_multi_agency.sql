-- Migration 0034: Multi-agency Emergency SOS response and escalation
-- Keeps ambulance dispatch independent while adding verified Fire/Police/Rescue/EMS agencies.

alter type public.app_role add value if not exists 'emergency_responder';

do $$
begin
  create type public.emergency_agency_type as enum ('ems','fire','police','rescue');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.emergency_agency_dispatch_status as enum (
    'offered','acknowledged','en_route','on_scene','completed',
    'declined','timed_out','cancelled'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.emergency_agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  agency_type public.emergency_agency_type not null,
  license_no text not null unique,
  phone text,
  city text,
  lat double precision,
  lng double precision,
  verification public.verification_status not null default 'pending',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lat is null or lat between -90 and 90),
  check (lng is null or lng between -180 and 180)
);

create index if not exists emergency_agencies_type_city_idx
  on public.emergency_agencies(agency_type, city, verification, is_active);

create table if not exists public.emergency_agency_members (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.emergency_agencies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'responder',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (agency_id, user_id)
);

create index if not exists emergency_agency_members_user_idx
  on public.emergency_agency_members(user_id, is_active);

create table if not exists public.emergency_agency_dispatches (
  id uuid primary key default gen_random_uuid(),
  emergency_id uuid not null references public.emergencies(id) on delete cascade,
  agency_id uuid not null references public.emergency_agencies(id),
  requested_by uuid not null references public.profiles(id),
  assigned_member_id uuid references public.profiles(id),
  status public.emergency_agency_dispatch_status not null default 'offered',
  priority public.notification_priority not null default 'critical',
  distance_km numeric(8,2),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '45 seconds'),
  responded_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create unique index if not exists emergency_agency_dispatch_active_idx
  on public.emergency_agency_dispatches(emergency_id, agency_id)
  where status in ('offered','acknowledged','en_route','on_scene');

create index if not exists emergency_agency_dispatch_agency_idx
  on public.emergency_agency_dispatches(agency_id, status, requested_at desc);

create index if not exists emergency_agency_dispatch_emergency_idx
  on public.emergency_agency_dispatches(emergency_id, created_at desc);

alter table public.emergency_agencies enable row level security;
alter table public.emergency_agency_members enable row level security;
alter table public.emergency_agency_dispatches enable row level security;

drop policy if exists emergency_agencies_read on public.emergency_agencies;
create policy emergency_agencies_read on public.emergency_agencies
for select using (
  public.is_admin()
  or exists (
    select 1 from public.emergency_agency_members m
    where m.agency_id = id and m.user_id = auth.uid() and m.is_active
  )
);

drop policy if exists emergency_agency_members_read on public.emergency_agency_members;
create policy emergency_agency_members_read on public.emergency_agency_members
for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists emergency_agency_dispatches_read on public.emergency_agency_dispatches;
create policy emergency_agency_dispatches_read on public.emergency_agency_dispatches
for select using (
  public.is_admin()
  or exists (
    select 1 from public.emergency_agencies a
    join public.emergency_agency_members m on m.agency_id = a.id
    where a.id = agency_id and m.user_id = auth.uid() and m.is_active
  )
  or (
    public.current_role() = 'emergency_operator'
    and exists (
      select 1 from public.emergencies e
      where e.id = emergency_id
        and (e.city is null or e.city = (select p.city from public.profiles p where p.id = auth.uid()))
    )
  )
  or (
    public.current_role() = 'government'
    and exists (select 1 from public.emergencies e where e.id = emergency_id)
  )
  or exists (
    select 1 from public.emergencies e
    where e.id = emergency_id and e.reporter_id = auth.uid()
  )
);

-- No direct client writes: all agency state changes go through RPCs.
drop policy if exists emergency_agencies_insert on public.emergency_agencies;
drop policy if exists emergency_agencies_update on public.emergency_agencies;
drop policy if exists emergency_agency_members_write on public.emergency_agency_members;
drop policy if exists emergency_agency_dispatches_write on public.emergency_agency_dispatches;

select public.apply_updated_at('public.emergency_agencies');

-- Prevent self-service role elevation to an emergency responder.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare r public.app_role;
begin
  begin r := coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'citizen'); 
  exception when others then r := 'citizen'; end;
  if r in ('admin','super_admin','emergency_responder') then r := 'citizen'; end if;

  insert into public.profiles (id, role, full_name, phone, digital_health_id)
  values (
    new.id,
    r,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.phone,
    'MSH-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))
  );
  return new;
end $$;

-- Administrative provisioning only.
create or replace function public.set_emergency_responder_role(
  p_profile_id uuid,
  p_enabled boolean
) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare result public.profiles;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_profile_id is null then raise exception 'Profile is required'; end if;

  update public.profiles
  set role = case when p_enabled then 'emergency_responder'::public.app_role else 'citizen'::public.app_role end
  where id=p_profile_id
  returning * into result;

  if not found then raise exception 'Profile not found'; end if;
  return result;
end $$;

revoke all on function public.set_emergency_responder_role(uuid,boolean) from public;
grant execute on function public.set_emergency_responder_role(uuid,boolean) to authenticated;

create or replace function public.set_emergency_agency_member(
  p_agency_id uuid,
  p_user_id uuid,
  p_active boolean default true,
  p_member_role text default 'responder'
) returns public.emergency_agency_members
language plpgsql security definer set search_path = public as $$
declare result public.emergency_agency_members;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_agency_id is null or p_user_id is null then raise exception 'Agency and user are required'; end if;

  if not exists (
    select 1 from public.profiles p
    where p.id=p_user_id and p.role='emergency_responder'
  ) then
    raise exception 'User must be an emergency responder';
  end if;

  insert into public.emergency_agency_members(agency_id,user_id,member_role,is_active)
  values(p_agency_id,p_user_id,coalesce(nullif(trim(p_member_role),''),'responder'),p_active)
  on conflict (agency_id,user_id)
  do update set member_role=excluded.member_role,is_active=excluded.is_active
  returning * into result;

  return result;
end $$;

revoke all on function public.set_emergency_agency_member(uuid,uuid,boolean,text) from public;
grant execute on function public.set_emergency_agency_member(uuid,uuid,boolean,text) to authenticated;

create or replace function public.admin_create_emergency_agency(
  p_name text,
  p_agency_type public.emergency_agency_type,
  p_license_no text,
  p_phone text default null,
  p_city text default null,
  p_lat double precision default null,
  p_lng double precision default null
) returns public.emergency_agencies
language plpgsql security definer set search_path = public as $$
declare result public.emergency_agencies;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if nullif(trim(p_name),'') is null or nullif(trim(p_license_no),'') is null then
    raise exception 'Agency name and license are required';
  end if;
  if p_lat is not null and (p_lat < -90 or p_lat > 90) then raise exception 'Invalid latitude'; end if;
  if p_lng is not null and (p_lng < -180 or p_lng > 180) then raise exception 'Invalid longitude'; end if;

  insert into public.emergency_agencies(
    name,agency_type,license_no,phone,city,lat,lng,verification,is_active
  ) values (
    trim(p_name),p_agency_type,trim(p_license_no),nullif(trim(p_phone),''),
    nullif(trim(p_city),''),p_lat,p_lng,'verified',true
  ) returning * into result;

  return result;
end $$;

revoke all on function public.admin_create_emergency_agency(text,public.emergency_agency_type,text,text,text,double precision,double precision) from public;
grant execute on function public.admin_create_emergency_agency(text,public.emergency_agency_type,text,text,text,double precision,double precision) to authenticated;

-- Map incident type to required service capabilities.
create or replace function public.required_emergency_agency_types(
  p_type text
) returns public.emergency_agency_type[]
language sql immutable as $$
  select case lower(trim(coalesce(p_type,'medical')))
    when 'medical' then array['ems']::public.emergency_agency_type[]
    when 'accident' then array['ems','police','rescue']::public.emergency_agency_type[]
    when 'fire' then array['fire','ems']::public.emergency_agency_type[]
    when 'police' then array['police','ems']::public.emergency_agency_type[]
    else array['ems','rescue']::public.emergency_agency_type[]
  end;
$$;

revoke all on function public.required_emergency_agency_types(text) from public;
grant execute on function public.required_emergency_agency_types(text) to authenticated;

-- Dispatch one verified agency per required service type. Repeated calls only fill missing services.
create or replace function public.dispatch_required_emergency_agencies(
  p_emergency_id uuid
) returns setof public.emergency_agency_dispatches
language plpgsql security definer set search_path = public as $$
declare
  e public.emergencies;
  caller_city text;
  agency_type public.emergency_agency_type;
  candidate public.emergency_agencies;
  distance numeric(8,2);
  result public.emergency_agency_dispatches;
begin
  if public.current_role() not in ('emergency_operator','admin','super_admin') then
    raise exception 'Unauthorized emergency agency dispatch access';
  end if;

  select * into e from public.emergencies where id=p_emergency_id for update;
  if not found then raise exception 'Emergency not found'; end if;

  select city into caller_city from public.profiles where id=auth.uid();
  if public.current_role()='emergency_operator'
     and caller_city is not null and e.city is not null and caller_city <> e.city then
    raise exception 'Emergency is outside your dispatch region';
  end if;

  if e.status not in ('active','dispatched','on_scene','transporting') then
    raise exception 'Emergency is no longer operational';
  end if;

  foreach agency_type in array public.required_emergency_agency_types(e.type) loop
    select a.* into candidate
    from public.emergency_agencies a
    where a.agency_type=agency_type
      and a.verification='verified'
      and a.is_active
      and (e.city is null or a.city=e.city)
      and not exists (
        select 1 from public.emergency_agency_dispatches d
        where d.emergency_id=e.id
          and d.agency_id=a.id
          and d.status in ('offered','acknowledged','en_route','on_scene','completed')
      )
    order by
      case when a.lat is null or a.lng is null then 1 else 0 end,
      case when a.lat is null or a.lng is null then null else
        6371.0 * 2.0 * asin(sqrt(
          power(sin(radians((a.lat-e.lat)/2.0)),2)
          + cos(radians(e.lat))*cos(radians(a.lat))
          * power(sin(radians((a.lng-e.lng)/2.0)),2)
        )) end asc
    for update skip locked
    limit 1;

    if candidate.id is null then
      insert into public.notifications(user_id,type,title,body,data,priority)
      select m.user_id,'emergency_dispatch_gap','No agency available',
        initcap(agency_type::text)||' response is required but no verified active agency is currently available in this region.',
        jsonb_build_object('emergency_id',e.id,'agency_type',agency_type),'critical'
      from public.emergency_agency_members m
      join public.emergency_agencies a on a.id=m.agency_id
      where a.agency_type=agency_type and m.is_active
      on conflict do nothing;
      continue;
    end if;

    if candidate.lat is not null and candidate.lng is not null then
      distance := (6371.0 * 2.0 * asin(sqrt(
        power(sin(radians((candidate.lat-e.lat)/2.0)),2)
        + cos(radians(e.lat))*cos(radians(candidate.lat))
        * power(sin(radians((candidate.lng-e.lng)/2.0)),2)
      )))::numeric(8,2);
    end if;

    insert into public.emergency_agency_dispatches(
      emergency_id,agency_id,requested_by,status,priority,distance_km,expires_at
    ) values (
      e.id,candidate.id,auth.uid(),'offered',
      case when e.type in ('fire','police','accident') then 'critical'::public.notification_priority else 'high'::public.notification_priority end,
      distance,now()+interval '45 seconds'
    ) returning * into result;

    insert into public.notifications(user_id,type,title,body,data,priority)
    select m.user_id,'emergency_agency_dispatch','Emergency response requested',
      'A '||initcap(e.type)||' emergency requires your agency response.',
      jsonb_build_object('emergency_id',e.id,'dispatch_id',result.id,'agency_id',candidate.id,'agency_type',candidate.agency_type),
      result.priority
    from public.emergency_agency_members m
    where m.agency_id=candidate.id and m.is_active;

    insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
    values(auth.uid(),'emergency_agency_dispatch.offered','emergency_agency_dispatches',result.id,
      jsonb_build_object('emergency_id',e.id,'agency_id',candidate.id,'agency_type',candidate.agency_type,'distance_km',distance));

    return next result;
  end loop;
end $$;

revoke all on function public.dispatch_required_emergency_agencies(uuid) from public;
grant execute on function public.dispatch_required_emergency_agencies(uuid) to authenticated;

create or replace function public.get_emergency_agency_dispatches(
  p_emergency_id uuid
) returns table (
  dispatch_id uuid,
  emergency_id uuid,
  agency_id uuid,
  agency_name text,
  agency_type public.emergency_agency_type,
  status public.emergency_agency_dispatch_status,
  priority public.notification_priority,
  distance_km numeric,
  requested_at timestamptz,
  expires_at timestamptz,
  responded_at timestamptz,
  assigned_member_id uuid
)
language plpgsql security definer set search_path = public as $$
declare e public.emergencies; c text;
begin
  if public.current_role() not in ('emergency_operator','admin','super_admin') then
    raise exception 'Unauthorized emergency agency dispatch access';
  end if;

  select * into e from public.emergencies where id=p_emergency_id;
  if not found then raise exception 'Emergency not found'; end if;
  select city into c from public.profiles where id=auth.uid();

  if public.current_role()='emergency_operator' and c is not null and e.city is not null and c<>e.city then
    raise exception 'Emergency is outside your dispatch region';
  end if;

  return query
    select d.id,d.emergency_id,d.agency_id,a.name,a.agency_type,d.status,
           d.priority,d.distance_km,d.requested_at,d.expires_at,d.responded_at,d.assigned_member_id
    from public.emergency_agency_dispatches d
    join public.emergency_agencies a on a.id=d.agency_id
    where d.emergency_id=e.id
    order by d.requested_at asc;
end $$;

revoke all on function public.get_emergency_agency_dispatches(uuid) from public;
grant execute on function public.get_emergency_agency_dispatches(uuid) to authenticated;

create or replace function public.escalate_expired_emergency_agency_dispatches(
  p_emergency_id uuid
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  expired public.emergency_agency_dispatches;
  e public.emergencies;
  a public.emergency_agencies;
  next_agency public.emergency_agencies;
  count_escalated int := 0;
  distance numeric(8,2);
begin
  if public.current_role() not in ('emergency_operator','admin','super_admin') then
    raise exception 'Unauthorized emergency escalation access';
  end if;

  select * into e from public.emergencies where id=p_emergency_id for update;
  if not found then raise exception 'Emergency not found'; end if;

  for expired in
    select d.* from public.emergency_agency_dispatches d
    where d.emergency_id=e.id and d.status='offered' and d.expires_at <= now()
    for update skip locked
  loop
    update public.emergency_agency_dispatches
    set status='timed_out',responded_at=coalesce(responded_at,now())
    where id=expired.id;

    select a.* into next_agency
    from public.emergency_agencies a
    where a.agency_type=(select agency_type from public.emergency_agencies where id=expired.agency_id)
      and a.verification='verified' and a.is_active
      and (e.city is null or a.city=e.city)
      and not exists (
        select 1 from public.emergency_agency_dispatches x
        where x.emergency_id=e.id and x.agency_id=a.id
      )
    order by
      case when a.lat is null or a.lng is null then 1 else 0 end,
      case when a.lat is null or a.lng is null then null else
        6371.0 * 2.0 * asin(sqrt(
          power(sin(radians((a.lat-e.lat)/2.0)),2)
          + cos(radians(e.lat))*cos(radians(a.lat))
          * power(sin(radians((a.lng-e.lng)/2.0)),2)
        )) end asc
    for update skip locked
    limit 1;

    insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
    values(auth.uid(),'emergency_agency_dispatch.timed_out','emergency_agency_dispatches',expired.id,
      jsonb_build_object('emergency_id',e.id,'agency_id',expired.agency_id));

    if next_agency.id is not null then
      if next_agency.lat is not null and next_agency.lng is not null then
        distance := (6371.0 * 2.0 * asin(sqrt(
          power(sin(radians((next_agency.lat-e.lat)/2.0)),2)
          + cos(radians(e.lat))*cos(radians(next_agency.lat))
          * power(sin(radians((next_agency.lng-e.lng)/2.0)),2)
        )))::numeric(8,2);
      else distance := null; end if;

      insert into public.emergency_agency_dispatches(
        emergency_id,agency_id,requested_by,status,priority,distance_km,expires_at
      ) values (
        e.id,next_agency.id,auth.uid(),'offered',
        expired.priority,distance,now()+interval '45 seconds'
      ) returning * into expired;

      insert into public.notifications(user_id,type,title,body,data,priority)
      select m.user_id,'emergency_agency_dispatch','Escalated emergency response',
        'The previous response window expired. Your agency is now the next response target.',
        jsonb_build_object('emergency_id',e.id,'dispatch_id',expired.id,'agency_id',next_agency.id,'agency_type',next_agency.agency_type),
        'critical'
      from public.emergency_agency_members m
      where m.agency_id=next_agency.id and m.is_active;

      count_escalated := count_escalated + 1;
    end if;
  end loop;

  return count_escalated;
end $$;

revoke all on function public.escalate_expired_emergency_agency_dispatches(uuid) from public;
grant execute on function public.escalate_expired_emergency_agency_dispatches(uuid) to authenticated;

-- Responder queue.
create or replace function public.get_my_emergency_agencies()
returns table (
  agency_id uuid,
  agency_name text,
  agency_type public.emergency_agency_type,
  city text,
  phone text
)
language sql security definer set search_path = public as $$
  select a.id,a.name,a.agency_type,a.city,a.phone
  from public.emergency_agencies a
  join public.emergency_agency_members m on m.agency_id=a.id
  where m.user_id=auth.uid() and m.is_active
    and a.is_active and a.verification='verified'
  order by a.name;
$$;

revoke all on function public.get_my_emergency_agencies() from public;
grant execute on function public.get_my_emergency_agencies() to authenticated;

-- Responder queue.
create or replace function public.get_my_emergency_agency_dispatches()
returns table (
  dispatch_id uuid,
  emergency_id uuid,
  emergency_type text,
  emergency_status public.emergency_status,
  emergency_lat double precision,
  emergency_lng double precision,
  emergency_address text,
  agency_id uuid,
  agency_name text,
  agency_type public.emergency_agency_type,
  dispatch_status public.emergency_agency_dispatch_status,
  distance_km numeric,
  requested_at timestamptz,
  expires_at timestamptz,
  acknowledged_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if public.current_role()<>'emergency_responder' then
    raise exception 'Only emergency responders can access this queue';
  end if;

  return query
  select d.id,e.id,e.type,e.status,e.lat,e.lng,e.address,
         a.id,a.name,a.agency_type,d.status,d.distance_km,d.requested_at,d.expires_at,d.responded_at
  from public.emergency_agency_dispatches d
  join public.emergencies e on e.id=d.emergency_id
  join public.emergency_agencies a on a.id=d.agency_id
  join public.emergency_agency_members m on m.agency_id=a.id and m.user_id=auth.uid() and m.is_active
  where d.status in ('offered','acknowledged','en_route','on_scene')
    and e.status not in ('resolved','cancelled')
  order by
    case when d.status='offered' then 0 else 1 end,
    d.requested_at desc;
end $$;

revoke all on function public.get_my_emergency_agency_dispatches() from public;
grant execute on function public.get_my_emergency_agency_dispatches() to authenticated;

create or replace function public.acknowledge_emergency_agency_dispatch(
  p_dispatch_id uuid
) returns public.emergency_agency_dispatches
language plpgsql security definer set search_path = public as $$
declare d public.emergency_agency_dispatches; a public.emergency_agencies;
begin
  if public.current_role()<>'emergency_responder' then raise exception 'Responder access required'; end if;

  select ed.* into d from public.emergency_agency_dispatches ed
  where ed.id = p_dispatch_id
  for update;
  if not found then raise exception 'Dispatch not found'; end if;

  if not exists (
    select 1 from public.emergency_agency_members m
    where m.agency_id=d.agency_id and m.user_id=auth.uid() and m.is_active
  ) then raise exception 'You are not an active member of this response agency'; end if;

  if d.status<>'offered' then raise exception 'Dispatch is no longer available'; end if;
  if d.expires_at<=now() then raise exception 'Dispatch offer has expired'; end if;

  select * into a from public.emergency_agencies where id=d.agency_id;
  if not found or not a.is_active or a.verification<>'verified' then
    raise exception 'Agency is no longer active';
  end if;

  update public.emergency_agency_dispatches
  set status='acknowledged',assigned_member_id=auth.uid(),responded_at=now()
  where id=d.id
  returning * into d;

  insert into public.notifications(user_id,type,title,body,data,priority)
  select e.reporter_id,'emergency_agency_acknowledged',
    initcap(a.agency_type::text)||' response acknowledged',
    'An emergency response agency has acknowledged the incident.',
    jsonb_build_object('emergency_id',e.id,'agency_type',a.agency_type,'dispatch_id',d.id),'critical'
  from public.emergencies e where e.id=d.emergency_id;

  return d;
end $$;

revoke all on function public.acknowledge_emergency_agency_dispatch(uuid) from public;
grant execute on function public.acknowledge_emergency_agency_dispatch(uuid) to authenticated;

create or replace function public.decline_emergency_agency_dispatch(
  p_dispatch_id uuid
) returns public.emergency_agency_dispatches
language plpgsql security definer set search_path = public as $$
declare d public.emergency_agency_dispatches;
begin
  if public.current_role()<>'emergency_responder' then raise exception 'Responder access required'; end if;

  select * into d from public.emergency_agency_dispatches where id=p_dispatch_id for update;
  if not found then raise exception 'Dispatch not found'; end if;
  if not exists (
    select 1 from public.emergency_agency_members m
    where m.agency_id=d.agency_id and m.user_id=auth.uid() and m.is_active
  ) then raise exception 'Not authorized for this agency'; end if;
  if d.status<>'offered' then raise exception 'Dispatch is no longer pending'; end if;

  update public.emergency_agency_dispatches
  set status='declined',responded_at=now()
  where id=d.id returning * into d;

  return d;
end $$;

revoke all on function public.decline_emergency_agency_dispatch(uuid) from public;
grant execute on function public.decline_emergency_agency_dispatch(uuid) to authenticated;

create or replace function public.update_emergency_agency_dispatch(
  p_dispatch_id uuid,
  p_status public.emergency_agency_dispatch_status,
  p_notes text default null
) returns public.emergency_agency_dispatches
language plpgsql security definer set search_path = public as $$
declare d public.emergency_agency_dispatches;
begin
  select * into d from public.emergency_agency_dispatches where id=p_dispatch_id for update;
  if not found then raise exception 'Dispatch not found'; end if;

  if public.current_role()='emergency_responder' then
    if d.assigned_member_id<>auth.uid() then raise exception 'Only the assigned responder can update this dispatch'; end if;
    if not (
      (d.status='acknowledged' and p_status='en_route')
      or (d.status='en_route' and p_status='on_scene')
      or (d.status='on_scene' and p_status='completed')
    ) then raise exception 'Invalid responder dispatch transition'; end if;
  elsif public.current_role() in ('emergency_operator','admin','super_admin') then
    if p_status<>'cancelled' then raise exception 'Operators may only cancel agency dispatches'; end if;
    if public.current_role()='emergency_operator' and exists (
      select 1 from public.emergencies e
      where e.id=d.emergency_id and e.city is not null and e.city<>(select p.city from public.profiles p where p.id=auth.uid())
    ) then
      raise exception 'Emergency is outside your dispatch region';
    end if;
    if d.status not in ('offered','acknowledged','en_route','on_scene') then raise exception 'Dispatch is not active'; end if;
  else
    raise exception 'Unauthorized agency dispatch status change';
  end if;

  update public.emergency_agency_dispatches
  set status=p_status,
      notes=coalesce(nullif(trim(p_notes),''),notes),
      completed_at=case when p_status='completed' then now() else completed_at end
  where id=d.id
  returning * into d;

  return d;
end $$;

revoke all on function public.update_emergency_agency_dispatch(uuid,public.emergency_agency_dispatch_status,text) from public;
grant execute on function public.update_emergency_agency_dispatch(uuid,public.emergency_agency_dispatch_status,text) to authenticated;

-- Extend the operator feed to perform deterministic timeout escalation before returning active incidents.
create or replace function public.get_emergency_operator_feed()
returns setof public.emergencies
language plpgsql security definer set search_path = public as $$
declare
  r public.app_role;
  operator_city text;
  incident_id uuid;
begin
  r:=public.current_role();
  if r not in ('emergency_operator','admin','super_admin') then raise exception 'Unauthorized emergency operator feed access'; end if;

  if r in ('emergency_operator','admin','super_admin') then
    for incident_id in
      select e.id from public.emergencies e
      where e.status in ('active','dispatched','on_scene','transporting','arrived')
    loop
      begin
        perform public.escalate_expired_emergency_agency_dispatches(incident_id);
      exception when others then
        -- A stale secondary-agency attempt must never block the core ambulance dispatch feed.
        null;
      end;
    end loop;
  end if;

  select city into operator_city from public.profiles where id=auth.uid();

  if r='emergency_operator' and operator_city is not null then
    return query select e from public.emergencies e
      where e.status in ('active','dispatched','on_scene','transporting','arrived')
        and e.city=operator_city
      order by case when e.status='active' then 0 else 1 end,e.created_at asc;
  else
    return query select e from public.emergencies e
      where e.status in ('active','dispatched','on_scene','transporting','arrived')
      order by case when e.status='active' then 0 else 1 end,e.created_at asc;
  end if;
end $$;

revoke all on function public.get_emergency_operator_feed() from public;
grant execute on function public.get_emergency_operator_feed() to authenticated;

-- 0024: hospital <-> blood-bank requisition and fulfillment.
create table public.blood_request_fulfillments(
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.blood_requests(id) on delete cascade,
  bank_id uuid not null references public.blood_banks(id),
  units int not null check(units>0),
  fulfilled_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index blood_request_fulfillments_request_idx on public.blood_request_fulfillments(request_id,created_at desc);
create index blood_request_fulfillments_bank_idx on public.blood_request_fulfillments(bank_id,created_at desc);

alter table public.blood_request_fulfillments enable row level security;
create policy blood_request_fulfillments_read on public.blood_request_fulfillments for select using(
  public.is_admin() or fulfilled_by=auth.uid()
  or exists(select 1 from public.blood_requests r where r.id=request_id and r.requester_id=auth.uid())
  or exists(select 1 from public.blood_banks b where b.id=bank_id and b.owner_id=auth.uid())
);

create or replace function public.create_hospital_blood_request(
  p_hospital_id uuid,p_patient_name text,p_blood_group blood_group,p_units int,
  p_urgency urgency_level default 'standard',p_needed_by timestamptz default null,p_notes text default null
)
returns public.blood_requests
language plpgsql security definer set search_path=public as $$
declare h public.hospitals%rowtype; r public.blood_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_units<1 then raise exception 'units must be positive'; end if;
  if nullif(trim(coalesce(p_patient_name,'')),'') is null then raise exception 'patient name is required'; end if;
  if p_needed_by is not null and p_needed_by<now() then raise exception 'needed-by time must be in the future'; end if;

  select * into h from public.hospitals
  where id=p_hospital_id and (owner_id=auth.uid() or public.is_admin()) for update;
  if not found then raise exception 'hospital not found or unauthorized'; end if;

  insert into public.blood_requests(requester_id,hospital_id,patient_name,blood_group,units,urgency,status,needed_by,notes)
  values(auth.uid(),h.id,trim(p_patient_name),p_blood_group,p_units,p_urgency,'open',p_needed_by,nullif(trim(coalesce(p_notes,'')),''))
  returning * into r;

  insert into public.notifications(user_id,type,title,body,data,priority)
  select b.owner_id,'blood_request.new','Hospital blood request',
    h.name||' requested '||p_units||' unit(s) of '||p_blood_group||' blood.',
    jsonb_build_object('blood_request_id',r.id,'hospital_id',h.id,'urgency',p_urgency),'high'
  from public.blood_banks b
  where b.verification='verified' and (h.city is null or b.city=h.city);

  insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
  values(auth.uid(),'blood_request.hospital_created','blood_requests',r.id::text,
    jsonb_build_object('hospital_id',h.id,'blood_group',p_blood_group,'units',p_units,'urgency',p_urgency));
  return r;
end $$;

create or replace function public.get_hospital_blood_requests(p_hospital_id uuid)
returns table(id uuid,patient_name text,blood_group blood_group,units int,units_fulfilled int,urgency urgency_level,status request_status,needed_by timestamptz,notes text,created_at timestamptz)
language sql security definer stable set search_path=public as $$
  select r.id,r.patient_name,r.blood_group,r.units,r.units_fulfilled,r.urgency,r.status,r.needed_by,r.notes,r.created_at
  from public.blood_requests r
  where r.hospital_id=p_hospital_id
    and exists(select 1 from public.hospitals h where h.id=p_hospital_id and (h.owner_id=auth.uid() or public.is_admin()))
  order by case r.urgency when 'critical' then 1 when 'high' then 2 when 'standard' then 3 else 4 end,r.created_at desc
$$;

create or replace function public.cancel_hospital_blood_request(p_request_id uuid)
returns public.blood_requests
language plpgsql security definer set search_path=public as $$
declare r public.blood_requests%rowtype;
begin
  select * into r from public.blood_requests where id=p_request_id and requester_id=auth.uid() for update;
  if not found then raise exception 'blood request not found'; end if;
  if r.status not in('open','partially_fulfilled') then raise exception 'request is no longer cancellable'; end if;
  update public.blood_requests set status='cancelled' where id=r.id returning * into r;
  insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
    values(auth.uid(),'blood_request.hospital_cancelled','blood_requests',r.id::text,jsonb_build_object('status','cancelled'));
  return r;
end $$;

create or replace function public.get_blood_bank_hospital_requests(p_bank_id uuid)
returns table(id uuid,hospital_id uuid,hospital_name text,city text,patient_name text,blood_group blood_group,units int,units_fulfilled int,urgency urgency_level,status request_status,needed_by timestamptz,notes text,created_at timestamptz)
language sql security definer stable set search_path=public as $$
  select r.id,r.hospital_id,h.name,h.city,r.patient_name,r.blood_group,r.units,r.units_fulfilled,r.urgency,r.status,r.needed_by,r.notes,r.created_at
  from public.blood_requests r join public.hospitals h on h.id=r.hospital_id
  where r.status in('open','partially_fulfilled') and r.units_fulfilled<r.units
    and exists(select 1 from public.blood_banks b where b.id=p_bank_id and b.owner_id=auth.uid() and b.verification='verified')
  order by case r.urgency when 'critical' then 1 when 'high' then 2 when 'standard' then 3 else 4 end,r.created_at asc
$$;

create or replace function public.fulfill_hospital_blood_request(p_request_id uuid,p_bank_id uuid,p_units int)
returns public.blood_request_fulfillments
language plpgsql security definer set search_path=public as $$
declare r public.blood_requests%rowtype; inv public.blood_inventory%rowtype; b public.blood_banks%rowtype; f public.blood_request_fulfillments%rowtype; remaining int;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_units<1 then raise exception 'units must be positive'; end if;

  select * into b from public.blood_banks where id=p_bank_id and (owner_id=auth.uid() or public.is_admin()) and (verification='verified' or public.is_admin()) for update;
  if not found then raise exception 'verified blood bank not found or unauthorized'; end if;

  select * into r from public.blood_requests where id=p_request_id for update;
  if not found or r.hospital_id is null then raise exception 'hospital blood request not found'; end if;
  if r.status not in('open','partially_fulfilled') then raise exception 'request is no longer open'; end if;

  remaining:=r.units-r.units_fulfilled;
  if p_units>remaining then raise exception 'fulfillment exceeds remaining request'; end if;

  select * into inv from public.blood_inventory where bank_id=p_bank_id and blood_group=r.blood_group for update;
  if not found then raise exception 'blood group inventory is not configured'; end if;
  if inv.units_available<p_units then raise exception 'insufficient blood inventory'; end if;
  if inv.units_available-inv.units_reserved<p_units then raise exception 'available stock is already reserved'; end if;

  update public.blood_inventory set units_available=units_available-p_units,updated_at=now()
  where bank_id=p_bank_id and blood_group=r.blood_group;

  insert into public.blood_request_fulfillments(request_id,bank_id,units,fulfilled_by)
  values(r.id,p_bank_id,p_units,auth.uid()) returning * into f;

  update public.blood_requests
  set units_fulfilled=units_fulfilled+p_units,
      status=case when units_fulfilled+p_units>=units then 'fulfilled'::request_status else 'partially_fulfilled'::request_status end
  where id=r.id returning * into r;

  insert into public.notifications(user_id,type,title,body,data,priority)
  values(r.requester_id,'blood_request.fulfilled','Blood request fulfilled',
    'A blood bank fulfilled '||p_units||' unit(s) of your '||r.blood_group||' request.',
    jsonb_build_object('blood_request_id',r.id,'fulfillment_id',f.id,'bank_id',p_bank_id,'units',p_units),'high');

  insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
  values(auth.uid(),'blood_request.fulfilled','blood_request_fulfillments',f.id::text,
    jsonb_build_object('request_id',r.id,'bank_id',p_bank_id,'units',p_units,'request_status',r.status));
  return f;
end $$;

revoke all on function public.create_hospital_blood_request(uuid,text,blood_group,int,urgency_level,timestamptz,text),
 public.get_hospital_blood_requests(uuid),public.cancel_hospital_blood_request(uuid),
 public.get_blood_bank_hospital_requests(uuid),public.fulfill_hospital_blood_request(uuid,uuid,int) from public,anon;
grant execute on function public.create_hospital_blood_request(uuid,text,blood_group,int,urgency_level,timestamptz,text),
 public.get_hospital_blood_requests(uuid),public.cancel_hospital_blood_request(uuid),
 public.get_blood_bank_hospital_requests(uuid),public.fulfill_hospital_blood_request(uuid,uuid,int) to authenticated;

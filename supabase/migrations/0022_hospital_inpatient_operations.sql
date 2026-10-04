-- 0022: hospital inpatient operational controls.
create table public.admission_bed_movements(
  id uuid primary key default gen_random_uuid(),
  admission_id uuid not null references public.admissions(id) on delete cascade,
  from_bed_id uuid not null references public.hospital_beds(id),
  to_bed_id uuid not null references public.hospital_beds(id),
  moved_by uuid not null references public.profiles(id),
  reason text not null,
  notes text,
  moved_at timestamptz not null default now(),
  constraint admission_bed_movements_distinct_beds check(from_bed_id<>to_bed_id)
);
create index admission_bed_movements_admission_idx on public.admission_bed_movements(admission_id,moved_at desc);

alter table public.admission_bed_movements enable row level security;
create policy admission_bed_movements_read on public.admission_bed_movements for select using(
  public.is_admin()
  or exists(select 1 from public.admissions a where a.id=admission_id
    and (a.patient_id=auth.uid() or a.hospital_id in(select id from public.hospitals where owner_id=auth.uid())))
);

create or replace function public.prevent_direct_hospital_capacity_edit()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if pg_trigger_depth()=1 and not public.is_admin()
     and (new.bed_capacity is distinct from old.bed_capacity
       or new.beds_available is distinct from old.beds_available
       or new.icu_capacity is distinct from old.icu_capacity
       or new.icu_available is distinct from old.icu_available) then
    raise exception 'hospital capacity is derived from bed inventory';
  end if;
  return new;
end $$;
drop trigger if exists tr_prevent_direct_hospital_capacity_edit on public.hospitals;
create trigger tr_prevent_direct_hospital_capacity_edit
before update on public.hospitals for each row execute function public.prevent_direct_hospital_capacity_edit();

create or replace function public.get_hospital_clinicians(p_hospital_id uuid)
returns table(doctor_id uuid,profile_id uuid,full_name text,specialty text,verification text,clinic_enabled boolean,video_enabled boolean)
language sql security definer stable set search_path=public as $$
  select d.id,d.profile_id,p.full_name,d.specialty,d.verification,d.clinic_enabled,d.video_enabled
  from public.doctors d join public.profiles p on p.id=d.profile_id
  where d.hospital_id=p_hospital_id and public.doctor_verification_eligible(d.id)
    and exists(select 1 from public.hospitals h where h.id=p_hospital_id and (h.owner_id=auth.uid() or public.is_admin()))
  order by p.full_name
$$;

create or replace function public.reject_bed_request(p_request_id uuid,p_review_notes text default null)
returns public.bed_requests language plpgsql security definer set search_path=public as $$
declare r public.bed_requests%rowtype;
begin
  select * into r from public.bed_requests where id=p_request_id for update;
  if not found then raise exception 'bed request not found'; end if;
  if not exists(select 1 from public.hospitals h where h.id=r.hospital_id and (h.owner_id=auth.uid() or public.is_admin())) then raise exception 'unauthorized request'; end if;
  if r.status not in('requested','reviewing') then raise exception 'request is not reviewable'; end if;
  update public.bed_requests set status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),
    review_notes=nullif(trim(coalesce(p_review_notes,'')),''),updated_at=now()
    where id=r.id returning * into r;
  insert into public.notifications(user_id,type,title,body,data,priority)
    values(r.patient_id,'bed_request.rejected','Bed request declined',
      coalesce(r.review_notes,'The hospital cannot accommodate this request at this time.'),
      jsonb_build_object('bed_request_id',r.id),'high');
  insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
    values(auth.uid(),'bed_request.rejected','bed_requests',r.id::text,
      jsonb_build_object('request_id',r.id,'review_notes',r.review_notes));
  return r;
end $$;

create or replace function public.assign_admission_doctor(p_admission_id uuid,p_doctor_id uuid default null)
returns public.admissions language plpgsql security definer set search_path=public as $$
declare a public.admissions%rowtype; d public.doctors%rowtype; old_doctor uuid;
begin
  select a.* into a from public.admissions a join public.hospitals h on h.id=a.hospital_id
    where a.id=p_admission_id and a.status='admitted' and (h.owner_id=auth.uid() or public.is_admin()) for update;
  if not found then raise exception 'active admission not found'; end if;
  old_doctor:=a.doctor_id;
  if p_doctor_id is not null then
    select * into d from public.doctors
      where id=p_doctor_id and hospital_id=a.hospital_id and public.doctor_verification_eligible(id) for update;
    if not found then raise exception 'doctor is not eligible for this hospital'; end if;
  end if;
  update public.admissions set doctor_id=p_doctor_id,updated_at=now() where id=a.id returning * into a;
  if p_doctor_id is not null then
    insert into public.notifications(user_id,type,title,body,data,priority)
      select d.profile_id,'inpatient.assignment','Inpatient assigned',
        a.patient_name_snapshot||' is assigned to you for inpatient care.',
        jsonb_build_object('admission_id',a.id,'hospital_id',a.hospital_id),'high';
  end if;
  insert into public.notifications(user_id,type,title,body,data,priority)
    values(a.patient_id,'inpatient.doctor_assigned',
      case when p_doctor_id is null then 'Inpatient doctor unassigned' else 'Inpatient doctor assigned' end,
      case when p_doctor_id is null then 'Your inpatient care team assignment was cleared.'
           else 'A hospital clinician has been assigned to your inpatient stay.' end,
      jsonb_build_object('admission_id',a.id,'doctor_id',p_doctor_id),'normal');
  insert into public.audit_logs(actor_id,action,table_name,record_id,old_data,new_data)
    values(auth.uid(),'admission.doctor_assigned','admissions',a.id::text,
      jsonb_build_object('doctor_id',old_doctor),jsonb_build_object('doctor_id',p_doctor_id));
  return a;
end $$;

create or replace function public.transfer_admission(p_admission_id uuid,p_target_bed_id uuid,p_reason text,p_notes text default null)
returns public.admissions language plpgsql security definer set search_path=public as $$
declare a public.admissions%rowtype; current_bed public.hospital_beds%rowtype; target_bed public.hospital_beds%rowtype; m public.admission_bed_movements%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'transfer reason is required'; end if;
  select a.* into a from public.admissions a join public.hospitals h on h.id=a.hospital_id
    where a.id=p_admission_id and a.status='admitted' and (h.owner_id=auth.uid() or public.is_admin()) for update;
  if not found then raise exception 'active admission not found'; end if;
  select * into current_bed from public.hospital_beds where id=a.bed_id for update;
  select * into target_bed from public.hospital_beds where id=p_target_bed_id and hospital_id=a.hospital_id and status='available' for update;
  if not found then raise exception 'target bed is not available'; end if;
  if target_bed.id=current_bed.id then raise exception 'target bed must differ from current bed'; end if;
  update public.hospital_beds set status='available',updated_at=now() where id=current_bed.id and status='occupied';
  update public.hospital_beds set status='occupied',updated_at=now() where id=target_bed.id and status='available';
  insert into public.admission_bed_movements(admission_id,from_bed_id,to_bed_id,moved_by,reason,notes)
    values(a.id,current_bed.id,target_bed.id,auth.uid(),trim(p_reason),nullif(trim(coalesce(p_notes,'')),''))
    returning * into m;
  update public.admissions set bed_id=target_bed.id,updated_at=now() where id=a.id returning * into a;
  insert into public.notifications(user_id,type,title,body,data,priority)
    values(a.patient_id,'inpatient.bed_transferred','Bed assignment changed',
      'Your inpatient bed assignment has been changed by the hospital.',
      jsonb_build_object('admission_id',a.id,'movement_id',m.id,'bed_id',target_bed.id),'high');
  insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
    values(auth.uid(),'admission.bed_transferred','admissions',a.id::text,
      jsonb_build_object('movement_id',m.id,'from_bed_id',current_bed.id,'to_bed_id',target_bed.id,'reason',trim(p_reason),'notes',m.notes));
  return a;
end $$;

create or replace function public.discharge_admission(p_admission_id uuid,p_discharge_notes text default null)
returns public.admissions language plpgsql security definer set search_path=public as $$
declare a public.admissions%rowtype; old_bed uuid;
begin
  select a.* into a from public.admissions a join public.hospitals h on h.id=a.hospital_id
    where a.id=p_admission_id and a.status='admitted' and (h.owner_id=auth.uid() or public.is_admin()) for update;
  if not found then raise exception 'active admission not found'; end if;
  old_bed:=a.bed_id;
  update public.hospital_beds set status='available',updated_at=now() where id=a.bed_id and status='occupied';
  update public.admissions set status='discharged',discharged_at=now(),
    discharge_notes=nullif(trim(coalesce(p_discharge_notes,'')),''),
    updated_at=now() where id=a.id returning * into a;
  insert into public.notifications(user_id,type,title,body,data,priority)
    values(a.patient_id,'inpatient.discharged','Inpatient stay discharged',
      'Your hospital admission has been marked discharged.',
      jsonb_build_object('admission_id',a.id,'bed_id',old_bed),'high');
  insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
    values(auth.uid(),'admission.discharged','admissions',a.id::text,
      jsonb_build_object('bed_id',old_bed,'discharge_notes',a.discharge_notes));
  return a;
end $$;

revoke all on function public.get_hospital_clinicians(uuid),public.reject_bed_request(uuid,text),
  public.assign_admission_doctor(uuid,uuid),public.transfer_admission(uuid,uuid,text,text),
  public.discharge_admission(uuid,text) from public,anon;
grant execute on function public.get_hospital_clinicians(uuid),public.reject_bed_request(uuid,text),
  public.assign_admission_doctor(uuid,uuid),public.transfer_admission(uuid,uuid,text,text),
  public.discharge_admission(uuid,text) to authenticated;

revoke all on table public.admission_bed_movements from public,anon,authenticated;
grant select on table public.admission_bed_movements to authenticated;

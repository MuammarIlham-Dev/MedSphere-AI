-- 0023: hospital-side appointment queue and front-desk controls.
create or replace function public.get_hospital_appointment_queue(
  p_hospital_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_include_video boolean default true
)
returns table(
  appointment_id uuid, patient_id uuid, patient_name text, patient_phone text,
  doctor_id uuid, doctor_name text, specialty text, scheduled_at timestamptz,
  duration_min int, type consultation_type, status appointment_status,
  token_number int, reason text, amount_charged numeric
)
language sql security definer stable set search_path=public as $$
  select a.id,a.patient_id,p.full_name,p.phone,a.doctor_id,dp.full_name,d.specialty,
         a.scheduled_at,a.duration_min,a.type,a.status,a.token_number,a.reason,a.amount_charged
  from public.appointments a
  join public.profiles p on p.id=a.patient_id
  join public.doctors d on d.id=a.doctor_id
  join public.profiles dp on dp.id=d.profile_id
  where a.hospital_id=p_hospital_id
    and (a.type='clinic' or p_include_video)
    and a.scheduled_at >= coalesce(p_from, date_trunc('day', now() at time zone 'Asia/Dhaka') at time zone 'Asia/Dhaka')
    and a.scheduled_at < coalesce(p_to, ((date_trunc('day', now() at time zone 'Asia/Dhaka') + interval '1 day') at time zone 'Asia/Dhaka'))
    and exists(select 1 from public.hospitals h where h.id=p_hospital_id and (h.owner_id=auth.uid() or public.is_admin()))
  order by a.scheduled_at,a.token_number,a.created_at
$$;

create or replace function public.hospital_confirm_appointment(p_appointment_id uuid)
returns public.appointments
language plpgsql security definer set search_path=public as $$
declare a public.appointments%rowtype;
begin
  select a.* into a from public.appointments a
  where a.id=p_appointment_id
    and exists(select 1 from public.hospitals h where h.id=a.hospital_id and (h.owner_id=auth.uid() or public.is_admin()))
  for update;
  if not found then raise exception 'appointment not found or unauthorized'; end if;
  if a.status<>'booked' then raise exception 'only booked appointments can be confirmed by hospital operations'; end if;
  update public.appointments set status='confirmed' where id=a.id returning * into a;
  insert into public.notifications(user_id,type,title,body,data,priority)
    values(a.patient_id,'appointment.confirmed','Appointment confirmed','Your hospital appointment has been confirmed.',jsonb_build_object('appointment_id',a.id),'normal');
  insert into public.notifications(user_id,type,title,body,data,priority)
    select d.profile_id,'appointment.confirmed','Appointment confirmed','An appointment at your hospital has been confirmed.',jsonb_build_object('appointment_id',a.id),'normal'
    from public.doctors d where d.id=a.doctor_id;
  insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
    values(auth.uid(),'appointment.hospital_confirmed','appointments',a.id::text,jsonb_build_object('status','confirmed','hospital_id',a.hospital_id));
  return a;
end $$;

create or replace function public.hospital_check_in_appointment(p_appointment_id uuid)
returns public.appointments
language plpgsql security definer set search_path=public as $$
declare a public.appointments%rowtype;
begin
  select a.* into a from public.appointments a
  where a.id=p_appointment_id and a.type='clinic'
    and exists(select 1 from public.hospitals h where h.id=a.hospital_id and (h.owner_id=auth.uid() or public.is_admin()))
  for update;
  if not found then raise exception 'clinic appointment not found or unauthorized'; end if;
  if a.status not in('confirmed','booked') then raise exception 'appointment is not eligible for check-in'; end if;
  update public.appointments set status='checked_in' where id=a.id returning * into a;
  insert into public.notifications(user_id,type,title,body,data,priority)
    values(a.patient_id,'appointment.checked_in','Check-in complete','You have been checked in for your hospital appointment.',jsonb_build_object('appointment_id',a.id,'token_number',a.token_number),'normal');
  insert into public.notifications(user_id,type,title,body,data,priority)
    select d.profile_id,'appointment.patient_checked_in','Patient checked in','A patient has checked in for your clinic appointment.',jsonb_build_object('appointment_id',a.id,'token_number',a.token_number),'high'
    from public.doctors d where d.id=a.doctor_id;
  insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
    values(auth.uid(),'appointment.hospital_checked_in','appointments',a.id::text,jsonb_build_object('status','checked_in','hospital_id',a.hospital_id));
  return a;
end $$;

create or replace function public.hospital_mark_no_show(p_appointment_id uuid,p_reason text default null)
returns public.appointments
language plpgsql security definer set search_path=public as $$
declare a public.appointments%rowtype;
begin
  select a.* into a from public.appointments a
  where a.id=p_appointment_id
    and exists(select 1 from public.hospitals h where h.id=a.hospital_id and (h.owner_id=auth.uid() or public.is_admin()))
  for update;
  if not found then raise exception 'appointment not found or unauthorized'; end if;
  if now() < a.scheduled_at then raise exception 'cannot mark no-show before appointment time'; end if;
  if a.status not in('confirmed','checked_in') then raise exception 'appointment is not eligible for no-show'; end if;
  update public.appointments set status='no_show',cancel_reason=coalesce(nullif(trim(p_reason),''),cancel_reason)
    where id=a.id returning * into a;
  insert into public.notifications(user_id,type,title,body,data,priority)
    values(a.patient_id,'appointment.no_show','Appointment marked no-show','Your hospital appointment was marked as no-show.',jsonb_build_object('appointment_id',a.id),'high');
  insert into public.notifications(user_id,type,title,body,data,priority)
    select d.profile_id,'appointment.no_show','Patient marked no-show','A patient did not attend the scheduled hospital appointment.',jsonb_build_object('appointment_id',a.id),'normal'
    from public.doctors d where d.id=a.doctor_id;
  insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
    values(auth.uid(),'appointment.hospital_no_show','appointments',a.id::text,jsonb_build_object('status','no_show','reason',nullif(trim(p_reason),''),'hospital_id',a.hospital_id));
  return a;
end $$;

revoke all on function public.get_hospital_appointment_queue(uuid,timestamptz,timestamptz,boolean),
  public.hospital_confirm_appointment(uuid),public.hospital_check_in_appointment(uuid),
  public.hospital_mark_no_show(uuid,text) from public,anon;
grant execute on function public.get_hospital_appointment_queue(uuid,timestamptz,timestamptz,boolean),
  public.hospital_confirm_appointment(uuid),public.hospital_check_in_appointment(uuid),
  public.hospital_mark_no_show(uuid,text) to authenticated;

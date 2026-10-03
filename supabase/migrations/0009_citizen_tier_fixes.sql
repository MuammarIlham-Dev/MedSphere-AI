-- Migration 0009: Citizen-Tier Blocker Fixes

-- 1. Organ Donation Consent Integrity
-- Create atomic RPC for updating consent that bypasses the rigid RLS
create or replace function public.update_organ_consent(
  p_donor_id uuid,
  p_consent consent_status,
  p_file_id uuid default null
) returns public.organ_donors
language plpgsql security definer set search_path = public as $$
declare
  result public.organ_donors;
begin
  if p_consent = 'granted' and p_file_id is null then
    raise exception 'Consent file ID is required when granting consent';
  end if;

  update public.organ_donors
  set consent = p_consent,
      consent_file_id = coalesce(p_file_id, consent_file_id),
      status = case when p_consent = 'withdrawn' then 'inactive'::party_status else status end
  where id = p_donor_id and profile_id = auth.uid()
  returning * into result;

  if not found then
    raise exception 'Donor profile not found or unauthorized';
  end if;

  return result;
end $$;

revoke all on function public.update_organ_consent(uuid, consent_status, uuid) from public;
grant execute on function public.update_organ_consent(uuid, consent_status, uuid) to authenticated;


-- 2. Blood-network RLS Fix
-- Allow citizens to read their own donor profile
drop policy if exists blood_donors_read on public.blood_donors;
create policy blood_donors_read on public.blood_donors for select using (
  profile_id = auth.uid() or public.is_admin() or public.current_role() in ('hospital', 'blood_bank')
);


-- 3. Emergency SOS Atomic Duplicate Prevention
-- Create an atomic RPC that checks for existing active emergencies before inserting
create or replace function public.trigger_emergency_sos(
  p_lat double precision,
  p_lng double precision,
  p_type text default 'medical'
) returns public.emergencies
language plpgsql security definer set search_path = public as $$
declare
  result public.emergencies;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- Lock the reporter's emergency creation path
  perform pg_advisory_xact_lock(hashtextextended('sos_' || auth.uid()::text, 0));

  select * into result from public.emergencies 
  where reporter_id = auth.uid() and status = 'active'
  limit 1;

  if found then
    return result;
  end if;

  insert into public.emergencies (reporter_id, type, status, lat, lng)
  values (auth.uid(), p_type, 'active', p_lat, p_lng)
  returning * into result;

  return result;
end $$;

revoke all on function public.trigger_emergency_sos(double precision, double precision, text) from public;
grant execute on function public.trigger_emergency_sos(double precision, double precision, text) to authenticated;


-- 5. Appointment Timezone/Schedule Consistency
-- Redefine book_appointment to use Asia/Dhaka instead of utc
create or replace function public.book_appointment(
  p_doctor_id uuid,
  p_hospital_id uuid,
  p_scheduled_at timestamptz,
  p_duration_min int,
  p_type consultation_type,
  p_reason text default null
) returns public.appointments
language plpgsql security definer set search_path = public as $$
declare
  result public.appointments;
  next_token int;
  -- Use canonical timezone instead of UTC
  requested_day date := (p_scheduled_at at time zone 'Asia/Dhaka')::date;
  requested_time time := (p_scheduled_at at time zone 'Asia/Dhaka')::time;
  requested_dow int := extract(dow from p_scheduled_at at time zone 'Asia/Dhaka');
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_scheduled_at <= now() then raise exception 'appointment must be in the future'; end if;
  if p_duration_min not between 5 and 120 then raise exception 'invalid duration'; end if;

  if not exists (
    select 1 from public.doctors d
    where d.id = p_doctor_id and d.verification = 'verified'
      and (p_hospital_id is null or d.hospital_id = p_hospital_id)
      and ((p_type = 'video' and d.video_enabled) or (p_type = 'clinic' and d.clinic_enabled))
  ) then raise exception 'doctor is unavailable for this consultation'; end if;

  if not exists (
    select 1 from public.doctor_schedules s
    where s.doctor_id = p_doctor_id and s.is_active and s.type = p_type
      and s.weekday = requested_dow
      and requested_time >= s.start_time
      and requested_time + make_interval(mins => p_duration_min) <= s.end_time
      and mod(extract(epoch from (requested_time - s.start_time))::int / 60, s.slot_minutes) = 0
  ) then raise exception 'requested time is outside the doctor schedule'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_doctor_id::text || requested_day::text, 0));

  if exists (
    select 1 from public.appointments a
    where a.doctor_id = p_doctor_id
      and a.status not in ('cancelled', 'no_show')
      and tstzrange(a.scheduled_at, a.scheduled_at + make_interval(mins => a.duration_min), '[)')
          && tstzrange(p_scheduled_at, p_scheduled_at + make_interval(mins => p_duration_min), '[)')
  ) then raise exception 'this appointment slot is no longer available'; end if;

  select coalesce(max(token_number), 0) + 1 into next_token
  from public.appointments where doctor_id = p_doctor_id and day = requested_day;

  insert into public.appointments (
    patient_id, doctor_id, hospital_id, scheduled_at, duration_min, type, status, token_number, reason
  ) values (
    auth.uid(), p_doctor_id, p_hospital_id, p_scheduled_at, p_duration_min, p_type, 'booked', next_token, nullif(trim(p_reason), '')
  ) returning * into result;

  return result;
end $$;

-- Drop and recreate the `day` generated column on `appointments` to use Asia/Dhaka
alter table public.appointments drop column if exists day;
alter table public.appointments add column day date generated always as ((scheduled_at at time zone 'Asia/Dhaka')::date) stored;

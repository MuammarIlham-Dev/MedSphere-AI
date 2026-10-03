-- Migration 0007: production workflow hardening

-- Self-service registration must never grant operational privileges.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, full_name, phone, digital_health_id)
  values (
    new.id,
    'citizen',
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.phone,
    'MSH-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  );
  return new;
end $$;

-- Prevent owners from approving themselves or changing residency/security fields.
create or replace function public.protect_managed_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;

  if tg_table_name = 'profiles' then
    new.role := old.role;
    new.region_id := old.region_id;
    new.digital_health_id := old.digital_health_id;
    new.mfa_enabled := old.mfa_enabled;
  elsif tg_table_name in ('doctors', 'hospitals', 'pharmacies', 'laboratories', 'blood_banks') then
    new.verification := old.verification;
    if to_jsonb(new)->>'owner_id' is distinct from to_jsonb(old)->>'owner_id'
       or to_jsonb(new)->>'profile_id' is distinct from to_jsonb(old)->>'profile_id' then
      raise exception 'ownership fields are administrator-managed';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists protect_profile_managed_fields on public.profiles;
create trigger protect_profile_managed_fields before update on public.profiles
for each row execute function public.protect_managed_fields();

do $$
declare table_name text;
begin
  foreach table_name in array array['doctors', 'hospitals', 'pharmacies', 'laboratories', 'blood_banks'] loop
    execute format('drop trigger if exists protect_managed_fields on public.%I', table_name);
    execute format('create trigger protect_managed_fields before update on public.%I for each row execute function public.protect_managed_fields()', table_name);
  end loop;
end $$;

-- Automatically downgrade doctors to pending if specialty or license_no changes
create or replace function public.protect_doctor_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  
  if old.verification = 'verified' and (new.specialty is distinct from old.specialty or new.license_no is distinct from old.license_no) then
    new.verification := 'pending';
  end if;
  
  return new;
end $$;

drop trigger if exists protect_doctor_fields on public.doctors;
create trigger protect_doctor_fields before update on public.doctors
for each row execute function public.protect_doctor_fields();

-- Restore the clinical policies lost when medical_records became partitioned.
drop policy if exists "Data Residency: Regional Read Access" on public.medical_records;
drop policy if exists records_read on public.medical_records;
drop policy if exists records_write on public.medical_records;
create policy records_read on public.medical_records for select using (
  patient_id = auth.uid()
  or public.is_admin()
  or (
    public.current_role() = 'doctor'
    and public.is_treating_doctor(patient_id, (select id from public.doctors where profile_id = auth.uid()))
  )
);
create policy records_write on public.medical_records for insert with check (
  public.current_role() = 'doctor'
  and doctor_id = (select id from public.doctors where profile_id = auth.uid())
  and public.is_treating_doctor(patient_id, doctor_id)
  and region_id = coalesce((select region_id from public.profiles where id = patient_id), 'national')
);

-- Allocate appointment tokens atomically and validate the requested slot.
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
  requested_day date := (p_scheduled_at at time zone 'utc')::date;
  requested_time time := (p_scheduled_at at time zone 'utc')::time;
  requested_dow int := extract(dow from p_scheduled_at at time zone 'utc');
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

revoke all on function public.book_appointment(uuid, uuid, timestamptz, int, consultation_type, text) from public;
grant execute on function public.book_appointment(uuid, uuid, timestamptz, int, consultation_type, text) to authenticated;
drop policy if exists appointments_insert on public.appointments;

-- Enforce appointment state transitions and actor permissions server-side.
create or replace function public.transition_appointment(
  p_appointment_id uuid,
  p_status appointment_status,
  p_reason text default null
) returns public.appointments
language plpgsql security definer set search_path = public as $$
declare current_row public.appointments; result public.appointments; caller_doctor uuid;
begin
  select * into current_row from public.appointments where id = p_appointment_id for update;
  if not found then raise exception 'appointment not found'; end if;
  select id into caller_doctor from public.doctors where profile_id = auth.uid();

  if p_status = 'cancelled' then
    if auth.uid() <> current_row.patient_id and caller_doctor is distinct from current_row.doctor_id and not public.is_admin() then
      raise exception 'forbidden';
    end if;
  elsif caller_doctor is distinct from current_row.doctor_id and not public.is_admin() then
    raise exception 'only the assigned doctor can advance this appointment';
  end if;

  if not (
    (current_row.status = 'booked' and p_status in ('confirmed', 'cancelled', 'rescheduled'))
    or (current_row.status = 'confirmed' and p_status in ('checked_in', 'cancelled', 'rescheduled', 'no_show'))
    or (current_row.status = 'checked_in' and p_status in ('in_progress', 'cancelled', 'no_show'))
    or (current_row.status = 'in_progress' and p_status = 'completed')
  ) then raise exception 'invalid appointment status transition'; end if;

  update public.appointments
  set status = p_status,
      cancel_reason = case when p_status = 'cancelled' then nullif(trim(p_reason), '') else cancel_reason end
  where id = p_appointment_id returning * into result;
  return result;
end $$;

revoke all on function public.transition_appointment(uuid, appointment_status, text) from public;
grant execute on function public.transition_appointment(uuid, appointment_status, text) to authenticated;
drop policy if exists appointments_update on public.appointments;

-- Persist a consultation note and optional free-text prescription in one authorized transaction.
drop function if exists public.record_consultation(uuid, text, text, text, text);
create or replace function public.record_consultation(
  p_appointment_id uuid,
  p_title text,
  p_diagnosis text,
  p_notes text,
  p_prescription_notes text default null,
  p_prescription_items jsonb default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare appt public.appointments; caller_doctor uuid; record_id uuid; rx_id uuid; item jsonb;
begin
  select id into caller_doctor from public.doctors where profile_id = auth.uid() and verification = 'verified';
  if caller_doctor is null then raise exception 'verified doctor required'; end if;

  select * into appt from public.appointments where id = p_appointment_id and doctor_id = caller_doctor for update;
  if not found or appt.status not in ('confirmed', 'checked_in', 'in_progress', 'completed') then
    raise exception 'an active treatment relationship is required';
  end if;
  if nullif(trim(p_title), '') is null then raise exception 'record title is required'; end if;

  insert into public.medical_records (
    patient_id, doctor_id, appointment_id, type, title, diagnosis, notes, region_id
  ) values (
    appt.patient_id, caller_doctor, appt.id, 'consultation', trim(p_title), nullif(trim(p_diagnosis), ''),
    nullif(trim(p_notes), ''), coalesce((select region_id from public.profiles where id = appt.patient_id), 'national')
  ) returning id into record_id;

  if nullif(trim(p_prescription_notes), '') is not null or (p_prescription_items is not null and jsonb_array_length(p_prescription_items) > 0) then
    insert into public.prescriptions (appointment_id, patient_id, doctor_id, notes)
    values (appt.id, appt.patient_id, caller_doctor, trim(p_prescription_notes))
    returning id into rx_id;
    
    if p_prescription_items is not null and jsonb_typeof(p_prescription_items) = 'array' then
      for item in select * from jsonb_array_elements(p_prescription_items) loop
        insert into public.prescription_items (prescription_id, medicine_id, dosage, frequency, duration_days, instructions)
        values (
          rx_id,
          (item->>'medicine_id')::uuid,
          item->>'dosage',
          item->>'frequency',
          (item->>'duration_days')::int,
          item->>'instructions'
        );
      end loop;
    end if;
  end if;

  return record_id;
end $$;

revoke all on function public.record_consultation(uuid, text, text, text, text, jsonb) from public;
grant execute on function public.record_consultation(uuid, text, text, text, text, jsonb) to authenticated;

-- Compute recipient priority from NEW values rather than stale table state.
create or replace function public.refresh_recipient_priority() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.priority_score := least(100,
    (case new.urgency when 'critical' then 60 when 'high' then 40 when 'standard' then 20 else 10 end)
    + least(20, greatest(0, extract(month from age(current_date, new.waiting_since))::int * 2))
    + (case when new.age is not null and new.age < 18 then 10
            when new.age is not null and new.age > 65 then 5 else 0 end));
  return new;
end $$;

create or replace function public.run_organ_matching(p_donor uuid)
returns int language plpgsql security definer set search_path = public as $$
declare d public.organ_donors; r record; o organ_type; n int := 0; m record;
begin
  if public.current_role() not in ('organ_authority', 'hospital', 'admin', 'super_admin') then
    raise exception 'forbidden';
  end if;
  select * into d from public.organ_donors
  where id = p_donor and status = 'active' and consent = 'granted'
    and consent_file_id is not null and medical_eligibility is not null;
  if not found then raise exception 'donor is not consented and clinically eligible'; end if;

  foreach o in array d.organs loop
    for r in select * from public.organ_recipients
      where organ_needed = o and status = 'waiting'
        and public.blood_compatible(d.blood_group, blood_group)
    loop
      select * into m from public.score_organ_match(d.id, r.id);
      insert into public.organ_matches
        (donor_id, recipient_id, organ, compatibility_score, blood_compatible, hla_score, distance_km)
      values (d.id, r.id, o, m.score, m.blood_ok, m.hla, m.distance_km)
      on conflict (donor_id, recipient_id, organ) do update set
        compatibility_score = excluded.compatibility_score,
        blood_compatible = excluded.blood_compatible,
        hla_score = excluded.hla_score,
        distance_km = excluded.distance_km;
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;

revoke all on function public.score_organ_match(uuid, uuid) from public;
revoke all on function public.run_organ_matching(uuid) from public;
grant execute on function public.score_organ_match(uuid, uuid) to authenticated;
grant execute on function public.run_organ_matching(uuid) to authenticated;

-- Inventory invariants must hold even when writes originate outside the UI.
alter table public.blood_inventory drop constraint if exists blood_inventory_reservation_check;
alter table public.blood_inventory add constraint blood_inventory_reservation_check
check (units_reserved <= units_available);

-- Private clinical objects are owner-only until a case-specific access function issues a signed URL.
drop policy if exists storage_own_read on storage.objects;
create policy storage_own_read on storage.objects for select using (
  bucket_id in ('documents', 'reports', 'consent')
  and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
);

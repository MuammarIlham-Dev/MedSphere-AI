-- 0011_doctor_tier_corrections.sql

-- 1. Schedule Deduplication & Uniqueness
-- Delete duplicate schedules keeping the most recently updated active one.
WITH duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY doctor_id, weekday, type
               ORDER BY is_active DESC, id DESC
           ) as row_num
    FROM public.doctor_schedules
)
DELETE FROM public.doctor_schedules
WHERE id IN (SELECT id FROM duplicates WHERE row_num > 1);

-- Drop any previous unique constraints on doctor_schedules and add the correct one.
ALTER TABLE public.doctor_schedules 
    DROP CONSTRAINT IF EXISTS doctor_schedules_doctor_id_weekday_key;
ALTER TABLE public.doctor_schedules
    DROP CONSTRAINT IF EXISTS doctor_schedules_doctor_id_weekday_type_key;

ALTER TABLE public.doctor_schedules
    ADD CONSTRAINT doctor_schedules_doctor_id_weekday_type_key UNIQUE (doctor_id, weekday, type);

-- 2. Protect Doctor Fields & Secure Ratings
CREATE OR REPLACE FUNCTION public.protect_doctor_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Handle rating updates securely using a local transaction variable
  IF (NEW.rating_avg IS DISTINCT FROM OLD.rating_avg OR NEW.rating_count IS DISTINCT FROM OLD.rating_count) THEN
    IF current_setting('medsphere.internal_update', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Doctor ratings are managed automatically and cannot be modified directly';
    END IF;
  END IF;

  -- Protect core verification fields by resetting status if changed by non-admin
  IF current_user != 'supabase_admin' THEN
    IF (NEW.specialty IS DISTINCT FROM OLD.specialty) OR
       (NEW.license_no IS DISTINCT FROM OLD.license_no) OR
       (NEW.qualifications IS DISTINCT FROM OLD.qualifications) OR
       (NEW.hospital_id IS DISTINCT FROM OLD.hospital_id) OR
       (NEW.experience_years IS DISTINCT FROM OLD.experience_years) THEN
      
      NEW.verification = 'pending';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_doctor_fields ON public.doctors;
CREATE TRIGGER tr_protect_doctor_fields
BEFORE UPDATE ON public.doctors
FOR EACH ROW
EXECUTE FUNCTION public.protect_doctor_fields();

-- Trigger to calculate ratings on feedback and apply to doctors securely
CREATE OR REPLACE FUNCTION public.update_doctor_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_doctor_id uuid;
  v_avg numeric;
  v_count integer;
BEGIN
  -- Get the doctor ID for this feedback
  IF TG_OP = 'DELETE' THEN
    SELECT doctor_id INTO v_doctor_id FROM public.appointments WHERE id = OLD.appointment_id;
  ELSE
    SELECT doctor_id INTO v_doctor_id FROM public.appointments WHERE id = NEW.appointment_id;
  END IF;

  IF v_doctor_id IS NOT NULL THEN
    -- Calculate new average and count
    SELECT 
      COALESCE(AVG(rating)::numeric(3,2), 0.00),
      COUNT(id)
    INTO v_avg, v_count
    FROM public.appointment_feedback af
    JOIN public.appointments a ON a.id = af.appointment_id
    WHERE a.doctor_id = v_doctor_id;

    -- Securely update the doctor record
    PERFORM set_config('medsphere.internal_update', 'true', true);
    UPDATE public.doctors
    SET rating_avg = v_avg, rating_count = v_count
    WHERE id = v_doctor_id;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS tr_update_doctor_rating ON public.appointment_feedback;
CREATE TRIGGER tr_update_doctor_rating
AFTER INSERT OR UPDATE OF rating OR DELETE ON public.appointment_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_doctor_rating();

-- 3. Add amount_charged column to appointments (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'amount_charged') THEN
    ALTER TABLE public.appointments ADD COLUMN amount_charged numeric(10,2);
  END IF;
END $$;

-- 4. Freeze amount_charged
CREATE OR REPLACE FUNCTION public.freeze_amount_charged()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.amount_charged IS NOT NULL AND NEW.amount_charged IS DISTINCT FROM OLD.amount_charged THEN
    RAISE EXCEPTION 'amount_charged is immutable once set';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_freeze_amount_charged ON public.appointments;
CREATE TRIGGER tr_freeze_amount_charged
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.freeze_amount_charged();

-- 5. Backfill existing appointments amount_charged
UPDATE public.appointments a
SET amount_charged = (SELECT consultation_fee FROM public.doctors d WHERE d.id = a.doctor_id)
WHERE a.amount_charged IS NULL;

-- 6. Clean up overloaded functions from previous incorrect migrations
DROP FUNCTION IF EXISTS public.book_appointment(uuid, uuid, timestamptz, integer, text, text, text[]);
DROP FUNCTION IF EXISTS public.record_consultation(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.record_consultation(uuid, text, text, text, jsonb);

-- 7. Book Appointment - Asia/Dhaka timezone + 0007 logic + amount_charged
CREATE OR REPLACE FUNCTION public.book_appointment(
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
  requested_day date := (p_scheduled_at at time zone 'Asia/Dhaka')::date;
  requested_time time := (p_scheduled_at at time zone 'Asia/Dhaka')::time;
  requested_dow int := extract(dow from p_scheduled_at at time zone 'Asia/Dhaka');
  v_doctor_fee numeric(10,2);
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_scheduled_at <= now() then raise exception 'appointment must be in the future'; end if;
  if p_duration_min not between 5 and 120 then raise exception 'invalid duration'; end if;

  select consultation_fee into v_doctor_fee
  from public.doctors d
  where d.id = p_doctor_id and d.verification = 'verified'
    and (p_hospital_id is null or d.hospital_id = p_hospital_id)
    and ((p_type = 'video' and d.video_enabled) or (p_type = 'clinic' and d.clinic_enabled));

  if not found then raise exception 'doctor is unavailable for this consultation'; end if;

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
    patient_id, doctor_id, hospital_id, scheduled_at, duration_min, type, status, token_number, reason, amount_charged
  ) values (
    auth.uid(), p_doctor_id, p_hospital_id, p_scheduled_at, p_duration_min, p_type, 'booked', next_token, nullif(trim(p_reason), ''), v_doctor_fee
  ) returning * into result;

  return result;
end $$;

revoke all on function public.book_appointment(uuid, uuid, timestamptz, int, consultation_type, text) from public;
grant execute on function public.book_appointment(uuid, uuid, timestamptz, int, consultation_type, text) to authenticated;

-- 8. Restore record_consultation Security Checks matching 0007 architecture + JSONB prescriptions
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
    patient_id, doctor_id, appointment_id, type, title, diagnosis, notes
  ) values (
    appt.patient_id, caller_doctor, appt.id, 'consultation', trim(p_title), nullif(trim(p_diagnosis), ''),
    nullif(trim(p_notes), '')
  ) returning id into record_id;

  if nullif(trim(p_prescription_notes), '') is not null or (p_prescription_items is not null and jsonb_array_length(p_prescription_items) > 0) then
    insert into public.prescriptions (appointment_id, patient_id, doctor_id, notes)
    values (appt.id, appt.patient_id, caller_doctor, nullif(trim(p_prescription_notes), ''))
    returning id into rx_id;

    if p_prescription_items is not null then
      for item in select * from jsonb_array_elements(p_prescription_items) loop
        insert into public.prescription_items (
          prescription_id, medicine_id, custom_medicine_name, dosage, frequency, duration_days, instructions
        ) values (
          rx_id,
          nullif(trim(item->>'medicine_id'), '')::uuid,
          nullif(trim(item->>'custom_medicine_name'), ''),
          nullif(trim(item->>'dosage'), ''),
          nullif(trim(item->>'frequency'), ''),
          (item->>'duration_days')::int,
          nullif(trim(item->>'instructions'), '')
        );
      end loop;
    end if;
  end if;
  
  -- Update appointment status to completed if it's currently in progress
  update public.appointments set status = 'completed' where id = p_appointment_id and status = 'in_progress';

  return record_id;
end $$;

revoke all on function public.record_consultation(uuid, text, text, text, text, jsonb) from public;
grant execute on function public.record_consultation(uuid, text, text, text, text, jsonb) to authenticated;


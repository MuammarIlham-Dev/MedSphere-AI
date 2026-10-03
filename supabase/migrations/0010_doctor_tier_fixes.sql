-- Add unique constraint for schedules
ALTER TABLE public.doctor_schedules DROP CONSTRAINT IF EXISTS doctor_schedules_doctor_id_weekday_key;
ALTER TABLE public.doctor_schedules DROP CONSTRAINT IF EXISTS doctor_schedules_doctor_id_weekday_type_key;
ALTER TABLE public.doctor_schedules ADD CONSTRAINT doctor_schedules_doctor_id_weekday_type_key UNIQUE (doctor_id, weekday, type);

-- Add amount_charged to appointments for truthful analytics
ALTER TABLE public.appointments 
  ADD COLUMN amount_charged numeric(10,2);

-- Redefine protect_doctor_fields to cover all professional fields
CREATE OR REPLACE FUNCTION public.protect_doctor_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (
    NEW.specialty IS DISTINCT FROM OLD.specialty OR
    NEW.license_no IS DISTINCT FROM OLD.license_no OR
    NEW.qualifications IS DISTINCT FROM OLD.qualifications OR
    NEW.hospital_id IS DISTINCT FROM OLD.hospital_id OR
    NEW.experience_years IS DISTINCT FROM OLD.experience_years
  ) THEN
    NEW.verification = 'pending';
  END IF;
  
  -- Prevent manual updates to ratings unless by system
  IF (NEW.rating_avg IS DISTINCT FROM OLD.rating_avg OR NEW.rating_count IS DISTINCT FROM OLD.rating_count) THEN
    IF current_user != 'supabase_admin' THEN
      RAISE EXCEPTION 'Ratings are managed automatically and cannot be manually updated.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Redefine book_appointment to capture amount_charged from doctor's current consultation_fee
-- and preserve ALL existing security + schedule + overlap validations from 0007.
CREATE OR REPLACE FUNCTION public.book_appointment(
  p_doctor_id uuid,
  p_hospital_id uuid,
  p_scheduled_at timestamptz,
  p_duration_min int,
  p_type consultation_type,
  p_reason text default null
) RETURNS public.appointments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result public.appointments;
  next_token int;
  requested_day date := (p_scheduled_at at time zone 'utc')::date;
  requested_time time := (p_scheduled_at at time zone 'utc')::time;
  requested_dow int := extract(dow from p_scheduled_at at time zone 'utc');
  doc_fee numeric(10,2);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_scheduled_at <= now() THEN RAISE EXCEPTION 'appointment must be in the future'; END IF;
  IF p_duration_min NOT BETWEEN 5 AND 120 THEN RAISE EXCEPTION 'invalid duration'; END IF;

  SELECT consultation_fee INTO doc_fee FROM public.doctors WHERE id = p_doctor_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.doctors d
    WHERE d.id = p_doctor_id AND d.verification = 'verified'
      AND (p_hospital_id IS NULL OR d.hospital_id = p_hospital_id)
      AND ((p_type = 'video' AND d.video_enabled) OR (p_type = 'clinic' AND d.clinic_enabled))
  ) THEN RAISE EXCEPTION 'doctor is unavailable for this consultation'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.doctor_schedules s
    WHERE s.doctor_id = p_doctor_id AND s.is_active AND s.type = p_type
      AND s.weekday = requested_dow
      AND requested_time >= s.start_time
      AND requested_time + make_interval(mins => p_duration_min) <= s.end_time
      AND mod(extract(epoch from (requested_time - s.start_time))::int / 60, s.slot_minutes) = 0
  ) THEN RAISE EXCEPTION 'requested time is outside the doctor schedule'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_doctor_id::text || requested_day::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.doctor_id = p_doctor_id
      AND a.status NOT IN ('cancelled', 'no_show')
      AND tstzrange(a.scheduled_at, a.scheduled_at + make_interval(mins => a.duration_min), '[)')
          && tstzrange(p_scheduled_at, p_scheduled_at + make_interval(mins => p_duration_min), '[)')
  ) THEN RAISE EXCEPTION 'this appointment slot is no longer available'; END IF;

  SELECT COALESCE(MAX(token_number), 0) + 1 INTO next_token
  FROM public.appointments WHERE doctor_id = p_doctor_id AND day = requested_day;

  INSERT INTO public.appointments (
    patient_id, doctor_id, hospital_id, scheduled_at, duration_min, type, status, token_number, reason, amount_charged
  ) VALUES (
    (SELECT id FROM public.profiles WHERE id = auth.uid()), p_doctor_id, p_hospital_id, p_scheduled_at, p_duration_min, p_type, 'booked', next_token, nullif(trim(p_reason), ''), doc_fee
  ) RETURNING * INTO result;

  RETURN result;
END;
$$;

-- Redefine record_consultation using JSONB for prescription items
CREATE OR REPLACE FUNCTION public.record_consultation(
  p_appointment_id uuid,
  p_title text,
  p_diagnosis text,
  p_notes text,
  p_prescription_notes text default null,
  p_prescription_items jsonb default null
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_patient_id uuid;
  v_doctor_id uuid;
  v_record_id uuid;
  v_prescription_id uuid;
  item jsonb;
BEGIN
  -- 1. Validate appointment & ownership
  SELECT patient_id, doctor_id INTO v_patient_id, v_doctor_id
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  IF v_doctor_id != (SELECT id FROM public.doctors WHERE profile_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only the assigned doctor can record consultation';
  END IF;

  -- 2. Create medical record
  INSERT INTO public.medical_records (
    patient_id, doctor_id, appointment_id, title, diagnosis, notes
  ) VALUES (
    v_patient_id, v_doctor_id, p_appointment_id, p_title, p_diagnosis, p_notes
  ) RETURNING id INTO v_record_id;

  -- 3. Create prescription and items if provided
  IF p_prescription_items IS NOT NULL AND jsonb_array_length(p_prescription_items) > 0 THEN
    INSERT INTO public.prescriptions (
      patient_id, doctor_id, appointment_id, notes
    ) VALUES (
      v_patient_id, v_doctor_id, p_appointment_id, p_prescription_notes
    ) RETURNING id INTO v_prescription_id;

    FOR item IN SELECT * FROM jsonb_array_elements(p_prescription_items)
    LOOP
      INSERT INTO public.prescription_items (
        prescription_id, medicine_id, dosage, frequency, duration_days, instructions
      ) VALUES (
        v_prescription_id,
        (item->>'medicine_id')::uuid,
        item->>'dosage',
        item->>'frequency',
        (item->>'duration_days')::int,
        item->>'instructions'
      );
    END LOOP;
  END IF;

  -- 4. Mark appointment as completed
  UPDATE public.appointments
  SET status = 'completed'
  WHERE id = p_appointment_id;

  RETURN v_record_id;
END;
$$;

-- Drop and recreate prescriptions_read policy to allow treating doctors
DROP POLICY IF EXISTS prescriptions_read ON public.prescriptions;
CREATE POLICY prescriptions_read ON public.prescriptions FOR SELECT USING (
  patient_id = auth.uid() 
  OR public.is_admin()
  OR (
    public.current_role() = 'doctor'
    AND public.is_treating_doctor(patient_id, (SELECT id FROM public.doctors WHERE profile_id = auth.uid()))
  )
  OR public.current_role() = 'pharmacy'
);

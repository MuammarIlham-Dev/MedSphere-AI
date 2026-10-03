-- 0011_doctor_tier_corrections.sql

-- 1. Schedule Deduplication & Uniqueness
-- Delete duplicate schedules keeping the most recently updated active one.
WITH duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY doctor_id, weekday, type
               ORDER BY is_active DESC, updated_at DESC
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
    IF current_setting('medsphere.internal_update', true) != 'true' THEN
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


-- 3. Freeze amount_charged
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

-- 4. Backfill existing appointments amount_charged
UPDATE public.appointments a
SET amount_charged = (SELECT consultation_fee FROM public.doctors d WHERE d.id = a.doctor_id)
WHERE a.amount_charged IS NULL;

-- 5. Book Appointment - Asia/Dhaka timezone
CREATE OR REPLACE FUNCTION public.book_appointment(
  p_doctor_id uuid,
  p_hospital_id uuid,
  p_scheduled_at timestamptz,
  p_duration_min integer,
  p_type text,
  p_reason text,
  p_symptoms text[] DEFAULT NULL
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_patient_id uuid;
  v_doctor_fee numeric(10,2);
  v_doc_status text;
  v_weekday integer;
  v_time time;
  v_schedule record;
  v_overlap boolean;
  v_appointment public.appointments;
BEGIN
  -- 1. Identify patient
  SELECT id INTO v_patient_id FROM public.patients WHERE profile_id = auth.uid();
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User is not a registered patient';
  END IF;

  -- 2. Verify doctor and get fee
  SELECT verification, consultation_fee INTO v_doc_status, v_doctor_fee 
  FROM public.doctors 
  WHERE id = p_doctor_id;
  
  IF v_doc_status != 'verified' THEN
    RAISE EXCEPTION 'Doctor is unavailable for this consultation';
  END IF;

  -- 3. Extract Schedule Dimensions using Asia/Dhaka timezone
  v_weekday := EXTRACT(DOW FROM (p_scheduled_at AT TIME ZONE 'Asia/Dhaka'));
  v_time := (p_scheduled_at AT TIME ZONE 'Asia/Dhaka')::time;

  -- 4. Validate schedule bounds
  SELECT * INTO v_schedule
  FROM public.doctor_schedules
  WHERE doctor_id = p_doctor_id
    AND weekday = v_weekday
    AND type = p_type
    AND is_active = true
    AND v_time >= start_time
    AND (v_time + (p_duration_min || ' minutes')::interval) <= end_time;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected time slot is outside of valid operating hours or schedule is inactive';
  END IF;

  IF p_duration_min != v_schedule.slot_minutes THEN
    RAISE EXCEPTION 'Invalid appointment duration for this schedule';
  END IF;

  -- 5. Concurrency lock on the schedule row
  PERFORM 1 FROM public.doctor_schedules WHERE id = v_schedule.id FOR UPDATE;

  -- 6. Check for precise overlaps
  SELECT EXISTS (
    SELECT 1 FROM public.appointments
    WHERE doctor_id = p_doctor_id
      AND status NOT IN ('cancelled', 'completed')
      AND (
        (scheduled_at <= p_scheduled_at AND (scheduled_at + (duration_min || ' minutes')::interval) > p_scheduled_at)
        OR
        (scheduled_at < (p_scheduled_at + (p_duration_min || ' minutes')::interval) AND (scheduled_at + (duration_min || ' minutes')::interval) >= (p_scheduled_at + (p_duration_min || ' minutes')::interval))
        OR
        (scheduled_at >= p_scheduled_at AND (scheduled_at + (duration_min || ' minutes')::interval) <= (p_scheduled_at + (p_duration_min || ' minutes')::interval))
      )
  ) INTO v_overlap;

  IF v_overlap THEN
    RAISE EXCEPTION 'The requested time slot overlaps with an existing appointment';
  END IF;

  -- 7. Insert securely
  INSERT INTO public.appointments (
    patient_id,
    doctor_id,
    hospital_id,
    scheduled_at,
    duration_min,
    type,
    status,
    reason,
    symptoms,
    amount_charged
  ) VALUES (
    v_patient_id,
    p_doctor_id,
    p_hospital_id,
    p_scheduled_at,
    p_duration_min,
    p_type,
    'scheduled',
    p_reason,
    p_symptoms,
    v_doctor_fee
  ) RETURNING * INTO v_appointment;

  RETURN v_appointment;
END;
$$;

-- 6. Restore record_consultation Security Checks
CREATE OR REPLACE FUNCTION public.record_consultation(
  p_appointment_id uuid,
  p_title text,
  p_diagnosis text,
  p_notes text,
  p_prescription_items jsonb DEFAULT '[]'::jsonb
)
RETURNS public.consultations
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_appointment record;
  v_consultation public.consultations;
  v_item jsonb;
  v_doctor_id uuid;
  v_doc_status text;
BEGIN
  -- Verify caller is the doctor assigned
  SELECT id INTO v_doctor_id FROM public.doctors WHERE profile_id = auth.uid();
  
  SELECT * INTO v_appointment 
  FROM public.appointments 
  WHERE id = p_appointment_id 
    AND doctor_id = v_doctor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found or not assigned to the authenticated doctor';
  END IF;

  -- Verify doctor is verified
  SELECT verification INTO v_doc_status FROM public.doctors WHERE id = v_doctor_id;
  IF v_doc_status != 'verified' THEN
    RAISE EXCEPTION 'Doctor is not verified';
  END IF;

  -- Verify appointment state
  IF v_appointment.status NOT IN ('confirmed', 'checked_in', 'in_progress', 'completed') THEN
    RAISE EXCEPTION 'Cannot record consultation for an appointment with status: %', v_appointment.status;
  END IF;

  -- Insert consultation
  INSERT INTO public.consultations (
    appointment_id, patient_id, doctor_id, title, diagnosis, notes
  ) VALUES (
    p_appointment_id, v_appointment.patient_id, v_appointment.doctor_id, p_title, p_diagnosis, p_notes
  ) RETURNING * INTO v_consultation;

  -- Process prescription items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_prescription_items)
  LOOP
    INSERT INTO public.prescriptions (
      consultation_id, patient_id, doctor_id, medication_name, dosage, frequency, duration_days, instructions
    ) VALUES (
      v_consultation.id, v_appointment.patient_id, v_appointment.doctor_id,
      v_item->>'medication_name', v_item->>'dosage', v_item->>'frequency',
      (v_item->>'duration_days')::integer, v_item->>'instructions'
    );
  END LOOP;

  -- Update appointment status
  UPDATE public.appointments SET status = 'completed' WHERE id = p_appointment_id;

  RETURN v_consultation;
END;
$$;

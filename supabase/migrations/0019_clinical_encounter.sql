-- 0019: production clinical encounter workspace.
-- Adds structured encounter fields, safe doctor patient context, and atomic lab-order creation.

ALTER TABLE public.medical_records
  ADD COLUMN IF NOT EXISTS subjective_notes text,
  ADD COLUMN IF NOT EXISTS objective_notes text,
  ADD COLUMN IF NOT EXISTS assessment_notes text,
  ADD COLUMN IF NOT EXISTS care_plan text,
  ADD COLUMN IF NOT EXISTS follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_instructions text;

ALTER TABLE public.lab_orders
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.appointments(id);

CREATE INDEX IF NOT EXISTS lab_orders_appointment_idx
  ON public.lab_orders(appointment_id, booked_at DESC);

-- Safe clinical context: doctors receive only the patient fields needed for care,
-- and only when they own the appointment.
CREATE OR REPLACE FUNCTION public.get_doctor_encounter_context(p_appointment_id uuid)
RETURNS TABLE (
  appointment_id uuid,
  patient_id uuid,
  doctor_id uuid,
  hospital_id uuid,
  scheduled_at timestamptz,
  appointment_status appointment_status,
  consultation_type consultation_type,
  reason text,
  patient_name text,
  digital_health_id text,
  dob date,
  gender gender_type,
  blood_group blood_group,
  city text,
  phone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_doctor uuid;
BEGIN
  SELECT d.id
    INTO caller_doctor
    FROM public.doctors d
   WHERE d.profile_id = auth.uid()
     AND d.verification = 'verified';

  IF caller_doctor IS NULL THEN
    RAISE EXCEPTION 'verified doctor required';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.patient_id,
    a.doctor_id,
    a.hospital_id,
    a.scheduled_at,
    a.status,
    a.type,
    a.reason,
    p.full_name,
    p.digital_health_id,
    p.dob,
    p.gender,
    p.blood_group,
    p.city,
    p.phone
  FROM public.appointments a
  JOIN public.profiles p ON p.id = a.patient_id
  WHERE a.id = p_appointment_id
    AND a.doctor_id = caller_doctor
    AND a.status NOT IN ('cancelled', 'no_show');
END;
$$;

REVOKE ALL ON FUNCTION public.get_doctor_encounter_context(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_doctor_encounter_context(uuid) TO authenticated;

-- Replace the consultation writer with the structured encounter fields while
-- retaining the existing first-six arguments for backwards-compatible callers.
DROP FUNCTION IF EXISTS public.record_consultation(uuid, text, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.record_consultation(
  p_appointment_id uuid,
  p_title text,
  p_diagnosis text,
  p_notes text,
  p_prescription_notes text DEFAULT NULL,
  p_prescription_items jsonb DEFAULT NULL,
  p_vitals jsonb DEFAULT NULL,
  p_subjective_notes text DEFAULT NULL,
  p_objective_notes text DEFAULT NULL,
  p_assessment_notes text DEFAULT NULL,
  p_care_plan text DEFAULT NULL,
  p_follow_up_at timestamptz DEFAULT NULL,
  p_follow_up_instructions text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  appt public.appointments;
  caller_doctor uuid;
  record_id uuid;
  rx_id uuid;
  item jsonb;
BEGIN
  SELECT d.id
    INTO caller_doctor
    FROM public.doctors d
   WHERE d.profile_id = auth.uid()
     AND d.verification = 'verified';

  IF caller_doctor IS NULL THEN
    RAISE EXCEPTION 'verified doctor required';
  END IF;

  SELECT *
    INTO appt
    FROM public.appointments
   WHERE id = p_appointment_id
     AND doctor_id = caller_doctor
   FOR UPDATE;

  IF NOT FOUND OR appt.status NOT IN ('checked_in', 'in_progress') THEN
    RAISE EXCEPTION 'an active clinical encounter is required';
  END IF;

  IF nullif(trim(p_title), '') IS NULL THEN
    RAISE EXCEPTION 'record title is required';
  END IF;

  IF p_follow_up_at IS NOT NULL AND p_follow_up_at < now() THEN
    RAISE EXCEPTION 'follow-up time cannot be in the past';
  END IF;

  IF p_vitals IS NOT NULL AND jsonb_typeof(p_vitals) <> 'object' THEN
    RAISE EXCEPTION 'vitals must be a JSON object';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.medical_records
     WHERE appointment_id = p_appointment_id
       AND type = 'consultation'
  ) THEN
    RAISE EXCEPTION 'a consultation record already exists for this appointment';
  END IF;

  INSERT INTO public.medical_records (
    patient_id,
    doctor_id,
    appointment_id,
    type,
    title,
    diagnosis,
    notes,
    vitals,
    subjective_notes,
    objective_notes,
    assessment_notes,
    care_plan,
    follow_up_at,
    follow_up_instructions,
    region_id
  )
  VALUES (
    appt.patient_id,
    caller_doctor,
    appt.id,
    'consultation',
    trim(p_title),
    nullif(trim(p_diagnosis), ''),
    nullif(trim(p_notes), ''),
    COALESCE(p_vitals, '{}'::jsonb),
    nullif(trim(p_subjective_notes), ''),
    nullif(trim(p_objective_notes), ''),
    nullif(trim(p_assessment_notes), ''),
    nullif(trim(p_care_plan), ''),
    p_follow_up_at,
    nullif(trim(p_follow_up_instructions), ''),
    COALESCE((SELECT region_id FROM public.profiles WHERE id = appt.patient_id), 'national')
  )
  RETURNING id INTO record_id;

  IF nullif(trim(p_prescription_notes), '') IS NOT NULL
     OR (
       p_prescription_items IS NOT NULL
       AND jsonb_typeof(p_prescription_items) = 'array'
       AND jsonb_array_length(p_prescription_items) > 0
     )
  THEN
    INSERT INTO public.prescriptions (
      appointment_id,
      patient_id,
      doctor_id,
      notes
    )
    VALUES (
      appt.id,
      appt.patient_id,
      caller_doctor,
      nullif(trim(p_prescription_notes), '')
    )
    RETURNING id INTO rx_id;

    IF p_prescription_items IS NOT NULL
       AND jsonb_typeof(p_prescription_items) = 'array'
    THEN
      FOR item IN SELECT * FROM jsonb_array_elements(p_prescription_items)
      LOOP
        IF nullif(trim(item->>'medicine_id'), '') IS NULL THEN
          RAISE EXCEPTION 'prescription medicine_id is required';
        END IF;

        IF item->>'duration_days' IS NULL
           OR (item->>'duration_days')::int <= 0
        THEN
          RAISE EXCEPTION 'prescription duration_days must be positive';
        END IF;

        INSERT INTO public.prescription_items (
          prescription_id,
          medicine_id,
          dosage,
          frequency,
          duration_days,
          instructions
        )
        VALUES (
          rx_id,
          nullif(trim(item->>'medicine_id'), '')::uuid,
          nullif(trim(item->>'dosage'), ''),
          nullif(trim(item->>'frequency'), ''),
          (item->>'duration_days')::int,
          nullif(trim(item->>'instructions'), '')
        );
      END LOOP;
    END IF;
  END IF;

  INSERT INTO public.audit_logs (
    actor_id,
    action,
    table_name,
    record_id,
    new_data
  )
  VALUES (
    auth.uid(),
    'clinical_record.created',
    'medical_records',
    record_id::text,
    jsonb_build_object(
      'appointment_id', appt.id,
      'patient_id', appt.patient_id,
      'doctor_id', caller_doctor
    )
  );

  IF rx_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (
      actor_id,
      action,
      table_name,
      record_id,
      new_data
    )
    VALUES (
      auth.uid(),
      'prescription.created',
      'prescriptions',
      rx_id::text,
      jsonb_build_object(
        'appointment_id', appt.id,
        'patient_id', appt.patient_id,
        'doctor_id', caller_doctor
      )
    );
  END IF;

  UPDATE public.appointments
     SET status = 'completed'
   WHERE id = p_appointment_id
     AND status IN ('checked_in', 'in_progress');

  RETURN record_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_consultation(uuid, text, text, text, text, jsonb, jsonb, text, text, text, text, timestamptz, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_consultation(uuid, text, text, text, text, jsonb, jsonb, text, text, text, text, timestamptz, text) TO authenticated;

-- Atomic doctor → laboratory order. Doctor cannot directly mutate order items;
-- this RPC is the sole clinical entry path for ordering tests.
CREATE OR REPLACE FUNCTION public.create_lab_order_for_encounter(
  p_appointment_id uuid,
  p_lab_id uuid,
  p_priority urgency_level DEFAULT 'standard',
  p_test_ids uuid[] DEFAULT '{}'
)
RETURNS public.lab_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  appt public.appointments;
  lab public.laboratories;
  caller_doctor uuid;
  order_row public.lab_orders;
  test_id uuid;
  requested_count int;
  matched_count int;
BEGIN
  SELECT d.id
    INTO caller_doctor
    FROM public.doctors d
   WHERE d.profile_id = auth.uid()
     AND d.verification = 'verified';

  IF caller_doctor IS NULL THEN
    RAISE EXCEPTION 'verified doctor required';
  END IF;

  SELECT *
    INTO appt
    FROM public.appointments
   WHERE id = p_appointment_id
     AND doctor_id = caller_doctor
   FOR UPDATE;

  IF NOT FOUND OR appt.status NOT IN ('checked_in', 'in_progress') THEN
    RAISE EXCEPTION 'an active clinical encounter is required';
  END IF;

  requested_count := COALESCE(cardinality(p_test_ids), 0);
  IF requested_count < 1 OR requested_count > 20 THEN
    RAISE EXCEPTION 'select between 1 and 20 laboratory tests';
  END IF;

  SELECT *
    INTO lab
    FROM public.laboratories
   WHERE id = p_lab_id
     AND verification = 'verified';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'laboratory is unavailable';
  END IF;

  SELECT count(DISTINCT t.id)
    INTO matched_count
    FROM public.lab_tests t
   WHERE t.id = ANY(p_test_ids);

  IF matched_count <> requested_count THEN
    RAISE EXCEPTION 'one or more selected laboratory tests are invalid';
  END IF;

  INSERT INTO public.lab_orders (
    patient_id,
    doctor_id,
    appointment_id,
    lab_id,
    priority,
    status
  )
  VALUES (
    appt.patient_id,
    caller_doctor,
    appt.id,
    lab.id,
    COALESCE(p_priority, 'standard'),
    'pending'
  )
  RETURNING * INTO order_row;

  FOREACH test_id IN ARRAY p_test_ids
  LOOP
    INSERT INTO public.lab_order_items (order_id, test_id)
    VALUES (order_row.id, test_id);
  END LOOP;

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    body,
    data,
    priority
  )
  VALUES (
    appt.patient_id,
    'lab_order.created',
    'New laboratory order',
    'Your doctor placed a laboratory order.',
    jsonb_build_object('lab_order_id', order_row.id, 'appointment_id', appt.id),
    'normal'
  );

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    body,
    data,
    priority
  )
  VALUES (
    lab.owner_id,
    'lab_order.new',
    'New laboratory order',
    'A doctor has placed a new laboratory order.',
    jsonb_build_object('lab_order_id', order_row.id, 'appointment_id', appt.id),
    'high'
  );

  INSERT INTO public.audit_logs (
    actor_id,
    action,
    table_name,
    record_id,
    new_data
  )
  VALUES (
    auth.uid(),
    'lab_order.created',
    'lab_orders',
    order_row.id::text,
    jsonb_build_object(
      'appointment_id', appt.id,
      'patient_id', appt.patient_id,
      'doctor_id', caller_doctor,
      'lab_id', lab.id,
      'test_count', requested_count
    )
  );

  RETURN order_row;
END;
$$;

REVOKE ALL ON FUNCTION public.create_lab_order_for_encounter(uuid, uuid, urgency_level, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_lab_order_for_encounter(uuid, uuid, urgency_level, uuid[]) TO authenticated;

-- Doctors may view orders they authored; order items remain protected by the
-- existing lab-items policy and are created only by the RPC above.

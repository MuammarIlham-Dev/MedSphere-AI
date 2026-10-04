-- 0020: doctor credential evidence and controlled verification lifecycle.

CREATE TYPE public.doctor_credential_type AS ENUM (
  'medical_license',
  'degree',
  'specialty_certificate',
  'identity',
  'other'
);

CREATE TYPE public.doctor_credential_status AS ENUM (
  'pending',
  'accepted',
  'rejected',
  'expired'
);

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS verification_reason text,
  ADD COLUMN IF NOT EXISTS verification_due_at timestamptz;

CREATE TABLE public.doctor_credentials (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  credential_type public.doctor_credential_type not null,
  file_id uuid not null references public.files(id),
  document_number text,
  issued_at date,
  expires_at date,
  status public.doctor_credential_status not null default 'pending',
  review_notes text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or issued_at is null or expires_at >= issued_at)
);

CREATE INDEX doctor_credentials_doctor_idx
  ON public.doctor_credentials(doctor_id, status, created_at desc);

CREATE INDEX doctor_credentials_expiry_idx
  ON public.doctor_credentials(expires_at, status);

CREATE UNIQUE INDEX doctor_credentials_pending_type_idx
  ON public.doctor_credentials(doctor_id, credential_type)
  WHERE status = 'pending';

ALTER TABLE public.doctor_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY doctor_credentials_read
  ON public.doctor_credentials
  FOR SELECT
  USING (
    exists (
      select 1 from public.doctors d
      where d.id = doctor_id and d.profile_id = auth.uid()
    )
    or public.is_admin()
  );

CREATE POLICY doctor_credentials_insert
  ON public.doctor_credentials
  FOR INSERT
  WITH CHECK (
    exists (
      select 1 from public.doctors d
      where d.id = doctor_id and d.profile_id = auth.uid()
    )
  );

-- No direct update/delete policy: review and lifecycle changes are RPC-only.

CREATE OR REPLACE FUNCTION public.protect_doctor_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.rating_avg IS DISTINCT FROM OLD.rating_avg
      OR NEW.rating_count IS DISTINCT FROM OLD.rating_count)
     AND current_setting('medsphere.internal_update', true) IS DISTINCT FROM 'true'
  THEN
    RAISE EXCEPTION 'Doctor ratings are managed automatically and cannot be modified directly';
  END IF;

  IF NEW.verification IS DISTINCT FROM OLD.verification
     AND current_setting('medsphere.verification_update', true) IS DISTINCT FROM 'true'
  THEN
    RAISE EXCEPTION 'Doctor verification is managed through the verification workflow';
  END IF;

  IF NEW.verified_at IS DISTINCT FROM OLD.verified_at
     OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
     OR NEW.verification_reason IS DISTINCT FROM OLD.verification_reason
     OR NEW.verification_due_at IS DISTINCT FROM OLD.verification_due_at
  THEN
    IF current_setting('medsphere.verification_update', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Doctor verification metadata is managed through the verification workflow';
    END IF;
  END IF;

  IF current_user <> 'supabase_admin' THEN
    IF NEW.specialty IS DISTINCT FROM OLD.specialty
       OR NEW.license_no IS DISTINCT FROM OLD.license_no
       OR NEW.qualifications IS DISTINCT FROM OLD.qualifications
       OR NEW.hospital_id IS DISTINCT FROM OLD.hospital_id
       OR NEW.experience_years IS DISTINCT FROM OLD.experience_years
    THEN
      NEW.verification = 'pending';
      NEW.verified_at = NULL;
      NEW.verified_by = NULL;
      NEW.verification_due_at = NULL;
      NEW.verification_reason = 'Professional profile changed; re-verification required';
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

CREATE OR REPLACE FUNCTION public.doctor_verification_eligible(p_doctor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.doctors d
    WHERE d.id = p_doctor_id
      AND d.verification = 'verified'
      AND (d.verification_due_at IS NULL OR d.verification_due_at > now())
      AND EXISTS (
        SELECT 1
        FROM public.doctor_credentials c
        WHERE c.doctor_id = d.id
          AND c.credential_type = 'medical_license'
          AND c.status = 'accepted'
          AND (c.expires_at IS NULL OR c.expires_at >= current_date)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.submit_doctor_credential(
  p_credential_type public.doctor_credential_type,
  p_file_id uuid,
  p_document_number text DEFAULT NULL,
  p_issued_at date DEFAULT NULL,
  p_expires_at date DEFAULT NULL
)
RETURNS public.doctor_credentials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doctor public.doctors%rowtype;
  v_file public.files%rowtype;
  v_credential public.doctor_credentials%rowtype;
BEGIN
  SELECT *
    INTO v_doctor
    FROM public.doctors
   WHERE profile_id = auth.uid()
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'doctor profile not found';
  END IF;

  SELECT *
    INTO v_file
    FROM public.files
   WHERE id = p_file_id
     AND owner_id = auth.uid()
     AND bucket = 'documents'
     AND purpose = 'doctor_credential';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'credential file is not owned by the doctor or has an invalid purpose';
  END IF;

  IF p_expires_at IS NOT NULL AND p_issued_at IS NOT NULL AND p_expires_at < p_issued_at THEN
    RAISE EXCEPTION 'credential expiry cannot precede issue date';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.doctor_credentials
     WHERE doctor_id = v_doctor.id
       AND credential_type = p_credential_type
       AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'a credential of this type is already awaiting review';
  END IF;

  INSERT INTO public.doctor_credentials (
    doctor_id,
    credential_type,
    file_id,
    document_number,
    issued_at,
    expires_at
  )
  VALUES (
    v_doctor.id,
    p_credential_type,
    p_file_id,
    nullif(trim(p_document_number), ''),
    p_issued_at,
    p_expires_at
  )
  RETURNING * INTO v_credential;

  INSERT INTO public.audit_logs (
    actor_id, action, table_name, record_id, new_data
  )
  VALUES (
    auth.uid(),
    'doctor_credential.submitted',
    'doctor_credentials',
    v_credential.id::text,
    jsonb_build_object(
      'doctor_id', v_doctor.id,
      'credential_type', p_credential_type,
      'file_id', p_file_id
    )
  );

  RETURN v_credential;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_doctor_credential(
  p_credential_id uuid,
  p_status public.doctor_credential_status,
  p_notes text DEFAULT NULL
)
RETURNS public.doctor_credentials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credential public.doctor_credentials%rowtype;
  v_doctor public.doctors%rowtype;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'administrator access required';
  END IF;

  IF p_status NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'credential review must accept or reject';
  END IF;

  SELECT *
    INTO v_credential
    FROM public.doctor_credentials
   WHERE id = p_credential_id
   FOR UPDATE;

  IF NOT FOUND OR v_credential.status <> 'pending' THEN
    RAISE EXCEPTION 'credential is not awaiting review';
  END IF;

  SELECT *
    INTO v_doctor
    FROM public.doctors
   WHERE id = v_credential.doctor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'doctor profile not found';
  END IF;

  UPDATE public.doctor_credentials
     SET status = p_status,
         review_notes = nullif(trim(p_notes), ''),
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         updated_at = now()
   WHERE id = v_credential.id
   RETURNING * INTO v_credential;

  INSERT INTO public.audit_logs (
    actor_id, action, table_name, record_id, old_data, new_data
  )
  VALUES (
    auth.uid(),
    'doctor_credential.reviewed',
    'doctor_credentials',
    v_credential.id::text,
    jsonb_build_object('doctor_id', v_doctor.id, 'status', 'pending'),
    jsonb_build_object('doctor_id', v_doctor.id, 'status', p_status, 'notes', v_credential.review_notes)
  );

  INSERT INTO public.notifications (
    user_id, type, title, body, data, priority
  )
  VALUES (
    v_doctor.profile_id,
    'doctor_credential.reviewed',
    'Credential review updated',
    CASE WHEN p_status = 'accepted'
      THEN 'A submitted professional credential was accepted.'
      ELSE 'A submitted professional credential was rejected. Review the notes and resubmit corrected evidence.'
    END,
    jsonb_build_object('credential_id', v_credential.id, 'status', p_status),
    CASE WHEN p_status = 'accepted' THEN 'normal' ELSE 'high' END
  );

  RETURN v_credential;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_doctor_verification(
  p_doctor_id uuid,
  p_status public.verification_status,
  p_reason text DEFAULT NULL
)
RETURNS public.doctors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doctor public.doctors%rowtype;
  v_license public.doctor_credentials%rowtype;
  v_due_at timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'administrator access required';
  END IF;

  IF p_status NOT IN ('pending', 'verified', 'rejected', 'suspended') THEN
    RAISE EXCEPTION 'invalid doctor verification state';
  END IF;

  SELECT *
    INTO v_doctor
    FROM public.doctors
   WHERE id = p_doctor_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'doctor not found';
  END IF;

  IF p_status = 'verified' THEN
    SELECT *
      INTO v_license
      FROM public.doctor_credentials
     WHERE doctor_id = v_doctor.id
       AND credential_type = 'medical_license'
       AND status = 'accepted'
       AND (expires_at IS NULL OR expires_at >= current_date)
     ORDER BY reviewed_at DESC NULLS LAST, created_at DESC
     LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'an accepted, unexpired medical license is required before verification';
    END IF;

    IF v_license.document_number IS NOT NULL
       AND upper(trim(v_license.document_number)) <> upper(trim(v_doctor.license_no))
    THEN
      RAISE EXCEPTION 'accepted license number does not match the doctor profile';
    END IF;

    v_due_at := least(
      now() + interval '365 days',
      coalesce(v_license.expires_at::timestamptz + interval '1 day', now() + interval '365 days')
    );
  ELSE
    v_due_at := NULL;
  END IF;

  PERFORM set_config('medsphere.verification_update', 'true', true);

  UPDATE public.doctors
     SET verification = p_status,
         verified_at = CASE WHEN p_status = 'verified' THEN now() ELSE NULL END,
         verified_by = CASE WHEN p_status = 'verified' THEN auth.uid() ELSE NULL END,
         verification_due_at = v_due_at,
         verification_reason = nullif(trim(p_reason), '')
   WHERE id = v_doctor.id
   RETURNING * INTO v_doctor;

  INSERT INTO public.audit_logs (
    actor_id, action, table_name, record_id, old_data, new_data
  )
  VALUES (
    auth.uid(),
    'doctor.verification.changed',
    'doctors',
    v_doctor.id::text,
    jsonb_build_object('verification', (SELECT verification FROM public.doctors WHERE id = v_doctor.id)),
    jsonb_build_object(
      'verification', p_status,
      'reason', v_doctor.verification_reason,
      'verification_due_at', v_doctor.verification_due_at
    )
  );

  INSERT INTO public.notifications (
    user_id, type, title, body, data, priority
  )
  VALUES (
    v_doctor.profile_id,
    'doctor.verification.changed',
    'Doctor verification status updated',
    CASE p_status
      WHEN 'verified' THEN 'Your MedSphere AI doctor verification is active.'
      WHEN 'suspended' THEN 'Your doctor access has been suspended.'
      WHEN 'rejected' THEN 'Your doctor application was not approved.'
      ELSE 'Your doctor verification requires review.'
    END,
    jsonb_build_object('doctor_id', v_doctor.id, 'status', p_status, 'verification_due_at', v_doctor.verification_due_at, 'reason', v_doctor.verification_reason),
    CASE WHEN p_status IN ('suspended','rejected') THEN 'high' ELSE 'normal' END
  );

  RETURN v_doctor;
END;
$$;

-- Replace critical availability / clinical gates so expired verification cannot keep
-- serving or documenting care.
CREATE OR REPLACE FUNCTION public.get_doctor_slots(
  p_doctor_id uuid,
  p_date date,
  p_type consultation_type,
  p_exclude_appointment_id uuid DEFAULT NULL
) RETURNS TABLE(slot_at timestamptz, available boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_date < (now() AT TIME ZONE 'Asia/Dhaka')::date THEN RAISE EXCEPTION 'date must be today or later'; END IF;
  IF p_date > ((now() AT TIME ZONE 'Asia/Dhaka')::date + 90) THEN RAISE EXCEPTION 'date is too far in the future'; END IF;

  IF NOT public.doctor_verification_eligible(p_doctor_id) THEN
    RAISE EXCEPTION 'doctor is not currently eligible for practice';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.doctors d
    WHERE d.id = p_doctor_id
      AND ((p_type = 'video' AND d.video_enabled) OR (p_type = 'clinic' AND d.clinic_enabled))
  ) THEN RAISE EXCEPTION 'doctor is unavailable for this consultation'; END IF;

  RETURN QUERY
  WITH schedules AS (
    SELECT s.start_time, s.end_time, s.slot_minutes
    FROM public.doctor_schedules s
    WHERE s.doctor_id = p_doctor_id AND s.weekday = EXTRACT(DOW FROM p_date)::int
      AND s.type = p_type AND s.is_active
  ),
  slots AS (
    SELECT gs.slot_at, s.slot_minutes
    FROM schedules s
    CROSS JOIN LATERAL generate_series(
      (p_date::timestamp + s.start_time) AT TIME ZONE 'Asia/Dhaka',
      ((p_date::timestamp + s.end_time) AT TIME ZONE 'Asia/Dhaka') - make_interval(mins => s.slot_minutes),
      make_interval(mins => s.slot_minutes)
    ) AS gs(slot_at)
  )
  SELECT slots.slot_at,
    NOT EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id IS DISTINCT FROM p_exclude_appointment_id
        AND a.doctor_id = p_doctor_id
        AND a.status NOT IN ('cancelled','no_show')
        AND tstzrange(a.scheduled_at, a.scheduled_at + make_interval(mins => a.duration_min),'[)')
          && tstzrange(slots.slot_at, slots.slot_at + make_interval(mins => slots.slot_minutes),'[)')
    )
  FROM slots
  WHERE slots.slot_at > now()
  ORDER BY slots.slot_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_appointment(
  p_appointment_id uuid,
  p_status appointment_status,
  p_reason text DEFAULT NULL
) RETURNS public.appointments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_row public.appointments; result public.appointments; caller_doctor uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT * INTO current_row FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'appointment not found'; END IF;

  SELECT id INTO caller_doctor FROM public.doctors WHERE profile_id = auth.uid();

  IF caller_doctor IS NOT NULL
     AND caller_doctor = current_row.doctor_id
     AND NOT public.doctor_verification_eligible(caller_doctor)
     AND p_status <> 'cancelled'
  THEN
    RAISE EXCEPTION 'doctor verification is not currently active';
  END IF;

  IF p_status = 'rescheduled' THEN RAISE EXCEPTION 'use reschedule_appointment to change appointment time'; END IF;

  IF p_status = 'cancelled' THEN
    IF auth.uid() = current_row.patient_id THEN
      IF current_row.status NOT IN ('booked','confirmed') THEN RAISE EXCEPTION 'patients can only cancel booked or confirmed appointments'; END IF;
    ELSIF caller_doctor IS DISTINCT FROM current_row.doctor_id AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  ELSIF caller_doctor IS DISTINCT FROM current_row.doctor_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'only the assigned doctor can advance this appointment';
  END IF;

  IF p_status = 'no_show' AND now() < current_row.scheduled_at THEN RAISE EXCEPTION 'cannot mark no-show before appointment time'; END IF;

  IF NOT (
    (current_row.status='booked' AND p_status IN ('confirmed','cancelled'))
    OR (current_row.status='confirmed' AND p_status IN ('checked_in','cancelled','no_show'))
    OR (current_row.status='checked_in' AND p_status IN ('in_progress','cancelled','no_show'))
    OR (current_row.status='in_progress' AND p_status='completed')
  ) THEN RAISE EXCEPTION 'invalid appointment status transition'; END IF;

  UPDATE public.appointments
     SET status=p_status,
         cancel_reason=CASE WHEN p_status='cancelled' THEN nullif(trim(p_reason),'') ELSE cancel_reason END
   WHERE id=p_appointment_id
   RETURNING * INTO result;

  RETURN result;
END;
$$;

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

-- Give already-verified accounts a migration grace period to submit evidence.
UPDATE public.doctors
   SET verification_due_at = now() + interval '90 days'
 WHERE verification = 'verified'
   AND verification_due_at IS NULL;

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

-- No direct insert/update/delete policy: credential lifecycle changes are RPC-only.

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
      AND (
        (d.verification_due_at IS NOT NULL AND d.verification_due_at > now())
        OR EXISTS (
          SELECT 1
          FROM public.doctor_credentials c
          WHERE c.doctor_id = d.id
            AND c.credential_type = 'medical_license'
            AND c.status = 'accepted'
            AND (c.expires_at IS NULL OR c.expires_at >= current_date)
        )
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
  v_old_status public.verification_status;
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

  v_old_status := v_doctor.verification;

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
    jsonb_build_object('verification', v_old_status, 'doctor_id', v_doctor.id),
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


-- Public doctor discovery must hide doctors whose verification window has expired.
DROP POLICY IF EXISTS doctors_read ON public.doctors;
CREATE POLICY doctors_read ON public.doctors
  FOR SELECT USING (
    (
      verification = 'verified'
      AND (
        (verification_due_at IS NOT NULL AND verification_due_at > now())
        OR EXISTS (
          SELECT 1 FROM public.doctor_credentials c
          WHERE c.doctor_id = id
            AND c.credential_type = 'medical_license'
            AND c.status = 'accepted'
            AND (c.expires_at IS NULL OR c.expires_at >= current_date)
        )
      )
    )
    OR profile_id = auth.uid()
    OR public.is_admin()
  );


-- Re-apply practice-eligibility gates to older and clinical encounter RPCs.

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
  where d.id = p_doctor_id and public.doctor_verification_eligible(d.id)
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

CREATE OR REPLACE FUNCTION public.reschedule_appointment(
  p_appointment_id uuid,
  p_scheduled_at timestamptz
) RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  appt public.appointments;
  result public.appointments;
  new_day date := (p_scheduled_at AT TIME ZONE 'Asia/Dhaka')::date;
  new_time time := (p_scheduled_at AT TIME ZONE 'Asia/Dhaka')::time;
  new_dow int := EXTRACT(DOW FROM p_scheduled_at AT TIME ZONE 'Asia/Dhaka');
  next_token int;
  old_lock bigint;
  new_lock bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT *
  INTO appt
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment not found';
  END IF;

  IF appt.patient_id <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF appt.status NOT IN ('booked', 'confirmed') THEN
    RAISE EXCEPTION 'only booked or confirmed appointments can be rescheduled';
  END IF;

  IF p_scheduled_at <= now() THEN
    RAISE EXCEPTION 'appointment must be in the future';
  END IF;

  IF p_scheduled_at = appt.scheduled_at THEN
    RAISE EXCEPTION 'new appointment time must be different';
  END IF;

  IF new_day > ((now() AT TIME ZONE 'Asia/Dhaka')::date + 90) THEN
    RAISE EXCEPTION 'date is too far in the future';
  END IF;

  old_lock := hashtextextended(appt.doctor_id::text || appt.day::text, 0);
  new_lock := hashtextextended(appt.doctor_id::text || new_day::text, 0);

  IF old_lock <= new_lock THEN
    PERFORM pg_advisory_xact_lock(old_lock);
    IF new_lock <> old_lock THEN
      PERFORM pg_advisory_xact_lock(new_lock);
    END IF;
  ELSE
    PERFORM pg_advisory_xact_lock(new_lock);
    IF new_lock <> old_lock THEN
      PERFORM pg_advisory_xact_lock(old_lock);
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.doctors d
    WHERE d.id = appt.doctor_id
      AND public.doctor_verification_eligible(d.id)
      AND (
        (appt.type = 'video' AND d.video_enabled)
        OR (appt.type = 'clinic' AND d.clinic_enabled)
      )
  ) THEN
    RAISE EXCEPTION 'doctor is unavailable for this consultation';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.doctor_schedules s
    WHERE s.doctor_id = appt.doctor_id
      AND s.is_active
      AND s.type = appt.type
      AND s.weekday = new_dow
      AND new_time >= s.start_time
      AND new_time + make_interval(mins => appt.duration_min) <= s.end_time
      AND MOD(EXTRACT(EPOCH FROM (new_time - s.start_time))::int / 60, s.slot_minutes) = 0
      AND MOD(appt.duration_min, s.slot_minutes) = 0
  ) THEN
    RAISE EXCEPTION 'requested time is outside the doctor schedule';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.id <> appt.id
      AND a.doctor_id = appt.doctor_id
      AND a.status NOT IN ('cancelled', 'no_show')
      AND tstzrange(
        a.scheduled_at,
        a.scheduled_at + make_interval(mins => a.duration_min),
        '[)'
      ) && tstzrange(
        p_scheduled_at,
        p_scheduled_at + make_interval(mins => appt.duration_min),
        '[)'
      )
  ) THEN
    RAISE EXCEPTION 'this appointment slot is no longer available';
  END IF;

  SELECT COALESCE(MAX(token_number), 0) + 1
  INTO next_token
  FROM public.appointments
  WHERE doctor_id = appt.doctor_id
    AND day = new_day;

  UPDATE public.appointments
  SET scheduled_at = p_scheduled_at,
      day = new_day,
      token_number = next_token
  WHERE id = appt.id
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_appointment(uuid, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment(uuid, timestamptz) TO authenticated;

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
     AND public.doctor_verification_eligible(d.id);

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
     AND public.doctor_verification_eligible(d.id);

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
     AND public.doctor_verification_eligible(d.id);

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

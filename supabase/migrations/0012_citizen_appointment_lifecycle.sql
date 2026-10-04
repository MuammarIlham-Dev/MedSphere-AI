-- 0012_citizen_appointment_lifecycle.sql
-- Authoritative slot availability + atomic patient rescheduling + appointment lifecycle hardening.

CREATE OR REPLACE FUNCTION public.get_doctor_slots(
  p_doctor_id uuid,
  p_date date,
  p_type consultation_type,
  p_exclude_appointment_id uuid DEFAULT NULL
) RETURNS TABLE(slot_at timestamptz, available boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF p_date < (now() AT TIME ZONE 'Asia/Dhaka')::date THEN
    RAISE EXCEPTION 'date must be today or later';
  END IF;

  IF p_date > ((now() AT TIME ZONE 'Asia/Dhaka')::date + 90) THEN
    RAISE EXCEPTION 'date is too far in the future';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.doctors d
    WHERE d.id = p_doctor_id
      AND d.verification = 'verified'
      AND (
        (p_type = 'video' AND d.video_enabled)
        OR (p_type = 'clinic' AND d.clinic_enabled)
      )
  ) THEN
    RAISE EXCEPTION 'doctor is unavailable for this consultation';
  END IF;

  RETURN QUERY
  WITH schedules AS (
    SELECT s.start_time, s.end_time, s.slot_minutes
    FROM public.doctor_schedules s
    WHERE s.doctor_id = p_doctor_id
      AND s.weekday = EXTRACT(DOW FROM p_date)::int
      AND s.type = p_type
      AND s.is_active
  ),
  slots AS (
    SELECT
      gs.slot_at,
      s.slot_minutes
    FROM schedules s
    CROSS JOIN LATERAL generate_series(
      (p_date::timestamp + s.start_time) AT TIME ZONE 'Asia/Dhaka',
      ((p_date::timestamp + s.end_time) AT TIME ZONE 'Asia/Dhaka')
        - make_interval(mins => s.slot_minutes),
      make_interval(mins => s.slot_minutes)
    ) AS gs(slot_at)
  )
  SELECT
    slots.slot_at,
    NOT EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.id IS DISTINCT FROM p_exclude_appointment_id
        AND a.doctor_id = p_doctor_id
        AND a.status NOT IN ('cancelled', 'no_show')
        AND tstzrange(
          a.scheduled_at,
          a.scheduled_at + make_interval(mins => a.duration_min),
          '[)'
        ) && tstzrange(
          slots.slot_at,
          slots.slot_at + make_interval(mins => slots.slot_minutes),
          '[)'
        )
    ) AS available
  FROM slots
  WHERE slots.slot_at > now()
  ORDER BY slots.slot_at;
END;
$$;

REVOKE ALL ON FUNCTION public.get_doctor_slots(uuid, date, consultation_type, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_doctor_slots(uuid, date, consultation_type, uuid) TO authenticated;


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
      AND d.verification = 'verified'
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


CREATE OR REPLACE FUNCTION public.transition_appointment(
  p_appointment_id uuid,
  p_status appointment_status,
  p_reason text DEFAULT NULL
) RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_row public.appointments;
  result public.appointments;
  caller_doctor uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT *
  INTO current_row
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment not found';
  END IF;

  SELECT id
  INTO caller_doctor
  FROM public.doctors
  WHERE profile_id = auth.uid();

  IF p_status = 'rescheduled' THEN
    RAISE EXCEPTION 'use reschedule_appointment to change appointment time';
  END IF;

  IF p_status = 'cancelled' THEN
    IF auth.uid() = current_row.patient_id THEN
      IF current_row.status NOT IN ('booked', 'confirmed') THEN
        RAISE EXCEPTION 'patients can only cancel booked or confirmed appointments';
      END IF;
    ELSIF caller_doctor IS DISTINCT FROM current_row.doctor_id AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  ELSIF caller_doctor IS DISTINCT FROM current_row.doctor_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'only the assigned doctor can advance this appointment';
  END IF;

  IF p_status = 'no_show' AND now() < current_row.scheduled_at THEN
    RAISE EXCEPTION 'cannot mark no-show before appointment time';
  END IF;

  IF NOT (
    (current_row.status = 'booked' AND p_status IN ('confirmed', 'cancelled'))
    OR (current_row.status = 'confirmed' AND p_status IN ('checked_in', 'cancelled', 'no_show'))
    OR (current_row.status = 'checked_in' AND p_status IN ('in_progress', 'cancelled', 'no_show'))
    OR (current_row.status = 'in_progress' AND p_status = 'completed')
  ) THEN
    RAISE EXCEPTION 'invalid appointment status transition';
  END IF;

  UPDATE public.appointments
  SET status = p_status,
      cancel_reason = CASE
        WHEN p_status = 'cancelled' THEN nullif(trim(p_reason), '')
        ELSE cancel_reason
      END
  WHERE id = p_appointment_id
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.transition_appointment(uuid, appointment_status, text) FROM public;
GRANT EXECUTE ON FUNCTION public.transition_appointment(uuid, appointment_status, text) TO authenticated;

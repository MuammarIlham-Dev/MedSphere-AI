-- 0021: telemedicine session lifecycle, secure join context, and appointment chat bootstrap.

DO $$
BEGIN
  CREATE TYPE public.telemedicine_session_status AS ENUM ('waiting', 'live', 'ended', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE public.telemedicine_sessions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  room_name text not null unique,
  room_url text,
  status public.telemedicine_session_status not null default 'waiting',
  expires_at timestamptz not null,
  patient_joined_at timestamptz,
  patient_last_seen_at timestamptz,
  patient_active boolean not null default false,
  doctor_joined_at timestamptz,
  doctor_last_seen_at timestamptz,
  doctor_active boolean not null default false,
  started_at timestamptz,
  ended_at timestamptz,
  ended_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX telemedicine_sessions_status_idx
  ON public.telemedicine_sessions(status, expires_at);

ALTER TABLE public.telemedicine_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY telemedicine_sessions_read
  ON public.telemedicine_sessions
  FOR SELECT
  USING (
    exists (
      select 1
      from public.appointments a
      where a.id = appointment_id
        and (
          a.patient_id = auth.uid()
          or a.doctor_id = (
            select d.id from public.doctors d where d.profile_id = auth.uid()
          )
        )
    )
    or public.is_admin()
  );

CREATE OR REPLACE FUNCTION public.request_telemedicine_join(p_appointment_id uuid)
RETURNS TABLE (
  session_id uuid,
  appointment_id uuid,
  participant_role text,
  participant_name text,
  other_participant_name text,
  room_name text,
  room_url text,
  session_status public.telemedicine_session_status,
  scheduled_at timestamptz,
  duration_min int,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.appointments%rowtype;
  d public.doctors%rowtype;
  caller_profile public.profiles%rowtype;
  other_profile public.profiles%rowtype;
  s public.telemedicine_sessions%rowtype;
  role_name text;
  expires_at_calc timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT *
    INTO a
    FROM public.appointments
   WHERE id = p_appointment_id
     AND type = 'video'
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'video appointment not found'; END IF;

  SELECT * INTO d FROM public.doctors WHERE id = a.doctor_id;
  SELECT * INTO caller_profile FROM public.profiles WHERE id = auth.uid();

  IF a.patient_id = auth.uid() THEN
    role_name := 'patient';
    SELECT * INTO other_profile FROM public.profiles WHERE id = d.profile_id;
  ELSIF d.profile_id = auth.uid() THEN
    role_name := 'doctor';
    SELECT * INTO other_profile FROM public.profiles WHERE id = a.patient_id;
    IF NOT public.doctor_verification_eligible(d.id) THEN
      RAISE EXCEPTION 'doctor verification is not currently active';
    END IF;
  ELSE
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF a.status NOT IN ('confirmed', 'checked_in', 'in_progress') THEN
    RAISE EXCEPTION 'video consultation is not open for joining';
  END IF;

  expires_at_calc := a.scheduled_at
    + make_interval(mins => a.duration_min)
    + interval '60 minutes';

  IF now() < a.scheduled_at - interval '15 minutes' THEN
    RAISE EXCEPTION 'telemedicine room opens 15 minutes before the appointment';
  END IF;

  IF now() > expires_at_calc THEN
    RAISE EXCEPTION 'telemedicine session window has expired';
  END IF;

  SELECT *
    INTO s
    FROM public.telemedicine_sessions
   WHERE appointment_id = a.id
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.telemedicine_sessions (
      appointment_id,
      room_name,
      expires_at
    )
    VALUES (
      a.id,
      'med-' || replace(a.id::text, '-', ''),
      expires_at_calc
    )
    RETURNING * INTO s;
  END IF;

  IF s.status IN ('ended', 'cancelled') THEN
    RAISE EXCEPTION 'telemedicine session has ended';
  END IF;

  IF s.expires_at < now() THEN
    RAISE EXCEPTION 'telemedicine session window has expired';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    a.id,
    role_name,
    caller_profile.full_name,
    other_profile.full_name,
    s.room_name,
    s.room_url,
    s.status,
    a.scheduled_at,
    a.duration_min,
    s.expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_telemedicine_joined(p_session_id uuid)
RETURNS public.telemedicine_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.telemedicine_sessions%rowtype;
  a public.appointments%rowtype;
  d public.doctors%rowtype;
BEGIN
  SELECT s.* INTO s
    FROM public.telemedicine_sessions s
    JOIN public.appointments a0 ON a0.id = s.appointment_id
    WHERE s.id = p_session_id
      AND (a0.patient_id = auth.uid() OR a0.doctor_id = (select id from public.doctors where profile_id = auth.uid()))
    FOR UPDATE;

  IF NOT FOUND OR s.status IN ('ended', 'cancelled') THEN
    RAISE EXCEPTION 'telemedicine session unavailable';
  END IF;

  IF s.expires_at < now() THEN
    RAISE EXCEPTION 'telemedicine session window has expired';
  END IF;

  IF a.status NOT IN ('confirmed', 'checked_in', 'in_progress') THEN
    RAISE EXCEPTION 'video consultation is no longer open';
  END IF;

  SELECT * INTO a FROM public.appointments WHERE id = s.appointment_id;
  SELECT * INTO d FROM public.doctors WHERE id = a.doctor_id;

  IF d.profile_id = auth.uid() AND NOT public.doctor_verification_eligible(d.id) THEN
    RAISE EXCEPTION 'doctor verification is not currently active';
  END IF;

  IF auth.uid() = a.patient_id THEN
    UPDATE public.telemedicine_sessions
       SET patient_active = true,
           patient_joined_at = coalesce(patient_joined_at, now()),
           patient_last_seen_at = now(),
           status = case when doctor_active then 'live' else 'waiting' end,
           started_at = case when doctor_active and started_at is null then now() else started_at end,
           updated_at = now()
     WHERE id = s.id
     RETURNING * INTO s;
  ELSE
    UPDATE public.telemedicine_sessions
       SET doctor_active = true,
           doctor_joined_at = coalesce(doctor_joined_at, now()),
           doctor_last_seen_at = now(),
           status = case when patient_active then 'live' else 'waiting' end,
           started_at = case when patient_active and started_at is null then now() else started_at end,
           updated_at = now()
     WHERE id = s.id
     RETURNING * INTO s;
  END IF;

  INSERT INTO public.audit_logs(actor_id, action, table_name, record_id, new_data)
  VALUES (
    auth.uid(),
    'telemedicine.joined',
    'telemedicine_sessions',
    s.id::text,
    jsonb_build_object('appointment_id', s.appointment_id)
  );

  RETURN s;
END;
$$;

CREATE OR REPLACE FUNCTION public.heartbeat_telemedicine_session(p_session_id uuid)
RETURNS public.telemedicine_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.telemedicine_sessions%rowtype;
  a public.appointments%rowtype;
BEGIN
  SELECT s.* INTO s
    FROM public.telemedicine_sessions s
    JOIN public.appointments a0 ON a0.id = s.appointment_id
   WHERE s.id = p_session_id
     AND (a0.patient_id = auth.uid() OR a0.doctor_id = (select id from public.doctors where profile_id = auth.uid()))
     AND s.status <> 'cancelled'
   FOR UPDATE;

  IF NOT FOUND OR s.status = 'ended' THEN
    RAISE EXCEPTION 'telemedicine session unavailable';
  END IF;

  IF s.expires_at < now() THEN
    RAISE EXCEPTION 'telemedicine session window has expired';
  END IF;

  SELECT * INTO a FROM public.appointments WHERE id = s.appointment_id;

  IF auth.uid() = a.patient_id THEN
    UPDATE public.telemedicine_sessions SET patient_active = true, patient_last_seen_at = now(), updated_at = now() WHERE id = s.id RETURNING * INTO s;
  ELSE
    IF NOT public.doctor_verification_eligible(a.doctor_id) THEN
      RAISE EXCEPTION 'doctor verification is not currently active';
    END IF;
    UPDATE public.telemedicine_sessions SET doctor_active = true, doctor_last_seen_at = now(), updated_at = now() WHERE id = s.id RETURNING * INTO s;
  END IF;

  RETURN s;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_telemedicine_session(p_session_id uuid)
RETURNS public.telemedicine_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.telemedicine_sessions%rowtype;
  a public.appointments%rowtype;
BEGIN
  SELECT s.* INTO s
    FROM public.telemedicine_sessions s
    JOIN public.appointments a0 ON a0.id = s.appointment_id
   WHERE s.id = p_session_id
     AND (a0.patient_id = auth.uid() OR a0.doctor_id = (select id from public.doctors where profile_id = auth.uid()))
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'telemedicine session not found'; END IF;

  SELECT * INTO a FROM public.appointments WHERE id = s.appointment_id;

  IF auth.uid() = a.patient_id THEN
    UPDATE public.telemedicine_sessions SET patient_active = false, patient_last_seen_at = now(), updated_at = now() WHERE id = s.id RETURNING * INTO s;
  ELSE
    UPDATE public.telemedicine_sessions SET doctor_active = false, doctor_last_seen_at = now(), updated_at = now() WHERE id = s.id RETURNING * INTO s;
  END IF;

  INSERT INTO public.audit_logs(actor_id, action, table_name, record_id, new_data)
  VALUES (
    auth.uid(),
    'telemedicine.left',
    'telemedicine_sessions',
    s.id::text,
    jsonb_build_object('appointment_id', s.appointment_id)
  );

  RETURN s;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_telemedicine_session(p_session_id uuid)
RETURNS public.telemedicine_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.telemedicine_sessions%rowtype;
  a public.appointments%rowtype;
  d public.doctors%rowtype;
BEGIN
  SELECT s.* INTO s
    FROM public.telemedicine_sessions s
    JOIN public.appointments a0 ON a0.id = s.appointment_id
   WHERE s.id = p_session_id
     AND a0.doctor_id = (select id from public.doctors where profile_id = auth.uid())
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'only the assigned doctor can end this session'; END IF;

  SELECT * INTO a FROM public.appointments WHERE id = s.appointment_id;
  SELECT * INTO d FROM public.doctors WHERE id = a.doctor_id;
  IF NOT public.doctor_verification_eligible(d.id) THEN
    RAISE EXCEPTION 'doctor verification is not currently active';
  END IF;

  IF s.status = 'ended' THEN RETURN s; END IF;

  UPDATE public.telemedicine_sessions
     SET status = 'ended',
         ended_at = now(),
         ended_by = auth.uid(),
         patient_active = false,
         doctor_active = false,
         updated_at = now()
   WHERE id = s.id
   RETURNING * INTO s;

  INSERT INTO public.audit_logs(actor_id, action, table_name, record_id, new_data)
  VALUES (
    auth.uid(),
    'telemedicine.ended',
    'telemedicine_sessions',
    s.id::text,
    jsonb_build_object('appointment_id', s.appointment_id)
  );

  RETURN s;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_appointment_conversation(p_appointment_id uuid)
RETURNS public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.appointments%rowtype;
  d public.doctors%rowtype;
  c public.conversations%rowtype;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT * INTO a FROM public.appointments WHERE id = p_appointment_id AND type = 'video' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'video appointment not found'; END IF;

  SELECT * INTO d FROM public.doctors WHERE id = a.doctor_id;

  IF auth.uid() <> a.patient_id AND auth.uid() <> d.profile_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('conversation:' || a.id::text, 0));

  SELECT * INTO c
    FROM public.conversations
   WHERE appointment_id = a.id
   ORDER BY created_at
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.conversations(appointment_id, subject)
    VALUES (a.id, 'Telemedicine consultation')
    RETURNING * INTO c;

    INSERT INTO public.conversation_participants(conversation_id, user_id)
    VALUES (c.id, a.patient_id), (c.id, d.profile_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN c;
END;
$$;

REVOKE ALL ON FUNCTION public.request_telemedicine_join(uuid),
  public.mark_telemedicine_joined(uuid),
  public.heartbeat_telemedicine_session(uuid),
  public.leave_telemedicine_session(uuid),
  public.end_telemedicine_session(uuid),
  public.get_or_create_appointment_conversation(uuid)
FROM public, anon;

GRANT EXECUTE ON FUNCTION public.request_telemedicine_join(uuid),
  public.mark_telemedicine_joined(uuid),
  public.heartbeat_telemedicine_session(uuid),
  public.leave_telemedicine_session(uuid),
  public.end_telemedicine_session(uuid),
  public.get_or_create_appointment_conversation(uuid)
TO authenticated;

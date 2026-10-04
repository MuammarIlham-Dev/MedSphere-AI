-- 0029_blood_lifesaving_broadcasts.sql
-- Life-saving blood demand orchestration:
-- verified hospital broadcasts -> eligible/available/free donor targeting -> response queue.

ALTER TABLE public.blood_requests
  ADD COLUMN IF NOT EXISTS broadcast_mode text,
  ADD COLUMN IF NOT EXISTS broadcast_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS donor_target_count int,
  ADD COLUMN IF NOT EXISTS broadcast_closed_at timestamptz;

UPDATE public.blood_requests
SET broadcast_mode = COALESCE(broadcast_mode, 'normal'),
    broadcast_expires_at = COALESCE(
      broadcast_expires_at,
      LEAST(
        COALESCE(needed_by, created_at + interval '24 hours'),
        created_at + interval '7 days'
      )
    )
WHERE broadcast_mode IS NULL
   OR broadcast_expires_at IS NULL;

ALTER TABLE public.blood_requests
  ALTER COLUMN broadcast_mode SET DEFAULT 'normal',
  ALTER COLUMN broadcast_mode SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'blood_requests_broadcast_mode_check'
  ) THEN
    ALTER TABLE public.blood_requests
      ADD CONSTRAINT blood_requests_broadcast_mode_check
      CHECK (broadcast_mode IN ('normal','emergency'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'blood_requests_donor_target_count_check'
  ) THEN
    ALTER TABLE public.blood_requests
      ADD CONSTRAINT blood_requests_donor_target_count_check
      CHECK (donor_target_count IS NULL OR donor_target_count > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS blood_requests_broadcast_idx
  ON public.blood_requests(hospital_id, status, broadcast_expires_at, broadcast_closed_at);

CREATE INDEX IF NOT EXISTS blood_donors_broadcast_match_idx
  ON public.blood_donors(blood_group, is_eligible, is_available);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'blood_broadcast_response_status'
  ) THEN
    CREATE TYPE public.blood_broadcast_response_status AS ENUM
      ('queued','confirmed','declined','withdrawn','fulfilled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.blood_broadcast_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  donor_id uuid NOT NULL REFERENCES public.blood_donors(id) ON DELETE CASCADE,
  status public.blood_broadcast_response_status NOT NULL DEFAULT 'queued',
  responded_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  declined_at timestamptz,
  withdrawn_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blood_broadcast_responses_request_idx
  ON public.blood_broadcast_responses(request_id, status, responded_at);

CREATE INDEX IF NOT EXISTS blood_broadcast_responses_donor_idx
  ON public.blood_broadcast_responses(donor_id, status, responded_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS blood_broadcast_response_active_request_idx
  ON public.blood_broadcast_responses(request_id, donor_id)
  WHERE status IN ('queued','confirmed');

CREATE UNIQUE INDEX IF NOT EXISTS blood_broadcast_response_active_donor_idx
  ON public.blood_broadcast_responses(donor_id)
  WHERE status IN ('queued','confirmed');

ALTER TABLE public.blood_broadcast_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blood_broadcast_responses_read ON public.blood_broadcast_responses;
CREATE POLICY blood_broadcast_responses_read
ON public.blood_broadcast_responses
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.blood_donors d
    WHERE d.id = donor_id
      AND d.profile_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.blood_requests r
    JOIN public.hospitals h ON h.id = r.hospital_id
    WHERE r.id = request_id
      AND h.owner_id = auth.uid()
  )
  OR public.is_admin()
);

-- Direct client writes are intentionally absent. All response lifecycle changes use RPCs.

CREATE OR REPLACE FUNCTION public.get_blood_broadcasts_for_donor()
RETURNS TABLE (
  request_id uuid,
  hospital_id uuid,
  hospital_name text,
  hospital_city text,
  hospital_address text,
  hospital_lat double precision,
  hospital_lng double precision,
  blood_group blood_group,
  units int,
  urgency urgency_level,
  broadcast_mode text,
  needed_by timestamptz,
  broadcast_expires_at timestamptz,
  donor_target_count int,
  response_count bigint,
  distance_km numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  donor public.blood_donors;
  donor_profile public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT d.* INTO donor
  FROM public.blood_donors d
  WHERE d.profile_id = auth.uid();

  IF NOT FOUND OR NOT donor.is_eligible OR NOT donor.is_available THEN
    RETURN;
  END IF;

  SELECT p.* INTO donor_profile
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF EXISTS (
    SELECT 1
    FROM public.blood_broadcast_responses br
    WHERE br.donor_id = donor.id
      AND br.status IN ('queued','confirmed')
  ) OR EXISTS (
    SELECT 1
    FROM public.blood_donor_offers bo
    WHERE bo.donor_id = donor.id
      AND bo.status IN ('offered','accepted')
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    h.id,
    h.name,
    h.city,
    h.address,
    h.lat,
    h.lng,
    r.blood_group,
    GREATEST(r.units - r.units_fulfilled, 0),
    r.urgency,
    r.broadcast_mode,
    r.needed_by,
    r.broadcast_expires_at,
    r.donor_target_count,
    (
      SELECT count(*)
      FROM public.blood_broadcast_responses br
      WHERE br.request_id = r.id
        AND br.status IN ('queued','confirmed')
    ),
    CASE
      WHEN donor_profile.lat IS NOT NULL
       AND donor_profile.lng IS NOT NULL
       AND h.lat IS NOT NULL
       AND h.lng IS NOT NULL
      THEN round((
        earth_distance(
          ll_to_earth(donor_profile.lat, donor_profile.lng),
          ll_to_earth(h.lat, h.lng)
        ) / 1000.0
      )::numeric, 1)
      ELSE NULL
    END
  FROM public.blood_requests r
  JOIN public.hospitals h ON h.id = r.hospital_id
  WHERE r.hospital_id IS NOT NULL
    AND h.verification = 'verified'
    AND r.status IN ('open','partially_fulfilled')
    AND r.units_fulfilled < r.units
    AND r.broadcast_closed_at IS NULL
    AND r.broadcast_expires_at > now()
    AND (
      donor_profile.city IS NOT NULL
      AND h.city IS NOT NULL
      AND lower(trim(donor_profile.city)) = lower(trim(h.city))
    )
    AND public.blood_compatible(donor.blood_group, r.blood_group)
  ORDER BY
    CASE r.broadcast_mode WHEN 'emergency' THEN 0 ELSE 1 END,
    CASE r.urgency WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'standard' THEN 2 ELSE 3 END,
    r.broadcast_expires_at ASC,
    distance_km NULLS LAST,
    r.created_at ASC
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_blood_broadcast_responses()
RETURNS TABLE (
  response_id uuid,
  request_id uuid,
  status public.blood_broadcast_response_status,
  responded_at timestamptz,
  confirmed_at timestamptz,
  hospital_name text,
  hospital_city text,
  hospital_address text,
  blood_group blood_group,
  units int,
  urgency urgency_level,
  broadcast_mode text,
  needed_by timestamptz,
  broadcast_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE donor_id_value uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT id INTO donor_id_value
  FROM public.blood_donors
  WHERE profile_id = auth.uid();

  IF donor_id_value IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    br.id,
    r.id,
    br.status,
    br.responded_at,
    br.confirmed_at,
    h.name,
    h.city,
    h.address,
    r.blood_group,
    GREATEST(r.units - r.units_fulfilled, 0),
    r.urgency,
    r.broadcast_mode,
    r.needed_by,
    r.broadcast_expires_at
  FROM public.blood_broadcast_responses br
  JOIN public.blood_requests r ON r.id = br.request_id
  JOIN public.hospitals h ON h.id = r.hospital_id
  WHERE br.donor_id = donor_id_value
    AND br.status IN ('queued','confirmed')
  ORDER BY
    CASE br.status WHEN 'confirmed' THEN 0 ELSE 1 END,
    CASE r.broadcast_mode WHEN 'emergency' THEN 0 ELSE 1 END,
    br.responded_at DESC
  LIMIT 20;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_hospital_blood_broadcast(
  p_hospital_id uuid,
  p_patient_name text,
  p_blood_group blood_group,
  p_units int,
  p_broadcast_mode text DEFAULT 'normal',
  p_urgency urgency_level DEFAULT 'standard',
  p_needed_by timestamptz DEFAULT NULL,
  p_duration_minutes int DEFAULT 1440,
  p_donor_target_count int DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.blood_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h public.hospitals;
  r public.blood_requests;
  expiry_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF p_units < 1 OR p_units > 1000 THEN
    RAISE EXCEPTION 'units must be between 1 and 1000';
  END IF;

  IF nullif(trim(coalesce(p_patient_name,'')), '') IS NULL THEN
    RAISE EXCEPTION 'patient name is required';
  END IF;

  IF p_broadcast_mode NOT IN ('normal','emergency') THEN
    RAISE EXCEPTION 'invalid broadcast mode';
  END IF;

  IF p_broadcast_mode = 'emergency' AND p_urgency <> 'critical' THEN
    RAISE EXCEPTION 'emergency broadcasts must use critical urgency';
  END IF;

  IF p_broadcast_mode = 'emergency' AND p_needed_by IS NULL THEN
    RAISE EXCEPTION 'emergency broadcasts require a needed-by time';
  END IF;

  IF p_duration_minutes NOT BETWEEN 15 AND 10080 THEN
    RAISE EXCEPTION 'broadcast duration must be between 15 minutes and 7 days';
  END IF;

  IF p_broadcast_mode = 'emergency' AND p_duration_minutes > 1440 THEN
    RAISE EXCEPTION 'emergency broadcast duration cannot exceed 24 hours';
  END IF;

  IF p_needed_by IS NOT NULL AND p_needed_by <= now() THEN
    RAISE EXCEPTION 'needed-by time must be in the future';
  END IF;

  IF p_donor_target_count IS NOT NULL
     AND (p_donor_target_count < 1 OR p_donor_target_count > 1000) THEN
    RAISE EXCEPTION 'donor target must be between 1 and 1000';
  END IF;

  SELECT * INTO h
  FROM public.hospitals
  WHERE id = p_hospital_id
    AND owner_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'hospital not found or unauthorized';
  END IF;

  IF public.is_admin() THEN
    SELECT * INTO h FROM public.hospitals WHERE id = p_hospital_id FOR UPDATE;
  END IF;

  IF NOT FOUND OR h.verification <> 'verified' THEN
    RAISE EXCEPTION 'verified hospital is required for donor broadcast';
  END IF;

  IF nullif(trim(coalesce(h.city,'')), '') IS NULL
     OR nullif(trim(coalesce(h.address,'')), '') IS NULL THEN
    RAISE EXCEPTION 'hospital city and address are required for donor broadcast';
  END IF;

  IF p_broadcast_mode = 'emergency'
     AND (h.lat IS NULL OR h.lng IS NULL) THEN
    RAISE EXCEPTION 'hospital coordinates are required for emergency donor broadcast';
  END IF;

  expiry_at := now() + make_interval(mins => p_duration_minutes);
  IF p_needed_by IS NOT NULL AND p_needed_by < expiry_at THEN
    expiry_at := p_needed_by;
  END IF;

  INSERT INTO public.blood_requests (
    requester_id, hospital_id, patient_name, blood_group, units,
    urgency, status, needed_by, notes,
    broadcast_mode, broadcast_expires_at, donor_target_count
  )
  VALUES (
    auth.uid(), h.id, trim(p_patient_name), p_blood_group, p_units,
    p_urgency, 'open', p_needed_by,
    nullif(trim(coalesce(p_notes,'')), ''),
    p_broadcast_mode, expiry_at, p_donor_target_count
  )
  RETURNING * INTO r;

  INSERT INTO public.audit_logs(actor_id, action, table_name, record_id, new_data)
  VALUES (
    auth.uid(),
    'blood_broadcast.created',
    'blood_requests',
    r.id::text,
    jsonb_build_object(
      'hospital_id', h.id,
      'blood_group', p_blood_group,
      'units', p_units,
      'urgency', p_urgency,
      'broadcast_mode', p_broadcast_mode,
      'broadcast_expires_at', expiry_at,
      'donor_target_count', p_donor_target_count
    )
  );

  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.offer_blood_broadcast_response(p_request_id uuid)
RETURNS public.blood_broadcast_responses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  donor public.blood_donors;
  profile_row public.profiles;
  r public.blood_requests;
  response_row public.blood_broadcast_responses;
  active_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT d.* INTO donor
  FROM public.blood_donors d
  WHERE d.profile_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND OR NOT donor.is_eligible OR NOT donor.is_available THEN
    RAISE EXCEPTION 'donor is not currently eligible and available';
  END IF;

  SELECT p.* INTO profile_row
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF EXISTS (
    SELECT 1 FROM public.blood_broadcast_responses br
    WHERE br.donor_id = donor.id AND br.status IN ('queued','confirmed')
  ) OR EXISTS (
    SELECT 1 FROM public.blood_donor_offers bo
    WHERE bo.donor_id = donor.id AND bo.status IN ('offered','accepted')
  ) THEN
    RAISE EXCEPTION 'donor is already committed to another blood response';
  END IF;

  SELECT r.* INTO r
  FROM public.blood_requests r
  JOIN public.hospitals h ON h.id = r.hospital_id
  WHERE r.id = p_request_id
    AND r.hospital_id IS NOT NULL
    AND h.verification = 'verified'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'blood broadcast not found';
  END IF;

  IF r.status NOT IN ('open','partially_fulfilled') THEN
    RAISE EXCEPTION 'blood request is no longer open';
  END IF;

  IF r.broadcast_closed_at IS NOT NULL OR r.broadcast_expires_at <= now() THEN
    RAISE EXCEPTION 'blood broadcast is no longer active';
  END IF;

  IF profile_row.city IS NULL THEN
    RAISE EXCEPTION 'donor city is required for city-scoped response';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.hospitals h
    WHERE h.id = r.hospital_id
      AND h.city IS NOT NULL
      AND lower(trim(h.city)) = lower(trim(profile_row.city))
  ) THEN
    RAISE EXCEPTION 'blood broadcast is outside the donor city';
  END IF;

  IF NOT public.blood_compatible(donor.blood_group, r.blood_group) THEN
    RAISE EXCEPTION 'donor blood group is not compatible with this request';
  END IF;

  IF r.donor_target_count IS NOT NULL THEN
    SELECT count(*) INTO active_count
    FROM public.blood_broadcast_responses br
    WHERE br.request_id = r.id
      AND br.status IN ('queued','confirmed');

    IF active_count >= r.donor_target_count THEN
      UPDATE public.blood_requests
      SET broadcast_closed_at = COALESCE(broadcast_closed_at, now())
      WHERE id = r.id;
      RAISE EXCEPTION 'donor target has already been reached';
    END IF;
  END IF;

  INSERT INTO public.blood_broadcast_responses(request_id, donor_id, status)
  VALUES (r.id, donor.id, 'queued')
  RETURNING * INTO response_row;

  SELECT count(*) INTO active_count
  FROM public.blood_broadcast_responses br
  WHERE br.request_id = r.id
    AND br.status IN ('queued','confirmed');

  IF r.donor_target_count IS NOT NULL
     AND active_count >= r.donor_target_count THEN
    UPDATE public.blood_requests
    SET broadcast_closed_at = now()
    WHERE id = r.id;

    INSERT INTO public.notifications(user_id, type, title, body, data, priority)
    SELECT h.owner_id,
           'blood_broadcast.target_reached',
           'Blood donor target reached',
           'Your ' || r.blood_group || ' blood broadcast has reached ' || active_count || ' donor responses.',
           jsonb_build_object(
             'blood_request_id', r.id,
             'response_count', active_count,
             'target_count', r.donor_target_count
           ),
           CASE WHEN r.broadcast_mode = 'emergency' THEN 'critical'::notification_priority ELSE 'high'::notification_priority END
    FROM public.hospitals h
    WHERE h.id = r.hospital_id;
  END IF;

  INSERT INTO public.notifications(user_id, type, title, body, data, priority)
  SELECT h.owner_id,
         'blood_broadcast.response',
         CASE WHEN r.broadcast_mode = 'emergency' THEN '🚨 Emergency donor response' ELSE 'New blood donor response' END,
         'A donor has joined your ' || r.blood_group || ' blood response queue.',
         jsonb_build_object(
           'blood_request_id', r.id,
           'response_id', response_row.id,
           'blood_group', r.blood_group,
           'broadcast_mode', r.broadcast_mode
         ),
         CASE WHEN r.broadcast_mode = 'emergency' THEN 'critical'::notification_priority ELSE 'high'::notification_priority END
  FROM public.hospitals h
  WHERE h.id = r.hospital_id;

  INSERT INTO public.audit_logs(actor_id, action, table_name, record_id, new_data)
  VALUES (
    auth.uid(),
    'blood_broadcast.response_queued',
    'blood_broadcast_responses',
    response_row.id::text,
    jsonb_build_object(
      'request_id', r.id,
      'donor_id', donor.id,
      'broadcast_mode', r.broadcast_mode
    )
  );

  RETURN response_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_hospital_blood_broadcasts(p_hospital_id uuid)
RETURNS TABLE (
  request_id uuid,
  patient_name text,
  blood_group blood_group,
  units int,
  units_fulfilled int,
  urgency urgency_level,
  broadcast_mode text,
  status request_status,
  needed_by timestamptz,
  broadcast_expires_at timestamptz,
  donor_target_count int,
  response_count bigint,
  broadcast_closed_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NOT public.is_admin()
     AND NOT EXISTS (
       SELECT 1 FROM public.hospitals h
       WHERE h.id = p_hospital_id AND h.owner_id = auth.uid()
     )
  THEN
    RAISE EXCEPTION 'hospital access required';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.patient_name,
    r.blood_group,
    r.units,
    r.units_fulfilled,
    r.urgency,
    r.broadcast_mode,
    r.status,
    r.needed_by,
    r.broadcast_expires_at,
    r.donor_target_count,
    (
      SELECT count(*)
      FROM public.blood_broadcast_responses br
      WHERE br.request_id = r.id
        AND br.status IN ('queued','confirmed')
    ),
    r.broadcast_closed_at,
    r.created_at
  FROM public.blood_requests r
  WHERE r.hospital_id = p_hospital_id
  ORDER BY
    CASE WHEN r.broadcast_closed_at IS NULL AND r.broadcast_expires_at > now() THEN 0 ELSE 1 END,
    CASE r.broadcast_mode WHEN 'emergency' THEN 0 ELSE 1 END,
    CASE r.urgency WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'standard' THEN 2 ELSE 3 END,
    r.created_at DESC
  LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_hospital_blood_broadcast_responses(p_request_id uuid)
RETURNS TABLE (
  response_id uuid,
  donor_id uuid,
  donor_name text,
  donor_phone text,
  donor_blood_group blood_group,
  donor_city text,
  status public.blood_broadcast_response_status,
  responded_at timestamptz,
  confirmed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NOT public.is_admin()
     AND NOT EXISTS (
       SELECT 1
       FROM public.blood_requests r
       JOIN public.hospitals h ON h.id = r.hospital_id
       WHERE r.id = p_request_id AND h.owner_id = auth.uid()
     )
  THEN
    RAISE EXCEPTION 'hospital access required';
  END IF;

  RETURN QUERY
  SELECT
    br.id,
    d.id,
    p.full_name,
    CASE WHEN br.status = 'confirmed' THEN p.phone ELSE NULL END,
    d.blood_group,
    p.city,
    br.status,
    br.responded_at,
    br.confirmed_at
  FROM public.blood_broadcast_responses br
  JOIN public.blood_donors d ON d.id = br.donor_id
  JOIN public.profiles p ON p.id = d.profile_id
  WHERE br.request_id = p_request_id
    AND br.status IN ('queued','confirmed')
  ORDER BY
    CASE br.status WHEN 'queued' THEN 0 ELSE 1 END,
    br.responded_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_blood_broadcast_response(p_response_id uuid)
RETURNS public.blood_broadcast_responses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  response_row public.blood_broadcast_responses;
  request_row public.blood_requests;
  donor public.blood_donors;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT br.* INTO response_row
  FROM public.blood_broadcast_responses br
  WHERE br.id = p_response_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'blood donor response not found';
  END IF;

  SELECT r.* INTO request_row
  FROM public.blood_requests r
  WHERE r.id = response_row.request_id
  FOR UPDATE;

  IF NOT public.is_admin()
     AND NOT EXISTS (
       SELECT 1 FROM public.hospitals h
       WHERE h.id = request_row.hospital_id
         AND h.owner_id = auth.uid()
     )
  THEN
    RAISE EXCEPTION 'hospital access required';
  END IF;

  IF response_row.status <> 'queued' THEN
    RAISE EXCEPTION 'only queued donor responses can be confirmed';
  END IF;

  IF request_row.status NOT IN ('open','partially_fulfilled') THEN
    RAISE EXCEPTION 'blood request is no longer open';
  END IF;

  SELECT d.* INTO donor
  FROM public.blood_donors d
  WHERE d.id = response_row.donor_id
  FOR UPDATE;

  IF NOT FOUND OR NOT donor.is_eligible OR NOT donor.is_available THEN
    RAISE EXCEPTION 'donor is no longer eligible and available';
  END IF;

  UPDATE public.blood_broadcast_responses
  SET status = 'confirmed',
      confirmed_at = now(),
      updated_at = now()
  WHERE id = response_row.id
  RETURNING * INTO response_row;

  INSERT INTO public.notifications(user_id,type,title,body,data,priority)
  SELECT d.profile_id,
         'blood_broadcast.confirmed',
         CASE WHEN request_row.broadcast_mode = 'emergency'
              THEN '🚨 Emergency donor response confirmed'
              ELSE 'Donor response confirmed'
         END,
         'The hospital has confirmed your ' || request_row.blood_group || ' donor response. Follow the hospital instructions shown in Blood Network.',
         jsonb_build_object(
           'blood_request_id', request_row.id,
           'response_id', response_row.id,
           'broadcast_mode', request_row.broadcast_mode
         ),
         CASE WHEN request_row.broadcast_mode = 'emergency' THEN 'critical'::notification_priority ELSE 'high'::notification_priority END
  FROM public.blood_donors d
  WHERE d.id = response_row.donor_id;

  INSERT INTO public.audit_logs(actor_id,action,table_name,record_id,new_data)
  VALUES (
    auth.uid(),'blood_broadcast.response_confirmed','blood_broadcast_responses',response_row.id::text,
    jsonb_build_object('request_id',request_row.id,'donor_id',response_row.donor_id)
  );

  RETURN response_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_blood_broadcast_response(p_response_id uuid)
RETURNS public.blood_broadcast_responses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  response_row public.blood_broadcast_responses;
  request_row public.blood_requests;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT br.* INTO response_row FROM public.blood_broadcast_responses br
  WHERE br.id = p_response_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'blood donor response not found'; END IF;

  SELECT r.* INTO request_row FROM public.blood_requests r
  WHERE r.id = response_row.request_id FOR UPDATE;

  IF NOT public.is_admin()
     AND NOT EXISTS (
       SELECT 1 FROM public.hospitals h
       WHERE h.id = request_row.hospital_id AND h.owner_id = auth.uid()
     )
  THEN RAISE EXCEPTION 'hospital access required'; END IF;

  IF response_row.status <> 'queued' THEN
    RAISE EXCEPTION 'only queued donor responses can be declined';
  END IF;

  UPDATE public.blood_broadcast_responses
  SET status='declined', declined_at=now(), updated_at=now()
  WHERE id=response_row.id
  RETURNING * INTO response_row;

  INSERT INTO public.notifications(user_id,type,title,body,data,priority)
  SELECT d.profile_id,'blood_broadcast.declined','Donor response not confirmed',
    'The hospital did not confirm your response for the ' || request_row.blood_group || ' blood request.',
    jsonb_build_object('blood_request_id',request_row.id,'response_id',response_row.id),'normal'
  FROM public.blood_donors d WHERE d.id=response_row.donor_id;

  INSERT INTO public.audit_logs(actor_id,action,table_name,record_id,new_data)
  VALUES (auth.uid(),'blood_broadcast.response_declined','blood_broadcast_responses',response_row.id::text,
    jsonb_build_object('request_id',request_row.id,'donor_id',response_row.donor_id));

  RETURN response_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_blood_broadcast_response(p_response_id uuid)
RETURNS public.blood_broadcast_responses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  response_row public.blood_broadcast_responses;
  request_row public.blood_requests;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT br.* INTO response_row
  FROM public.blood_broadcast_responses br
  JOIN public.blood_donors d ON d.id = br.donor_id
  WHERE br.id = p_response_id AND d.profile_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'response not found or unauthorized'; END IF;

  IF response_row.status NOT IN ('queued','confirmed') THEN
    RAISE EXCEPTION 'response is no longer active';
  END IF;

  SELECT * INTO request_row FROM public.blood_requests WHERE id=response_row.request_id;

  UPDATE public.blood_broadcast_responses
  SET status='withdrawn', withdrawn_at=now(), updated_at=now()
  WHERE id=response_row.id
  RETURNING * INTO response_row;

  INSERT INTO public.notifications(user_id,type,title,body,data,priority)
  SELECT h.owner_id,'blood_broadcast.response_withdrawn','Donor withdrew response',
    'A donor has withdrawn from your ' || request_row.blood_group || ' blood response queue.',
    jsonb_build_object('blood_request_id',request_row.id,'response_id',response_row.id),'high'
  FROM public.hospitals h WHERE h.id=request_row.hospital_id;

  INSERT INTO public.audit_logs(actor_id,action,table_name,record_id,new_data)
  VALUES (auth.uid(),'blood_broadcast.response_withdrawn','blood_broadcast_responses',response_row.id::text,
    jsonb_build_object('request_id',request_row.id));

  RETURN response_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_blood_broadcast(p_request_id uuid)
RETURNS public.blood_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.blood_requests;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT br.* INTO r
  FROM public.blood_requests br
  WHERE br.id=p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'blood request not found'; END IF;

  IF NOT public.is_admin()
     AND NOT EXISTS (
       SELECT 1 FROM public.hospitals h
       WHERE h.id=r.hospital_id AND h.owner_id=auth.uid()
     )
  THEN RAISE EXCEPTION 'hospital access required'; END IF;

  UPDATE public.blood_requests
  SET broadcast_closed_at=COALESCE(broadcast_closed_at,now())
  WHERE id=r.id
  RETURNING * INTO r;

  INSERT INTO public.audit_logs(actor_id,action,table_name,record_id,new_data)
  VALUES(auth.uid(),'blood_broadcast.closed','blood_requests',r.id::text,
    jsonb_build_object('broadcast_closed_at',r.broadcast_closed_at));

  RETURN r;
END;
$$;

-- Replace the legacy blood-request notification trigger with privacy-safe,
-- availability-aware hospital broadcast targeting.
CREATE OR REPLACE FUNCTION public.trg_notify_blood_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     AND NEW.hospital_id IS NOT NULL
     AND COALESCE(NEW.broadcast_expires_at, now()) > now()
     AND EXISTS (
       SELECT 1 FROM public.hospitals h
       WHERE h.id = NEW.hospital_id AND h.verification = 'verified'
     )
  THEN
    INSERT INTO public.notifications(user_id,type,title,body,priority,data)
    SELECT
      d.profile_id,
      CASE WHEN NEW.broadcast_mode = 'emergency'
           THEN 'blood_broadcast.emergency'
           ELSE 'blood_broadcast.normal'
      END,
      CASE WHEN NEW.broadcast_mode = 'emergency'
           THEN '🚨 Emergency blood required'
           ELSE 'Blood donation needed nearby'
      END,
      (
        SELECT h.name || ' needs ' || NEW.blood_group || ' blood.'
        FROM public.hospitals h WHERE h.id = NEW.hospital_id
      )
      || CASE WHEN NEW.needed_by IS NOT NULL
              THEN ' Needed by ' || to_char(NEW.needed_by AT TIME ZONE 'Asia/Dhaka','DD Mon HH24:MI') || '.'
              ELSE ''
         END,
      CASE WHEN NEW.broadcast_mode = 'emergency'
           THEN 'critical'::notification_priority
           WHEN NEW.urgency IN ('high','critical')
           THEN 'high'::notification_priority
           ELSE 'normal'::notification_priority
      END,
      jsonb_build_object(
        'blood_request_id', NEW.id,
        'blood_group', NEW.blood_group,
        'broadcast_mode', NEW.broadcast_mode,
        'urgency', NEW.urgency,
        'needed_by', NEW.needed_by,
        'broadcast_expires_at', NEW.broadcast_expires_at,
        'donor_target_count', NEW.donor_target_count
      )
    FROM public.blood_donors d
    JOIN public.profiles p ON p.id = d.profile_id
    JOIN public.hospitals h ON h.id = NEW.hospital_id
    WHERE d.is_eligible = true
      AND d.is_available = true
      AND p.role = 'citizen'
      AND h.city IS NOT NULL
      AND p.city IS NOT NULL
      AND lower(trim(p.city)) = lower(trim(h.city))
      AND public.blood_compatible(d.blood_group, NEW.blood_group)
      AND NOT EXISTS (
        SELECT 1 FROM public.blood_broadcast_responses br
        WHERE br.donor_id = d.id
          AND br.status IN ('queued','confirmed')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.blood_donor_offers bo
        WHERE bo.donor_id = d.id
          AND bo.status IN ('offered','accepted')
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_blood_request ON public.blood_requests;
CREATE TRIGGER on_blood_request
AFTER INSERT ON public.blood_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_blood_request();

-- Citizens must not directly create clinical blood requests. Hospitals and
-- blood banks use authorized workflows; donors consume safe broadcast RPCs.
DROP POLICY IF EXISTS blood_requests_write ON public.blood_requests;
CREATE POLICY blood_requests_write ON public.blood_requests
FOR INSERT
WITH CHECK (
  requester_id = auth.uid()
  AND (
    public.current_role() IN ('hospital','blood_bank')
    OR public.is_admin()
  )
);

-- Raw request reads are private to the requester/authorized operators.
DROP POLICY IF EXISTS blood_requests_read ON public.blood_requests;
CREATE POLICY blood_requests_read ON public.blood_requests
FOR SELECT
USING (
  requester_id = auth.uid()
  OR public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.hospitals h
    WHERE h.owner_id = auth.uid() AND h.id = hospital_id
  )
  OR EXISTS (
    SELECT 1 FROM public.blood_banks b
    WHERE b.owner_id = auth.uid()
  )
);

REVOKE ALL ON FUNCTION public.get_blood_broadcasts_for_donor() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_blood_broadcasts_for_donor() TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_blood_broadcast_responses() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_blood_broadcast_responses() TO authenticated;

REVOKE ALL ON FUNCTION public.create_hospital_blood_broadcast(uuid,text,blood_group,int,text,urgency_level,timestamptz,int,int,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_hospital_blood_broadcast(uuid,text,blood_group,int,text,urgency_level,timestamptz,int,int,text) TO authenticated;

REVOKE ALL ON FUNCTION public.offer_blood_broadcast_response(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.offer_blood_broadcast_response(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_hospital_blood_broadcasts(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_hospital_blood_broadcasts(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_hospital_blood_broadcast_responses(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_hospital_blood_broadcast_responses(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.confirm_blood_broadcast_response(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.confirm_blood_broadcast_response(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.decline_blood_broadcast_response(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.decline_blood_broadcast_response(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.withdraw_blood_broadcast_response(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_blood_broadcast_response(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.close_blood_broadcast(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.close_blood_broadcast(uuid) TO authenticated;

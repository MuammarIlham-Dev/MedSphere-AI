CREATE OR REPLACE FUNCTION public.get_blood_request_coverage(p_request_id uuid)
RETURNS TABLE (
  request_id uuid,
  units_requested int,
  units_fulfilled int,
  donor_committed_units bigint,
  total_covered_units bigint,
  remaining_uncovered_units bigint,
  queued_donors bigint,
  confirmed_donors bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  r public.blood_requests;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT * INTO r
  FROM public.blood_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'blood request not found';
  END IF;

  IF NOT public.is_admin()
     AND NOT EXISTS (
       SELECT 1
       FROM public.hospitals h
       WHERE h.id = r.hospital_id
         AND h.owner_id = auth.uid()
     )
     AND NOT EXISTS (
       SELECT 1
       FROM public.blood_banks b
       WHERE b.owner_id = auth.uid()
     )
  THEN
    RAISE EXCEPTION 'blood network operator access required';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.units,
    r.units_fulfilled,
    COALESCE((
      SELECT sum(br.units)::bigint
      FROM public.blood_broadcast_responses br
      WHERE br.request_id = r.id
        AND br.status = 'confirmed'
    ), 0::bigint),
    LEAST(
      r.units::bigint,
      r.units_fulfilled::bigint + COALESCE((
        SELECT sum(br.units)::bigint
        FROM public.blood_broadcast_responses br
        WHERE br.request_id = r.id
          AND br.status = 'confirmed'
      ), 0::bigint)
    ),
    GREATEST(
      r.units::bigint - (
        r.units_fulfilled::bigint + COALESCE((
          SELECT sum(br.units)::bigint
          FROM public.blood_broadcast_responses br
          WHERE br.request_id = r.id
            AND br.status = 'confirmed'
        ), 0::bigint)
      ),
      0::bigint
    ),
    (
      SELECT count(*)::bigint
      FROM public.blood_broadcast_responses br
      WHERE br.request_id = r.id AND br.status = 'queued'
    ),
    (
      SELECT count(*)::bigint
      FROM public.blood_broadcast_responses br
      WHERE br.request_id = r.id AND br.status = 'confirmed'
    );
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
  committed_units bigint;
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
       WHERE h.id = request_row.hospital_id AND h.owner_id = auth.uid()
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

  IF request_row.broadcast_closed_at IS NOT NULL
     OR request_row.broadcast_expires_at <= now()
  THEN
    RAISE EXCEPTION 'blood broadcast is no longer active';
  END IF;

  SELECT d.* INTO donor
  FROM public.blood_donors d
  WHERE d.id = response_row.donor_id
  FOR UPDATE;

  IF NOT FOUND OR NOT donor.is_eligible OR NOT donor.is_available THEN
    RAISE EXCEPTION 'donor is no longer eligible and available';
  END IF;

  SELECT COALESCE(sum(br.units),0)::bigint INTO committed_units
  FROM public.blood_broadcast_responses br
  WHERE br.request_id = request_row.id
    AND br.status = 'confirmed'
    AND br.id <> response_row.id;

  IF request_row.units_fulfilled::bigint + committed_units + response_row.units
      > request_row.units
  THEN
    RAISE EXCEPTION 'donor commitment would exceed requested units';
  END IF;

  UPDATE public.blood_broadcast_responses
  SET status='confirmed',
      confirmed_at=now(),
      updated_at=now()
  WHERE id=response_row.id
  RETURNING * INTO response_row;

  INSERT INTO public.notifications(user_id,type,title,body,data,priority)
  SELECT d.profile_id,
         'blood_broadcast.confirmed',
         CASE WHEN request_row.broadcast_mode='emergency'
              THEN '🚨 Emergency donor response confirmed'
              ELSE 'Donor response confirmed'
         END,
         'The hospital has confirmed your ' || request_row.blood_group ||
         ' donor response. Follow the hospital screening instructions.',
         jsonb_build_object(
           'blood_request_id',request_row.id,
           'response_id',response_row.id,
           'units',response_row.units,
           'broadcast_mode',request_row.broadcast_mode
         ),
         CASE WHEN request_row.broadcast_mode='emergency'
              THEN 'critical'::notification_priority
              ELSE 'high'::notification_priority END
  FROM public.blood_donors d
  WHERE d.id=response_row.donor_id;

  INSERT INTO public.audit_logs(actor_id,action,table_name,record_id,new_data)
  VALUES(
    auth.uid(),
    'blood_broadcast.response_confirmed',
    'blood_broadcast_responses',
    response_row.id::text,
    jsonb_build_object(
      'request_id',request_row.id,
      'donor_id',response_row.donor_id,
      'units',response_row.units
    )
  );

  RETURN response_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_excess_blood_broadcast_commitments(
  p_request_id uuid
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.blood_requests;
  required_confirmed bigint;
  current_confirmed bigint;
  released_count int := 0;
  response_row public.blood_broadcast_responses;
BEGIN
  SELECT * INTO r
  FROM public.blood_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  required_confirmed := GREATEST(r.units::bigint - r.units_fulfilled::bigint, 0);

  SELECT count(*)::bigint INTO current_confirmed
  FROM public.blood_broadcast_responses br
  WHERE br.request_id=r.id
    AND br.status='confirmed';

  IF current_confirmed <= required_confirmed THEN
    RETURN 0;
  END IF;

  FOR response_row IN
    SELECT br.*
    FROM public.blood_broadcast_responses br
    WHERE br.request_id=r.id
      AND br.status='confirmed'
    ORDER BY br.confirmed_at DESC NULLS LAST, br.responded_at DESC
    LIMIT GREATEST(current_confirmed - required_confirmed, 0)
    FOR UPDATE
  LOOP
    UPDATE public.blood_broadcast_responses
    SET status='released',
        released_at=now(),
        updated_at=now()
    WHERE id=response_row.id;

    released_count := released_count + 1;

    INSERT INTO public.notifications(user_id,type,title,body,data,priority)
    SELECT d.profile_id,
           'blood_broadcast.released',
           'Blood donor commitment released',
           'Your donor response is no longer required because the hospital requirement is now covered.',
           jsonb_build_object(
             'blood_request_id',r.id,
             'response_id',response_row.id
           ),
           CASE WHEN r.broadcast_mode='emergency'
                THEN 'high'::notification_priority
                ELSE 'normal'::notification_priority END
    FROM public.blood_donors d
    WHERE d.id=response_row.donor_id;

    INSERT INTO public.audit_logs(actor_id,action,table_name,record_id,new_data)
    VALUES(
      auth.uid(),
      'blood_broadcast.response_released',
      'blood_broadcast_responses',
      response_row.id::text,
      jsonb_build_object('request_id',r.id,'reason','coverage_rebalanced')
    );
  END LOOP;

  RETURN released_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_blood_bank_donor_commitments(p_bank_id uuid)
RETURNS TABLE (
  response_id uuid,
  request_id uuid,
  donor_id uuid,
  donor_name text,
  donor_phone text,
  donor_blood_group blood_group,
  donor_city text,
  units int,
  hospital_id uuid,
  hospital_name text,
  hospital_city text,
  needed_by timestamptz,
  urgency urgency_level,
  broadcast_mode text,
  confirmed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NOT public.is_admin()
     AND NOT EXISTS (
       SELECT 1 FROM public.blood_banks b
       WHERE b.id=p_bank_id
         AND b.owner_id=auth.uid()
         AND b.verification='verified'
     )
  THEN
    RAISE EXCEPTION 'verified blood bank access required';
  END IF;

  RETURN QUERY
  SELECT
    br.id,
    r.id,
    d.id,
    p.full_name,
    p.phone,
    d.blood_group,
    p.city,
    br.units,
    h.id,
    h.name,
    h.city,
    r.needed_by,
    r.urgency,
    r.broadcast_mode,
    br.confirmed_at
  FROM public.blood_broadcast_responses br
  JOIN public.blood_requests r ON r.id=br.request_id
  JOIN public.hospitals h ON h.id=r.hospital_id
  JOIN public.blood_donors d ON d.id=br.donor_id
  JOIN public.profiles p ON p.id=d.profile_id
  JOIN public.blood_banks b ON b.id=p_bank_id
  WHERE br.status='confirmed'
    AND r.status IN ('open','partially_fulfilled')
    AND r.units_fulfilled < r.units
    AND (
      r.hospital_id=b.hospital_id
      OR (
        b.city IS NOT NULL AND h.city IS NOT NULL
        AND lower(trim(b.city))=lower(trim(h.city))
      )
    )
  ORDER BY
    CASE WHEN r.broadcast_mode='emergency' THEN 0 ELSE 1 END,
    CASE r.urgency WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'standard' THEN 2 ELSE 3 END,
    br.confirmed_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_broadcast_donor_donation(
  p_response_id uuid,
  p_bank_id uuid,
  p_units int DEFAULT 1
)
RETURNS public.blood_donations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  response_row public.blood_broadcast_responses;
  request_row public.blood_requests;
  donor public.blood_donors;
  bank public.blood_banks;
  hospital_row public.hospitals;
  result public.blood_donations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT * INTO bank
  FROM public.blood_banks b
  WHERE b.id=p_bank_id
    AND (b.owner_id=auth.uid() OR public.is_admin())
    AND b.verification='verified'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'verified blood bank required';
  END IF;

  SELECT * INTO response_row
  FROM public.blood_broadcast_responses
  WHERE id=p_response_id
    AND status='confirmed'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'confirmed donor response not found';
  END IF;

  SELECT * INTO request_row
  FROM public.blood_requests
  WHERE id=response_row.request_id
  FOR UPDATE;

  IF NOT FOUND OR request_row.status NOT IN ('open','partially_fulfilled') THEN
    RAISE EXCEPTION 'blood request is no longer open';
  END IF;

  SELECT * INTO hospital_row
  FROM public.hospitals
  WHERE id=request_row.hospital_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hospital not found';
  END IF;

  IF NOT (
    bank.hospital_id=hospital_row.id
    OR (
      bank.city IS NOT NULL AND hospital_row.city IS NOT NULL
      AND lower(trim(bank.city))=lower(trim(hospital_row.city))
    )
  ) THEN
    RAISE EXCEPTION 'blood bank is outside the request coordination area';
  END IF;

  IF p_units < 1 OR p_units > response_row.units THEN
    RAISE EXCEPTION 'invalid donation units';
  END IF;

  IF p_units > (request_row.units-request_row.units_fulfilled) THEN
    RAISE EXCEPTION 'donation exceeds remaining requested units';
  END IF;

  SELECT * INTO donor
  FROM public.blood_donors
  WHERE id=response_row.donor_id
  FOR UPDATE;

  IF NOT FOUND OR NOT donor.is_eligible THEN
    RAISE EXCEPTION 'donor is no longer clinically eligible';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.blood_donations
    WHERE broadcast_response_id=response_row.id
  ) THEN
    RAISE EXCEPTION 'donor response has already been fulfilled';
  END IF;

  INSERT INTO public.blood_donations(
    donor_id, bank_id, broadcast_response_id, donated_at, units
  )
  VALUES(
    donor.id, bank.id, response_row.id, current_date, p_units
  )
  RETURNING * INTO result;

  UPDATE public.blood_broadcast_responses
  SET status='fulfilled',
      fulfilled_at=now(),
      updated_at=now()
  WHERE id=response_row.id;

  UPDATE public.blood_donors
  SET last_donation_at=current_date,
      donation_count=donation_count+1,
      is_available=false,
      is_eligible=false
  WHERE id=donor.id;

  UPDATE public.blood_requests
  SET units_fulfilled=units_fulfilled+p_units,
      status=CASE
        WHEN units_fulfilled+p_units >= units
        THEN 'fulfilled'::request_status
        ELSE 'partially_fulfilled'::request_status
      END
  WHERE id=request_row.id
  RETURNING * INTO request_row;

  IF request_row.status='fulfilled' THEN
    PERFORM public.release_excess_blood_broadcast_commitments(request_row.id);
  END IF;

  INSERT INTO public.notifications(user_id,type,title,body,data,priority)
  SELECT d.profile_id,
         'blood_broadcast.donation_recorded',
         'Blood donation recorded',
         'Your donation has been recorded against the hospital blood request.',
         jsonb_build_object(
           'blood_request_id',request_row.id,
           'response_id',response_row.id,
           'donation_id',result.id,
           'units',p_units
         ),
         'high'
  FROM public.blood_donors d
  WHERE d.id=donor.id;

  INSERT INTO public.notifications(user_id,type,title,body,data,priority)
  VALUES(
    request_row.requester_id,
    'blood_request.donor_fulfilled',
    'Donor blood received',
    p_units || ' unit(s) of ' || request_row.blood_group || ' blood were recorded from the donor network.',
    jsonb_build_object(
      'blood_request_id',request_row.id,
      'donation_id',result.id,
      'units',p_units
    ),
    'high'
  );

  INSERT INTO public.audit_logs(actor_id,action,table_name,record_id,new_data)
  VALUES(
    auth.uid(),
    'blood_request.donor_fulfilled',
    'blood_donations',
    result.id::text,
    jsonb_build_object(
      'request_id',request_row.id,
      'response_id',response_row.id,
      'bank_id',bank.id,
      'units',p_units
    )
  );

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_blood_request_coverage(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.get_blood_request_coverage(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.confirm_blood_broadcast_response(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.confirm_blood_broadcast_response(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.release_excess_blood_broadcast_commitments(uuid) FROM public,anon,authenticated;

REVOKE ALL ON FUNCTION public.get_blood_bank_donor_commitments(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.get_blood_bank_donor_commitments(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.confirm_broadcast_donor_donation(uuid,uuid,int) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.confirm_broadcast_donor_donation(uuid,uuid,int) TO authenticated;

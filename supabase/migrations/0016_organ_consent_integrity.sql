-- 0016_organ_consent_integrity.sql
-- Verifiable pledge -> registry consent -> withdrawal lifecycle.

CREATE TABLE IF NOT EXISTS public.organ_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid NOT NULL REFERENCES public.organ_donors(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  from_status consent_status,
  to_status consent_status NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('pledged','granted','withdrawn','amended')),
  evidence_file_id uuid REFERENCES public.files(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organ_consent_events_donor_idx
  ON public.organ_consent_events(donor_id, created_at DESC);

ALTER TABLE public.organ_consent_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organ_donors_insert ON public.organ_donors;
DROP POLICY IF EXISTS organ_donors_update ON public.organ_donors;

CREATE POLICY organ_consent_events_read
ON public.organ_consent_events FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.organ_donors d
    WHERE d.id = donor_id AND d.profile_id = auth.uid()
  )
  OR public.is_admin()
  OR public.current_role() = 'organ_authority'
);

CREATE OR REPLACE FUNCTION public.register_organ_donor_pledge(
  p_blood_group blood_group,
  p_organs organ_type[],
  p_hla jsonb DEFAULT '[]'::jsonb
) RETURNS public.organ_donors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing public.organ_donors;
  result public.organ_donors;
  changed boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_organs IS NULL OR COALESCE(array_length(p_organs, 1), 0) = 0 THEN
    RAISE EXCEPTION 'at least one organ must be selected';
  END IF;

  SELECT * INTO existing
  FROM public.organ_donors
  WHERE profile_id = auth.uid()
  FOR UPDATE;

  IF FOUND THEN
    changed :=
      existing.blood_group IS DISTINCT FROM p_blood_group
      OR existing.organs IS DISTINCT FROM p_organs
      OR existing.hla IS DISTINCT FROM COALESCE(p_hla, '[]'::jsonb);

    UPDATE public.organ_donors
    SET blood_group = p_blood_group,
        organs = p_organs,
        hla = COALESCE(p_hla, '[]'::jsonb),
        status = 'active',
        consent = CASE WHEN changed THEN 'pending'::consent_status ELSE existing.consent END
    WHERE id = existing.id
    RETURNING * INTO result;

    IF changed THEN
      INSERT INTO public.organ_consent_events(
        donor_id, actor_id, from_status, to_status, event_type, notes
      ) VALUES (
        result.id, auth.uid(), existing.consent, 'pending', 'amended',
        'Citizen amended organ donation pledge; registry review required.'
      );
    END IF;
  ELSE
    INSERT INTO public.organ_donors(
      profile_id, blood_group, organs, hla, consent, status
    ) VALUES (
      auth.uid(), p_blood_group, p_organs, COALESCE(p_hla, '[]'::jsonb),
      'pending', 'active'
    )
    RETURNING * INTO result;

    INSERT INTO public.organ_consent_events(
      donor_id, actor_id, from_status, to_status, event_type
    ) VALUES (result.id, auth.uid(), NULL, 'pending', 'pledged');
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.register_organ_donor_pledge(blood_group,organ_type[],jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.register_organ_donor_pledge(blood_group,organ_type[],jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.withdraw_organ_consent(
  p_donor_id uuid
) RETURNS public.organ_donors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previous consent_status;
  result public.organ_donors;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT consent INTO previous
  FROM public.organ_donors
  WHERE id = p_donor_id AND profile_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'donor record not found'; END IF;

  UPDATE public.organ_donors
  SET consent = 'withdrawn'
  WHERE id = p_donor_id
  RETURNING * INTO result;

  INSERT INTO public.organ_consent_events(
    donor_id, actor_id, from_status, to_status, event_type
  ) VALUES (p_donor_id, auth.uid(), previous, 'withdrawn', 'withdrawn');

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_organ_consent(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.withdraw_organ_consent(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_organ_consent(
  p_donor_id uuid,
  p_consent consent_status,
  p_file_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS public.organ_donors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previous consent_status;
  result public.organ_donors;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT consent INTO previous
  FROM public.organ_donors
  WHERE id = p_donor_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'donor record not found'; END IF;

  IF p_consent = 'withdrawn' AND EXISTS (
    SELECT 1 FROM public.organ_donors
    WHERE id = p_donor_id AND profile_id = auth.uid()
  ) THEN
    RETURN public.withdraw_organ_consent(p_donor_id);
  END IF;

  IF NOT (public.current_role() = 'organ_authority' OR public.is_admin())
     OR p_consent <> 'granted' THEN
    RAISE EXCEPTION 'only an authorized organ registry can grant consent';
  END IF;

  IF previous <> 'pending' THEN
    RAISE EXCEPTION 'only pending organ pledges can be granted';
  END IF;

  UPDATE public.organ_donors
  SET consent = 'granted',
      consent_file_id = p_file_id
  WHERE id = p_donor_id
  RETURNING * INTO result;

  INSERT INTO public.organ_consent_events(
    donor_id, actor_id, from_status, to_status, event_type, evidence_file_id, notes
  ) VALUES (p_donor_id, auth.uid(), previous, 'granted', 'granted', p_file_id, p_notes);

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.update_organ_consent(uuid,consent_status,uuid,text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_organ_consent(uuid,consent_status,uuid,text) TO authenticated;

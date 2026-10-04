-- 0015_blood_network_integrity.sql
-- Separate donor availability from clinical eligibility and add a real donor-offer workflow.

ALTER TABLE public.blood_donors
  ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;

ALTER TABLE public.blood_requests
  ADD COLUMN IF NOT EXISTS units_fulfilled int NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'blood_requests_units_fulfilled_check'
  ) THEN
    ALTER TABLE public.blood_requests
      ADD CONSTRAINT blood_requests_units_fulfilled_check
      CHECK (units_fulfilled >= 0 AND units_fulfilled <= units);
  END IF;
END $$;

ALTER TABLE public.blood_donations
  ADD COLUMN IF NOT EXISTS offer_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS blood_donations_offer_idx
  ON public.blood_donations(offer_id)
  WHERE offer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.blood_donor_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  donor_id uuid NOT NULL REFERENCES public.blood_donors(id) ON DELETE CASCADE,
  units int NOT NULL CHECK (units > 0),
  status text NOT NULL DEFAULT 'offered'
    CHECK (status IN ('offered','accepted','declined','fulfilled','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  fulfilled_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS blood_donor_active_offer_idx
  ON public.blood_donor_offers(request_id, donor_id)
  WHERE status IN ('offered','accepted');

CREATE INDEX IF NOT EXISTS blood_donor_offers_request_idx
  ON public.blood_donor_offers(request_id, status);

CREATE INDEX IF NOT EXISTS blood_donor_offers_donor_idx
  ON public.blood_donor_offers(donor_id, status);

ALTER TABLE public.blood_donor_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blood_donors_self ON public.blood_donors;

CREATE POLICY blood_donors_read
ON public.blood_donors FOR SELECT USING (
  profile_id = auth.uid()
  OR public.is_admin()
  OR public.current_role() IN ('hospital','blood_bank')
);

CREATE POLICY blood_donors_self_update
ON public.blood_donors FOR UPDATE
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

CREATE OR REPLACE FUNCTION public.protect_blood_donor_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_role() = 'citizen'
     AND (
       NEW.is_eligible IS DISTINCT FROM OLD.is_eligible
       OR NEW.last_donation_at IS DISTINCT FROM OLD.last_donation_at
       OR NEW.donation_count IS DISTINCT FROM OLD.donation_count
     ) THEN
    RAISE EXCEPTION 'clinical donor eligibility and donation history are managed by authorized operators';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_blood_donor_history ON public.blood_donors;

CREATE TRIGGER tr_protect_blood_donor_history
BEFORE UPDATE ON public.blood_donors
FOR EACH ROW EXECUTE FUNCTION public.protect_blood_donor_history();

CREATE OR REPLACE FUNCTION public.get_public_blood_requests()
RETURNS TABLE (
  id uuid,
  hospital_id uuid,
  patient_name text,
  blood_group blood_group,
  units int,
  urgency urgency_level,
  status request_status,
  needed_by timestamptz,
  notes text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.hospital_id,
    'Private blood request',
    r.blood_group,
    GREATEST(r.units - r.units_fulfilled, 0),
    r.urgency,
    r.status,
    r.needed_by,
    NULL::text,
    r.created_at
  FROM public.blood_requests r
  WHERE r.status IN ('open','partially_fulfilled')
    AND r.units_fulfilled < r.units
  ORDER BY
    CASE r.urgency
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'standard' THEN 3
      ELSE 4
    END,
    r.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_public_blood_requests() FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_blood_requests() TO authenticated;

CREATE OR REPLACE FUNCTION public.offer_blood_donation(
  p_request_id uuid,
  p_units int DEFAULT 1
)
RETURNS public.blood_donor_offers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.blood_donors;
  r public.blood_requests;
  result public.blood_donor_offers;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_units < 1 THEN RAISE EXCEPTION 'units must be positive'; END IF;

  SELECT * INTO d
  FROM public.blood_donors
  WHERE profile_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND OR NOT d.is_available OR NOT d.is_eligible THEN
    RAISE EXCEPTION 'donor is not currently eligible and available';
  END IF;

  SELECT * INTO r
  FROM public.blood_requests
  WHERE id = p_request_id
    AND status IN ('open','partially_fulfilled')
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'blood request is no longer open'; END IF;

  IF public.blood_compatible(d.blood_group, r.blood_group) IS NOT TRUE THEN
    RAISE EXCEPTION 'donor blood group is not compatible with this request';
  END IF;

  IF p_units > (r.units - r.units_fulfilled) THEN
    RAISE EXCEPTION 'offer exceeds remaining requested units';
  END IF;

  INSERT INTO public.blood_donor_offers(request_id, donor_id, units)
  VALUES (p_request_id, d.id, p_units)
  ON CONFLICT DO NOTHING
  RETURNING * INTO result;

  IF NOT FOUND THEN
    SELECT * INTO result
    FROM public.blood_donor_offers
    WHERE request_id = p_request_id
      AND donor_id = d.id
      AND status IN ('offered','accepted')
    LIMIT 1;
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.offer_blood_donation(uuid,int) FROM public;
GRANT EXECUTE ON FUNCTION public.offer_blood_donation(uuid,int) TO authenticated;

CREATE POLICY blood_donor_offers_read
ON public.blood_donor_offers FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.blood_donors d
    WHERE d.id = donor_id AND d.profile_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.blood_requests r
    WHERE r.id = request_id AND r.requester_id = auth.uid()
  )
  OR public.current_role() IN ('blood_bank','hospital')
  OR public.is_admin()
);

CREATE OR REPLACE FUNCTION public.accept_blood_donation_offer(
  p_offer_id uuid
)
RETURNS public.blood_donor_offers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result public.blood_donor_offers;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  UPDATE public.blood_donor_offers o
  SET status = 'accepted', accepted_at = now()
  WHERE o.id = p_offer_id
    AND o.status = 'offered'
    AND EXISTS (
      SELECT 1 FROM public.blood_requests r
      WHERE r.id = o.request_id AND r.requester_id = auth.uid()
    );

  IF NOT FOUND THEN RAISE EXCEPTION 'offer not found or not authorized'; END IF;

  SELECT * INTO result FROM public.blood_donor_offers WHERE id = p_offer_id;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_blood_donation_offer(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.accept_blood_donation_offer(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_blood_bank_offers(p_bank_id uuid)
RETURNS TABLE (
  offer_id uuid,
  request_id uuid,
  donor_id uuid,
  donor_name text,
  donor_blood_group blood_group,
  units int,
  status text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.request_id,
    o.donor_id,
    p.full_name,
    d.blood_group,
    o.units,
    o.status,
    o.created_at
  FROM public.blood_donor_offers o
  JOIN public.blood_donors d ON d.id = o.donor_id
  JOIN public.profiles p ON p.id = d.profile_id
  JOIN public.blood_requests r ON r.id = o.request_id
  WHERE EXISTS (
    SELECT 1 FROM public.blood_banks b
    WHERE b.id = p_bank_id AND b.owner_id = auth.uid()
  )
  ORDER BY o.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_blood_bank_offers(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_blood_bank_offers(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_blood_donation(
  p_offer_id uuid,
  p_bank_id uuid,
  p_units int DEFAULT 1
)
RETURNS public.blood_donations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.blood_donor_offers;
  d public.blood_donors;
  r public.blood_requests;
  result public.blood_donations;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.blood_banks b
    WHERE b.id = p_bank_id AND b.owner_id = auth.uid()
  ) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'authorized blood bank required';
  END IF;

  SELECT * INTO o
  FROM public.blood_donor_offers
  WHERE id = p_offer_id AND status = 'accepted'
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'accepted donor offer not found'; END IF;

  SELECT * INTO d FROM public.blood_donors WHERE id = o.donor_id FOR UPDATE;
  SELECT * INTO r FROM public.blood_requests WHERE id = o.request_id FOR UPDATE;

  IF p_units < 1 OR p_units > o.units THEN
    RAISE EXCEPTION 'invalid donation units';
  END IF;

  IF p_units > (r.units - r.units_fulfilled) THEN
    RAISE EXCEPTION 'donation exceeds remaining request';
  END IF;

  INSERT INTO public.blood_donations(
    donor_id, bank_id, offer_id, donated_at, units
  ) VALUES (
    d.id, p_bank_id, p_offer_id, current_date, p_units
  )
  RETURNING * INTO result;

  UPDATE public.blood_donor_offers
  SET status = 'fulfilled', fulfilled_at = now()
  WHERE id = o.id;

  UPDATE public.blood_donors
  SET last_donation_at = current_date,
      donation_count = donation_count + 1,
      is_available = false,
      is_eligible = false
  WHERE id = d.id;

  UPDATE public.blood_requests
  SET units_fulfilled = units_fulfilled + p_units,
      status = CASE
        WHEN units_fulfilled + p_units >= units THEN 'fulfilled'::request_status
        ELSE 'partially_fulfilled'::request_status
      END
  WHERE id = r.id;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_blood_donation(uuid,uuid,int) FROM public;
GRANT EXECUTE ON FUNCTION public.confirm_blood_donation(uuid,uuid,int) TO authenticated;

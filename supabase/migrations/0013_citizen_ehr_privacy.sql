-- 0013_citizen_ehr_privacy.sql
-- EHR access boundary: patient-owned prescriptions, explicit pharmacy handoff, completed-care feedback.

CREATE TABLE IF NOT EXISTS public.prescription_pharmacy_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'shared' CHECK (status IN ('shared','accepted','fulfilled','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prescription_pharmacy_shares_pharmacy_idx
  ON public.prescription_pharmacy_shares(pharmacy_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS prescription_pharmacy_shares_patient_idx
  ON public.prescription_pharmacy_shares(patient_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS prescription_pharmacy_active_share_idx
  ON public.prescription_pharmacy_shares(prescription_id, pharmacy_id)
  WHERE status IN ('shared','accepted');

ALTER TABLE public.prescription_pharmacy_shares ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.validate_prescription_pharmacy_share()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prescription_patient uuid;
  pharmacy_verified verification_status;
BEGIN
  SELECT patient_id INTO prescription_patient
  FROM public.prescriptions WHERE id = NEW.prescription_id;
  IF prescription_patient IS NULL OR prescription_patient <> NEW.patient_id THEN
    RAISE EXCEPTION 'prescription and patient do not match';
  END IF;

  SELECT verification INTO pharmacy_verified
  FROM public.pharmacies WHERE id = NEW.pharmacy_id;
  IF pharmacy_verified IS DISTINCT FROM 'verified' THEN
    RAISE EXCEPTION 'verified pharmacy required';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status <> NEW.status THEN
    IF NOT (
      (OLD.status = 'shared' AND NEW.status IN ('accepted','fulfilled','cancelled'))
      OR (OLD.status = 'accepted' AND NEW.status IN ('fulfilled','cancelled'))
    ) THEN
      RAISE EXCEPTION 'invalid prescription share status transition';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_validate_prescription_pharmacy_share ON public.prescription_pharmacy_shares;
CREATE TRIGGER tr_validate_prescription_pharmacy_share
BEFORE INSERT OR UPDATE ON public.prescription_pharmacy_shares
FOR EACH ROW EXECUTE FUNCTION public.validate_prescription_pharmacy_share();

DROP TRIGGER IF EXISTS tr_prescription_pharmacy_shares_updated_at ON public.prescription_pharmacy_shares;
CREATE TRIGGER tr_prescription_pharmacy_shares_updated_at
BEFORE UPDATE ON public.prescription_pharmacy_shares
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Remove ambient pharmacy access. A pharmacy sees a prescription only after a patient explicitly shares it.
DROP POLICY IF EXISTS prescriptions_read ON public.prescriptions;
CREATE POLICY prescriptions_read ON public.prescriptions FOR SELECT USING (
  patient_id = auth.uid()
  OR public.is_admin()
  OR (public.current_role() = 'doctor' AND public.is_treating_doctor(
    patient_id, (SELECT id FROM public.doctors WHERE profile_id = auth.uid())
  ))
  OR (public.current_role() = 'pharmacy' AND EXISTS (
    SELECT 1
    FROM public.prescription_pharmacy_shares s
    JOIN public.pharmacies ph ON ph.id = s.pharmacy_id
    WHERE s.prescription_id = public.prescriptions.id
      AND s.status IN ('shared','accepted','fulfilled')
      AND ph.owner_id = auth.uid()
      AND ph.verification = 'verified'
  ))
);

DROP POLICY IF EXISTS prescription_items_read ON public.prescription_items;
CREATE POLICY prescription_items_read ON public.prescription_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.prescriptions p
    WHERE p.id = prescription_id
      AND (
        p.patient_id = auth.uid()
        OR public.is_admin()
        OR (public.current_role() = 'doctor' AND public.is_treating_doctor(
          p.patient_id, (SELECT id FROM public.doctors WHERE profile_id = auth.uid())
        ))
        OR (public.current_role() = 'pharmacy' AND EXISTS (
          SELECT 1
          FROM public.prescription_pharmacy_shares s
          JOIN public.pharmacies ph ON ph.id = s.pharmacy_id
          WHERE s.prescription_id = p.id
            AND s.status IN ('shared','accepted','fulfilled')
            AND ph.owner_id = auth.uid()
            AND ph.verification = 'verified'
        ))
      )
  )
);

-- Prescription and item creation stays inside the verified doctor consultation RPC.
DROP POLICY IF EXISTS prescriptions_write ON public.prescriptions;
DROP POLICY IF EXISTS prescription_items_write ON public.prescription_items;

DROP POLICY IF EXISTS prescription_pharmacy_shares_select ON public.prescription_pharmacy_shares;
CREATE POLICY prescription_pharmacy_shares_select ON public.prescription_pharmacy_shares
FOR SELECT USING (
  patient_id = auth.uid()
  OR public.is_admin()
  OR (public.current_role() = 'pharmacy' AND EXISTS (
    SELECT 1 FROM public.pharmacies ph
    WHERE ph.id = pharmacy_id
      AND ph.owner_id = auth.uid()
      AND ph.verification = 'verified'
  ))
);

DROP POLICY IF EXISTS prescription_pharmacy_shares_insert ON public.prescription_pharmacy_shares;
CREATE POLICY prescription_pharmacy_shares_insert ON public.prescription_pharmacy_shares
FOR INSERT WITH CHECK (
  patient_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.prescriptions p
    WHERE p.id = prescription_id
      AND p.patient_id = auth.uid()
      AND p.status IN ('active','pending')
  )
);

DROP POLICY IF EXISTS prescription_pharmacy_shares_update ON public.prescription_pharmacy_shares;
CREATE POLICY prescription_pharmacy_shares_update ON public.prescription_pharmacy_shares
FOR UPDATE
USING (patient_id = auth.uid() AND status IN ('shared','accepted'))
WITH CHECK (patient_id = auth.uid() AND status = 'cancelled');

CREATE OR REPLACE FUNCTION public.share_prescription_with_pharmacy(
  p_prescription_id uuid,
  p_pharmacy_id uuid
) RETURNS public.prescription_pharmacy_shares
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_row public.prescriptions;
  share_row public.prescription_pharmacy_shares;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT * INTO p_row
  FROM public.prescriptions
  WHERE id = p_prescription_id AND patient_id = auth.uid()
  FOR SHARE;

  IF NOT FOUND OR p_row.status NOT IN ('active','pending') THEN
    RAISE EXCEPTION 'prescription is not available for pharmacy sharing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pharmacies
    WHERE id = p_pharmacy_id AND verification = 'verified'
  ) THEN
    RAISE EXCEPTION 'verified pharmacy required';
  END IF;

  SELECT * INTO share_row
  FROM public.prescription_pharmacy_shares
  WHERE prescription_id = p_prescription_id
    AND pharmacy_id = p_pharmacy_id
    AND status IN ('shared','accepted')
  LIMIT 1;

  IF FOUND THEN RETURN share_row; END IF;

  INSERT INTO public.prescription_pharmacy_shares (prescription_id, patient_id, pharmacy_id)
  VALUES (p_prescription_id, auth.uid(), p_pharmacy_id)
  RETURNING * INTO share_row;
  RETURN share_row;
END;
$$;

REVOKE ALL ON FUNCTION public.share_prescription_with_pharmacy(uuid,uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.share_prescription_with_pharmacy(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_prescription_pharmacy_share(
  p_share_id uuid
) RETURNS public.prescription_pharmacy_shares
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.prescription_pharmacy_shares;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  UPDATE public.prescription_pharmacy_shares
  SET status = 'cancelled'
  WHERE id = p_share_id
    AND patient_id = auth.uid()
    AND status IN ('shared','accepted')
  RETURNING * INTO result;

  IF NOT FOUND THEN RAISE EXCEPTION 'share not found or cannot be revoked'; END IF;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_prescription_pharmacy_share(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.cancel_prescription_pharmacy_share(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fulfill_prescription_share(
  p_share_id uuid
) RETURNS public.prescriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  share_row public.prescription_pharmacy_shares;
  result public.prescriptions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF public.current_role() <> 'pharmacy' THEN RAISE EXCEPTION 'pharmacy role required'; END IF;

  SELECT s.* INTO share_row
  FROM public.prescription_pharmacy_shares s
  JOIN public.pharmacies ph ON ph.id = s.pharmacy_id
  WHERE s.id = p_share_id
    AND ph.owner_id = auth.uid()
    AND ph.verification = 'verified'
    AND s.status IN ('shared','accepted')
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'prescription share is not available'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.prescriptions
    WHERE id = share_row.prescription_id
      AND status IN ('active','pending')
  ) THEN
    RAISE EXCEPTION 'prescription is no longer available for fulfillment';
  END IF;

  UPDATE public.prescription_pharmacy_shares SET status = 'fulfilled' WHERE id = share_row.id;
  UPDATE public.prescription_pharmacy_shares
  SET status = 'cancelled'
  WHERE prescription_id = share_row.prescription_id
    AND id <> share_row.id
    AND status IN ('shared','accepted');

  UPDATE public.prescriptions SET status = 'fulfilled'
  WHERE id = share_row.prescription_id
  RETURNING * INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.fulfill_prescription_share(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.fulfill_prescription_share(uuid) TO authenticated;

-- Feedback is a post-care artifact, not a booking-time artifact.
DROP POLICY IF EXISTS feedback_rw ON public.appointment_feedback;
CREATE POLICY feedback_insert ON public.appointment_feedback FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = appointment_id
      AND a.patient_id = auth.uid()
      AND a.status = 'completed'
  )
);
CREATE POLICY feedback_update ON public.appointment_feedback FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = appointment_id
      AND a.patient_id = auth.uid()
      AND a.status = 'completed'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = appointment_id
      AND a.patient_id = auth.uid()
      AND a.status = 'completed'
  )
);
CREATE POLICY feedback_delete ON public.appointment_feedback FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = appointment_id
      AND a.patient_id = auth.uid()
      AND a.status = 'completed'
  )
);
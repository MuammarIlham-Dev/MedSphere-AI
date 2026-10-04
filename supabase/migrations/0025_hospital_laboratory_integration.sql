-- 0025: hospital ↔ laboratory coordination and server-authorized lab lifecycle.
-- Keeps diagnostic production inside the laboratory role and exposes only
-- operational metadata to the owning hospital.

ALTER TABLE public.lab_orders
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

ALTER TABLE public.lab_reports
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_by uuid REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS lab_orders_worklist_idx
  ON public.lab_orders(lab_id, status, booked_at DESC);

CREATE INDEX IF NOT EXISTS lab_order_items_worklist_idx
  ON public.lab_order_items(order_id, sample_status);

DROP POLICY IF EXISTS lab_orders_rw ON public.lab_orders;
DROP POLICY IF EXISTS lab_items_rw ON public.lab_order_items;
DROP POLICY IF EXISTS lab_reports_read ON public.lab_reports;
DROP POLICY IF EXISTS lab_reports_write ON public.lab_reports;

CREATE POLICY lab_orders_read ON public.lab_orders
  FOR SELECT USING (
    patient_id = auth.uid()
    OR doctor_id = (SELECT d.id FROM public.doctors d WHERE d.profile_id = auth.uid())
    OR lab_id IN (SELECT l.id FROM public.laboratories l WHERE l.owner_id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY lab_items_read ON public.lab_order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.lab_orders o
      WHERE o.id = order_id
        AND (
          o.patient_id = auth.uid()
          OR o.doctor_id = (SELECT d.id FROM public.doctors d WHERE d.profile_id = auth.uid())
          OR o.lab_id IN (SELECT l.id FROM public.laboratories l WHERE l.owner_id = auth.uid())
          OR public.is_admin()
        )
    )
  );

CREATE POLICY lab_reports_read ON public.lab_reports
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.lab_orders o
      WHERE o.id = order_id
        AND (
          o.lab_id IN (SELECT l.id FROM public.laboratories l WHERE l.owner_id = auth.uid())
          OR (
            o.doctor_id = (SELECT d.id FROM public.doctors d WHERE d.profile_id = auth.uid())
            AND status IN ('verified', 'delivered')
          )
          OR (
            o.patient_id = auth.uid()
            AND status = 'delivered'
          )
        )
    )
  );

CREATE OR REPLACE FUNCTION public.get_hospital_lab_orders(p_hospital_id uuid)
RETURNS TABLE (
  order_id uuid,
  appointment_id uuid,
  patient_id uuid,
  patient_name text,
  doctor_id uuid,
  doctor_name text,
  lab_id uuid,
  lab_name text,
  priority urgency_level,
  order_status report_status,
  booked_at timestamptz,
  test_id uuid,
  test_code text,
  test_name text,
  sample_status sample_status,
  collected_at timestamptz,
  report_id uuid,
  report_status report_status,
  report_code text
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
  WITH latest_reports AS (
    SELECT DISTINCT ON (r.order_id, r.test_id)
      r.id, r.order_id, r.test_id, r.status, r.report_code, r.created_at
    FROM public.lab_reports r
    ORDER BY r.order_id, r.test_id, r.created_at DESC
  )
  SELECT
    o.id, o.appointment_id, o.patient_id, p.full_name,
    o.doctor_id, dp.full_name,
    o.lab_id, l.name, o.priority, o.status, o.booked_at,
    i.test_id, t.code, t.name, i.sample_status, i.collected_at,
    lr.id, lr.status,
    CASE WHEN lr.status IN ('verified', 'delivered') THEN lr.report_code ELSE NULL END
  FROM public.lab_orders o
  JOIN public.appointments a ON a.id = o.appointment_id AND a.hospital_id = p_hospital_id
  JOIN public.profiles p ON p.id = o.patient_id
  LEFT JOIN public.doctors d ON d.id = o.doctor_id
  LEFT JOIN public.profiles dp ON dp.id = d.profile_id
  JOIN public.laboratories l ON l.id = o.lab_id
  JOIN public.lab_order_items i ON i.order_id = o.id
  JOIN public.lab_tests t ON t.id = i.test_id
  LEFT JOIN latest_reports lr ON lr.order_id = o.id AND lr.test_id = i.test_id
  ORDER BY o.booked_at DESC, p.full_name, t.name
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.get_hospital_lab_orders(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_hospital_lab_orders(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_laboratory_worklist(p_lab_id uuid)
RETURNS TABLE (
  order_id uuid,
  appointment_id uuid,
  patient_id uuid,
  patient_name text,
  doctor_id uuid,
  doctor_name text,
  hospital_name text,
  priority urgency_level,
  order_status report_status,
  booked_at timestamptz,
  accepted_at timestamptz,
  test_id uuid,
  test_code text,
  test_name text,
  sample_status sample_status,
  collected_at timestamptz,
  report_id uuid,
  report_status report_status,
  report_code text
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
       SELECT 1 FROM public.laboratories l
       WHERE l.id = p_lab_id
         AND l.owner_id = auth.uid()
         AND l.verification = 'verified'
     )
  THEN
    RAISE EXCEPTION 'verified laboratory access required';
  END IF;

  RETURN QUERY
  WITH latest_reports AS (
    SELECT DISTINCT ON (r.order_id, r.test_id)
      r.id, r.order_id, r.test_id, r.status, r.report_code, r.created_at
    FROM public.lab_reports r
    ORDER BY r.order_id, r.test_id, r.created_at DESC
  )
  SELECT
    o.id, o.appointment_id, o.patient_id, p.full_name,
    o.doctor_id, dp.full_name, h.name,
    o.priority, o.status, o.booked_at, o.accepted_at,
    i.test_id, t.code, t.name, i.sample_status, i.collected_at,
    lr.id, lr.status, lr.report_code
  FROM public.lab_orders o
  JOIN public.profiles p ON p.id = o.patient_id
  LEFT JOIN public.doctors d ON d.id = o.doctor_id
  LEFT JOIN public.profiles dp ON dp.id = d.profile_id
  LEFT JOIN public.appointments a ON a.id = o.appointment_id
  LEFT JOIN public.hospitals h ON h.id = a.hospital_id
  JOIN public.lab_order_items i ON i.order_id = o.id
  JOIN public.lab_tests t ON t.id = i.test_id
  LEFT JOIN latest_reports lr ON lr.order_id = o.id AND lr.test_id = i.test_id
  WHERE o.lab_id = p_lab_id AND o.status <> 'delivered'
  ORDER BY o.booked_at DESC, p.full_name, t.name
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.get_laboratory_worklist(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_laboratory_worklist(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_lab_order(p_order_id uuid)
RETURNS public.lab_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_row public.lab_orders;
  lab_owner uuid;
  lab_verification verification_status;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT o
    INTO order_row
  FROM public.lab_orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  SELECT l.owner_id, l.verification
    INTO lab_owner, lab_verification
  FROM public.laboratories l
  WHERE l.id = order_row.lab_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'laboratory order not found'; END IF;
  IF NOT public.is_admin() AND lab_owner <> auth.uid() THEN RAISE EXCEPTION 'laboratory access required'; END IF;
  IF lab_verification <> 'verified' AND NOT public.is_admin() THEN RAISE EXCEPTION 'verified laboratory required'; END IF;
  IF order_row.status <> 'pending' THEN RAISE EXCEPTION 'only pending laboratory orders can be accepted'; END IF;

  UPDATE public.lab_orders
     SET status = 'in_progress', accepted_at = now(), accepted_by = auth.uid()
   WHERE id = order_row.id
   RETURNING * INTO order_row;

  INSERT INTO public.notifications (user_id, type, title, body, data, priority)
  SELECT o.patient_id, 'lab_order.accepted', 'Laboratory order accepted',
         'Your laboratory has accepted the diagnostic order.',
         jsonb_build_object('lab_order_id', o.id), 'normal'
  FROM public.lab_orders o WHERE o.id = order_row.id;

  INSERT INTO public.notifications (user_id, type, title, body, data, priority)
  SELECT d.profile_id, 'lab_order.accepted', 'Laboratory order accepted',
         'The laboratory has accepted your patient''s diagnostic order.',
         jsonb_build_object('lab_order_id', o.id, 'patient_id', o.patient_id), 'normal'
  FROM public.lab_orders o JOIN public.doctors d ON d.id = o.doctor_id WHERE o.id = order_row.id;

  INSERT INTO public.audit_logs (actor_id, action, table_name, record_id, new_data)
  VALUES (auth.uid(), 'lab_order.accepted', 'lab_orders', order_row.id::text,
          jsonb_build_object('lab_id', order_row.lab_id, 'appointment_id', order_row.appointment_id));

  RETURN order_row;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_lab_order(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.accept_lab_order(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.advance_lab_sample(p_item_id uuid)
RETURNS public.lab_order_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_row public.lab_order_items;
  order_row public.lab_orders;
  lab_owner uuid;
  lab_verification verification_status;
  next_status sample_status;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT i
    INTO item_row
  FROM public.lab_order_items i
  WHERE i.id = p_item_id
  FOR UPDATE;

  SELECT o
    INTO order_row
  FROM public.lab_orders o
  WHERE o.id = item_row.order_id
  FOR UPDATE;

  SELECT l.owner_id, l.verification
    INTO lab_owner, lab_verification
  FROM public.laboratories l
  WHERE l.id = order_row.lab_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'laboratory sample item not found'; END IF;
  IF NOT public.is_admin() AND lab_owner <> auth.uid() THEN RAISE EXCEPTION 'laboratory access required'; END IF;
  IF lab_verification <> 'verified' AND NOT public.is_admin() THEN RAISE EXCEPTION 'verified laboratory required'; END IF;
  IF order_row.status = 'pending' THEN RAISE EXCEPTION 'accept the laboratory order before processing samples'; END IF;

  next_status := CASE item_row.sample_status
    WHEN 'ordered' THEN 'collected'::sample_status
    WHEN 'collected' THEN 'in_transit'::sample_status
    WHEN 'in_transit' THEN 'received'::sample_status
    WHEN 'received' THEN 'processing'::sample_status
    WHEN 'processing' THEN 'analyzed'::sample_status
    ELSE NULL
  END;

  IF next_status IS NULL THEN RAISE EXCEPTION 'sample is already at the terminal analyzed state'; END IF;

  UPDATE public.lab_order_items
     SET sample_status = next_status,
         collected_at = CASE WHEN next_status = 'collected' THEN COALESCE(collected_at, now()) ELSE collected_at END
   WHERE id = item_row.id
   RETURNING * INTO item_row;

  INSERT INTO public.audit_logs (actor_id, action, table_name, record_id, new_data)
  VALUES (auth.uid(), 'lab_sample.advanced', 'lab_order_items', item_row.id::text,
          jsonb_build_object('order_id', item_row.order_id, 'sample_status', item_row.sample_status));

  RETURN item_row;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_lab_sample(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.advance_lab_sample(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_lab_report(
  p_order_id uuid,
  p_test_id uuid,
  p_result_json jsonb,
  p_file_id uuid DEFAULT NULL
)
RETURNS public.lab_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_row public.lab_orders;
  item_row public.lab_order_items;
  lab_owner uuid;
  lab_verification verification_status;
  report_row public.lab_reports;
  report_code_value text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT o.*, l.owner_id, l.verification
    INTO order_row, lab_owner, lab_verification
  FROM public.lab_orders o
  JOIN public.laboratories l ON l.id = o.lab_id
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'laboratory order not found'; END IF;
  IF NOT public.is_admin() AND lab_owner <> auth.uid() THEN RAISE EXCEPTION 'laboratory access required'; END IF;
  IF lab_verification <> 'verified' AND NOT public.is_admin() THEN RAISE EXCEPTION 'verified laboratory required'; END IF;

  SELECT *
    INTO item_row
  FROM public.lab_order_items
  WHERE order_id = p_order_id AND test_id = p_test_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'test is not part of this laboratory order'; END IF;
  IF item_row.sample_status <> 'analyzed' THEN RAISE EXCEPTION 'sample must be analyzed before a report can be created'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.lab_reports r
    WHERE r.order_id = p_order_id AND r.test_id = p_test_id
      AND r.status IN ('completed', 'verified', 'delivered')
  ) THEN
    RAISE EXCEPTION 'a report already exists for this laboratory test';
  END IF;

  IF p_result_json IS NULL OR jsonb_typeof(p_result_json) <> 'object' THEN
    RAISE EXCEPTION 'report result must be a JSON object';
  END IF;

  IF p_file_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.files f
    WHERE f.id = p_file_id AND (f.owner_id = auth.uid() OR public.is_admin())
  ) THEN
    RAISE EXCEPTION 'report file is not accessible';
  END IF;

  LOOP
    report_code_value := 'LAB-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.lab_reports WHERE report_code = report_code_value);
  END LOOP;

  INSERT INTO public.lab_reports (order_id, test_id, file_id, result_json, status, report_code)
  VALUES (p_order_id, p_test_id, p_file_id, p_result_json, 'completed', report_code_value)
  RETURNING * INTO report_row;

  IF NOT EXISTS (
    SELECT 1
    FROM public.lab_order_items i
    WHERE i.order_id = p_order_id
      AND NOT EXISTS (
        SELECT 1 FROM public.lab_reports r
        WHERE r.order_id = p_order_id AND r.test_id = i.test_id
          AND r.status IN ('completed', 'verified', 'delivered')
      )
  ) THEN
    UPDATE public.lab_orders SET status = 'completed', completed_at = now() WHERE id = p_order_id;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, table_name, record_id, new_data)
  VALUES (auth.uid(), 'lab_report.created', 'lab_reports', report_row.id::text,
          jsonb_build_object('order_id', p_order_id, 'test_id', p_test_id, 'report_code', report_row.report_code));

  RETURN report_row;
END;
$$;

REVOKE ALL ON FUNCTION public.create_lab_report(uuid, uuid, jsonb, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_lab_report(uuid, uuid, jsonb, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_lab_report(p_report_id uuid)
RETURNS public.lab_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report_row public.lab_reports;
  order_row public.lab_orders;
  lab_owner uuid;
  lab_verification verification_status;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT r
    INTO report_row
  FROM public.lab_reports r
  WHERE r.id = p_report_id
  FOR UPDATE;

  SELECT o
    INTO order_row
  FROM public.lab_orders o
  WHERE o.id = report_row.order_id
  FOR UPDATE;

  SELECT l.owner_id, l.verification
    INTO lab_owner, lab_verification
  FROM public.laboratories l
  WHERE l.id = order_row.lab_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'laboratory report not found'; END IF;
  IF NOT public.is_admin() AND lab_owner <> auth.uid() THEN RAISE EXCEPTION 'laboratory access required'; END IF;
  IF lab_verification <> 'verified' AND NOT public.is_admin() THEN RAISE EXCEPTION 'verified laboratory required'; END IF;
  IF report_row.status <> 'completed' THEN RAISE EXCEPTION 'only completed reports can be verified'; END IF;

  UPDATE public.lab_reports
     SET status = 'verified', verified_by = auth.uid(), verified_at = now()
   WHERE id = report_row.id
   RETURNING * INTO report_row;

  IF NOT EXISTS (
    SELECT 1 FROM public.lab_order_items i
    WHERE i.order_id = report_row.order_id
      AND NOT EXISTS (
        SELECT 1 FROM public.lab_reports r
        WHERE r.order_id = report_row.order_id AND r.test_id = i.test_id
          AND r.status IN ('verified', 'delivered')
      )
  ) THEN
    UPDATE public.lab_orders SET status = 'verified'
     WHERE id = report_row.order_id AND status IN ('completed', 'in_progress');
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, table_name, record_id, new_data)
  VALUES (auth.uid(), 'lab_report.verified', 'lab_reports', report_row.id::text,
          jsonb_build_object('order_id', report_row.order_id, 'test_id', report_row.test_id));

  RETURN report_row;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_lab_report(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.verify_lab_report(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.deliver_lab_report(p_report_id uuid)
RETURNS public.lab_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report_row public.lab_reports;
  order_row public.lab_orders;
  lab_owner uuid;
  lab_verification verification_status;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT r.*, o.*, l.owner_id, l.verification
    INTO report_row, order_row, lab_owner, lab_verification
  FROM public.lab_reports r
  JOIN public.lab_orders o ON o.id = r.order_id
  JOIN public.laboratories l ON l.id = o.lab_id
  WHERE r.id = p_report_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'laboratory report not found'; END IF;
  IF NOT public.is_admin() AND lab_owner <> auth.uid() THEN RAISE EXCEPTION 'laboratory access required'; END IF;
  IF lab_verification <> 'verified' AND NOT public.is_admin() THEN RAISE EXCEPTION 'verified laboratory required'; END IF;
  IF report_row.status <> 'verified' THEN RAISE EXCEPTION 'only verified reports can be delivered'; END IF;

  UPDATE public.lab_reports
     SET status = 'delivered', delivered_by = auth.uid(), delivered_at = now()
   WHERE id = report_row.id
   RETURNING * INTO report_row;

  IF NOT EXISTS (
    SELECT 1 FROM public.lab_order_items i
    WHERE i.order_id = report_row.order_id
      AND NOT EXISTS (
        SELECT 1 FROM public.lab_reports r
        WHERE r.order_id = report_row.order_id AND r.test_id = i.test_id
          AND r.status = 'delivered'
      )
  ) THEN
    UPDATE public.lab_orders SET status = 'delivered' WHERE id = report_row.order_id;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, table_name, record_id, new_data)
  VALUES (auth.uid(), 'lab_report.delivered', 'lab_reports', report_row.id::text,
          jsonb_build_object('order_id', report_row.order_id, 'test_id', report_row.test_id));

  INSERT INTO public.notifications (user_id, type, title, body, data, priority)
  SELECT o.patient_id, 'lab_report.delivered', 'Laboratory report available',
         'Your verified laboratory report is now available in Medical Records.',
         jsonb_build_object('lab_report_id', report_row.id, 'lab_order_id', o.id), 'high'
  FROM public.lab_orders o WHERE o.id = report_row.order_id;

  INSERT INTO public.notifications (user_id, type, title, body, data, priority)
  SELECT d.profile_id, 'lab_report.delivered', 'Laboratory report delivered',
         'A verified laboratory report is now available for the patient.',
         jsonb_build_object('lab_report_id', report_row.id, 'lab_order_id', o.id), 'normal'
  FROM public.lab_orders o JOIN public.doctors d ON d.id = o.doctor_id
  WHERE o.id = report_row.order_id;

  RETURN report_row;
END;
$$;

REVOKE ALL ON FUNCTION public.deliver_lab_report(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.deliver_lab_report(uuid) TO authenticated;

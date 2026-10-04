-- 0027: multi-user laboratory workspace and independent report QC.

CREATE TABLE public.laboratory_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  laboratory_id uuid NOT NULL REFERENCES public.laboratories(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  staff_role text NOT NULL CHECK (staff_role IN ('technologist','reviewer','manager')),
  active boolean NOT NULL DEFAULT true,
  added_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (laboratory_id, profile_id)
);

CREATE INDEX laboratory_members_profile_idx
  ON public.laboratory_members(profile_id, active);

CREATE INDEX laboratory_members_lab_idx
  ON public.laboratory_members(laboratory_id, active, staff_role);

ALTER TABLE public.laboratory_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY laboratory_members_self_read
  ON public.laboratory_members
  FOR SELECT USING (profile_id = auth.uid() OR public.is_admin());

ALTER TABLE public.lab_reports
  ADD COLUMN IF NOT EXISTS authored_by uuid REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS lab_reports_author_idx
  ON public.lab_reports(authored_by, created_at DESC);

CREATE OR REPLACE FUNCTION public.laboratory_staff_role(
  p_laboratory_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.laboratories l
      WHERE l.id = p_laboratory_id AND l.owner_id = p_user_id
    ) THEN 'manager'
    ELSE (
      SELECT lm.staff_role
      FROM public.laboratory_members lm
      WHERE lm.laboratory_id = p_laboratory_id
        AND lm.profile_id = p_user_id
        AND lm.active
      LIMIT 1
    )
  END
$$;

REVOKE ALL ON FUNCTION public.laboratory_staff_role(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.laboratory_staff_role(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_laboratory_workspace()
RETURNS TABLE (
  laboratory_id uuid,
  laboratory_name text,
  laboratory_city text,
  staff_role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  RETURN QUERY
  SELECT l.id, l.name, l.city, public.laboratory_staff_role(l.id, auth.uid())
  FROM public.laboratories l
  WHERE l.verification = 'verified'
    AND (
      l.owner_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.laboratory_members lm
        WHERE lm.laboratory_id = l.id
          AND lm.profile_id = auth.uid()
          AND lm.active
      )
    )
  ORDER BY l.created_at
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_laboratory_workspace() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_laboratory_workspace() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_laboratory_members(p_laboratory_id uuid)
RETURNS TABLE (
  member_id uuid,
  profile_id uuid,
  full_name text,
  digital_health_id text,
  staff_role text,
  active boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE caller_role text;
BEGIN
  caller_role := public.laboratory_staff_role(p_laboratory_id, auth.uid());
  IF caller_role IS NULL OR caller_role <> 'manager' THEN
    RAISE EXCEPTION 'laboratory manager access required';
  END IF;

  RETURN QUERY
  SELECT lm.id, lm.profile_id, p.full_name, p.digital_health_id,
         lm.staff_role, lm.active, lm.created_at
  FROM public.laboratory_members lm
  JOIN public.profiles p ON p.id = lm.profile_id
  WHERE lm.laboratory_id = p_laboratory_id
  ORDER BY lm.active DESC, lm.staff_role, p.full_name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_laboratory_members(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_laboratory_members(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_laboratory_member_by_dhi(
  p_laboratory_id uuid,
  p_digital_health_id text,
  p_staff_role text
)
RETURNS public.laboratory_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
  target_id uuid;
  member_row public.laboratory_members;
BEGIN
  caller_role := public.laboratory_staff_role(p_laboratory_id, auth.uid());
  IF caller_role IS NULL OR caller_role <> 'manager' THEN
    RAISE EXCEPTION 'laboratory manager access required';
  END IF;

  IF p_staff_role NOT IN ('technologist','reviewer','manager') THEN
    RAISE EXCEPTION 'invalid laboratory staff role';
  END IF;

  SELECT p.id
    INTO target_id
  FROM public.profiles p
  WHERE p.digital_health_id = trim(p_digital_health_id)
    AND p.role = 'laboratory'
  LIMIT 1;

  IF target_id IS NULL THEN
    RAISE EXCEPTION 'no laboratory account found for this Digital Health ID';
  END IF;

  IF target_id = auth.uid() THEN
    RAISE EXCEPTION 'the laboratory owner is already a manager';
  END IF;

  INSERT INTO public.laboratory_members (
    laboratory_id, profile_id, staff_role, active, added_by
  )
  VALUES (
    p_laboratory_id, target_id, p_staff_role, true, auth.uid()
  )
  ON CONFLICT (laboratory_id, profile_id)
  DO UPDATE SET
    staff_role = EXCLUDED.staff_role,
    active = true,
    updated_at = now()
  RETURNING * INTO member_row;

  INSERT INTO public.audit_logs (
    actor_id, action, table_name, record_id, new_data
  )
  VALUES (
    auth.uid(), 'laboratory_member.added', 'laboratory_members',
    member_row.id::text,
    jsonb_build_object(
      'laboratory_id', p_laboratory_id,
      'profile_id', target_id,
      'staff_role', p_staff_role
    )
  );

  INSERT INTO public.notifications (user_id, type, title, body, data, priority)
  VALUES (
    target_id,
    'laboratory.staff_added',
    'You were added to a laboratory workspace',
    'You can now access this verified laboratory''s operational workspace.',
    jsonb_build_object('laboratory_id', p_laboratory_id, 'staff_role', p_staff_role),
    'normal'
  );

  RETURN member_row;
END;
$$;

REVOKE ALL ON FUNCTION public.add_laboratory_member_by_dhi(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.add_laboratory_member_by_dhi(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_laboratory_member(
  p_member_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE member_row public.laboratory_members; caller_role text;
BEGIN
  SELECT * INTO member_row
  FROM public.laboratory_members
  WHERE id = p_member_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'laboratory member not found'; END IF;

  caller_role := public.laboratory_staff_role(member_row.laboratory_id, auth.uid());
  IF caller_role IS NULL OR caller_role <> 'manager' THEN
    RAISE EXCEPTION 'laboratory manager access required';
  END IF;

  UPDATE public.laboratory_members
  SET active = false, updated_at = now()
  WHERE id = p_member_id;

  INSERT INTO public.audit_logs (
    actor_id, action, table_name, record_id, new_data
  )
  VALUES (
    auth.uid(), 'laboratory_member.removed', 'laboratory_members',
    member_row.id::text,
    jsonb_build_object('laboratory_id', member_row.laboratory_id, 'profile_id', member_row.profile_id)
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_laboratory_member(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.remove_laboratory_member(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.get_laboratory_worklist(uuid);

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
  report_code text,
  report_file_id uuid,
  report_authored_by uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE caller_role text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  caller_role := public.laboratory_staff_role(p_lab_id, auth.uid());
  IF caller_role IS NULL THEN RAISE EXCEPTION 'laboratory workspace access required'; END IF;

  RETURN QUERY
  WITH latest_reports AS (
    SELECT DISTINCT ON (r.order_id, r.test_id)
      r.id, r.order_id, r.test_id, r.status, r.report_code,
      r.file_id, r.authored_by, r.created_at
    FROM public.lab_reports r
    ORDER BY r.order_id, r.test_id, r.created_at DESC
  )
  SELECT
    o.id, o.appointment_id, o.patient_id, p.full_name,
    o.doctor_id, dp.full_name, h.name,
    o.priority, o.status, o.booked_at, o.accepted_at,
    i.test_id, t.code, t.name, i.sample_status, i.collected_at,
    lr.id, lr.status, lr.report_code, lr.file_id, lr.authored_by
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
  staff_role text;
BEGIN
  SELECT o INTO order_row FROM public.lab_orders o WHERE o.id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'laboratory order not found'; END IF;

  SELECT l.owner_id, l.verification INTO lab_owner, lab_verification
  FROM public.laboratories l WHERE l.id = order_row.lab_id;

  staff_role := public.laboratory_staff_role(order_row.lab_id, auth.uid());
  IF staff_role IS NULL AND NOT public.is_admin() THEN RAISE EXCEPTION 'laboratory access required'; END IF;
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
  FROM public.lab_orders o
  JOIN public.doctors d ON d.id = o.doctor_id
  WHERE o.id = order_row.id;

  INSERT INTO public.audit_logs (actor_id, action, table_name, record_id, new_data)
  VALUES (
    auth.uid(), 'lab_order.accepted', 'lab_orders', order_row.id::text,
    jsonb_build_object('lab_id', order_row.lab_id, 'appointment_id', order_row.appointment_id)
  );

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
  next_status sample_status;
  lab_verification verification_status;
BEGIN
  SELECT i INTO item_row FROM public.lab_order_items i WHERE i.id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'laboratory sample item not found'; END IF;
  SELECT o INTO order_row FROM public.lab_orders o WHERE o.id = item_row.order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'laboratory order not found'; END IF;
  SELECT l.verification INTO lab_verification FROM public.laboratories l WHERE l.id = order_row.lab_id;

  IF public.laboratory_staff_role(order_row.lab_id, auth.uid()) IS NULL AND NOT public.is_admin()
  THEN RAISE EXCEPTION 'laboratory access required'; END IF;
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
  VALUES (
    auth.uid(), 'lab_sample.advanced', 'lab_order_items', item_row.id::text,
    jsonb_build_object('order_id', item_row.order_id, 'sample_status', item_row.sample_status)
  );

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
  staff_role text;
  lab_verification verification_status;
  report_row public.lab_reports;
  report_code_value text;
  file_row public.files;
BEGIN
  SELECT o INTO order_row FROM public.lab_orders o WHERE o.id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'laboratory order not found'; END IF;

  staff_role := public.laboratory_staff_role(order_row.lab_id, auth.uid());
  SELECT l.verification INTO lab_verification FROM public.laboratories l WHERE l.id = order_row.lab_id;
  IF staff_role IS NULL AND NOT public.is_admin() THEN RAISE EXCEPTION 'laboratory access required'; END IF;
  IF lab_verification <> 'verified' AND NOT public.is_admin() THEN RAISE EXCEPTION 'verified laboratory required'; END IF;

  SELECT * INTO item_row FROM public.lab_order_items
  WHERE order_id = p_order_id AND test_id = p_test_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'test is not part of this laboratory order'; END IF;
  IF item_row.sample_status <> 'analyzed' THEN RAISE EXCEPTION 'sample must be analyzed before a report can be created'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.lab_reports r
    WHERE r.order_id = p_order_id AND r.test_id = p_test_id
      AND r.status IN ('completed', 'verified', 'delivered')
  ) THEN
    RAISE EXCEPTION 'a report already exists for this laboratory test';
  END IF;

  IF p_result_json IS NULL OR jsonb_typeof(p_result_json) <> 'object'
  THEN RAISE EXCEPTION 'report result must be a JSON object'; END IF;

  IF p_file_id IS NOT NULL THEN
    SELECT * INTO file_row FROM public.files f WHERE f.id = p_file_id;
    IF NOT FOUND OR file_row.owner_id <> auth.uid()
       OR file_row.bucket <> 'reports' OR file_row.purpose <> 'lab_report'
    THEN
      RAISE EXCEPTION 'report file is not a valid laboratory document';
    END IF;
  END IF;

  LOOP
    report_code_value := 'LAB-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.lab_reports WHERE report_code = report_code_value);
  END LOOP;

  INSERT INTO public.lab_reports (
    order_id, test_id, file_id, result_json, status, report_code, authored_by
  )
  VALUES (
    p_order_id, p_test_id, p_file_id, p_result_json, 'completed', report_code_value, auth.uid()
  )
  RETURNING * INTO report_row;

  IF NOT EXISTS (
    SELECT 1 FROM public.lab_order_items i
    WHERE i.order_id = p_order_id
      AND NOT EXISTS (
        SELECT 1 FROM public.lab_reports r
        WHERE r.order_id = p_order_id AND r.test_id = i.test_id
          AND r.status IN ('completed', 'verified', 'delivered')
      )
  ) THEN
    UPDATE public.lab_orders
    SET status = 'completed', completed_at = now()
    WHERE id = p_order_id;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, table_name, record_id, new_data)
  VALUES (
    auth.uid(), 'lab_report.created', 'lab_reports', report_row.id::text,
    jsonb_build_object(
      'order_id', p_order_id, 'test_id', p_test_id,
      'report_code', report_row.report_code, 'authored_by', auth.uid(),
      'has_file', p_file_id IS NOT NULL
    )
  );

  RETURN report_row;
END;
$$;

REVOKE ALL ON FUNCTION public.create_lab_report(uuid, uuid, jsonb, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_lab_report(uuid, uuid, jsonb, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.attach_lab_report_document(p_report_id uuid, p_file_id uuid)
RETURNS public.lab_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report_row public.lab_reports;
  order_row public.lab_orders;
  file_row public.files;
BEGIN
  SELECT r INTO report_row FROM public.lab_reports r WHERE r.id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'laboratory report not found'; END IF;
  IF report_row.status <> 'completed' THEN RAISE EXCEPTION 'only completed reports can receive a document'; END IF;
  IF report_row.file_id IS NOT NULL THEN RAISE EXCEPTION 'laboratory report already has a document'; END IF;

  SELECT o INTO order_row FROM public.lab_orders o WHERE o.id = report_row.order_id;
  SELECT l.verification INTO lab_verification FROM public.laboratories l WHERE l.id = order_row.lab_id;
  IF public.laboratory_staff_role(order_row.lab_id, auth.uid()) IS NULL AND NOT public.is_admin()
  THEN RAISE EXCEPTION 'laboratory access required'; END IF;
  IF lab_verification <> 'verified' AND NOT public.is_admin() THEN RAISE EXCEPTION 'verified laboratory required'; END IF;

  SELECT * INTO file_row FROM public.files f WHERE f.id = p_file_id;
  IF NOT FOUND OR file_row.owner_id <> auth.uid()
     OR file_row.bucket <> 'reports' OR file_row.purpose <> 'lab_report'
  THEN
    RAISE EXCEPTION 'report file is not a valid laboratory document';
  END IF;

  UPDATE public.lab_reports SET file_id = p_file_id
  WHERE id = p_report_id RETURNING * INTO report_row;

  RETURN report_row;
END;
$$;

REVOKE ALL ON FUNCTION public.attach_lab_report_document(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.attach_lab_report_document(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_lab_report(p_report_id uuid)
RETURNS public.lab_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report_row public.lab_reports;
  order_row public.lab_orders;
  verifier_role text;
BEGIN
  SELECT r INTO report_row FROM public.lab_reports r WHERE r.id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'laboratory report not found'; END IF;

  SELECT o INTO order_row FROM public.lab_orders o WHERE o.id = report_row.order_id FOR UPDATE;
  verifier_role := public.laboratory_staff_role(order_row.lab_id, auth.uid());
  SELECT l.verification INTO lab_verification FROM public.laboratories l WHERE l.id = order_row.lab_id;

  IF NOT public.is_admin() AND verifier_role NOT IN ('reviewer','manager')
  THEN RAISE EXCEPTION 'laboratory reviewer access required'; END IF;
  IF lab_verification <> 'verified' AND NOT public.is_admin() THEN RAISE EXCEPTION 'verified laboratory required'; END IF;
  IF report_row.status <> 'completed' THEN RAISE EXCEPTION 'only completed reports can be verified'; END IF;
  IF report_row.authored_by IS NOT NULL AND report_row.authored_by = auth.uid()
  THEN RAISE EXCEPTION 'independent verification requires a different reviewer'; END IF;

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
  VALUES (
    auth.uid(), 'lab_report.verified', 'lab_reports', report_row.id::text,
    jsonb_build_object(
      'order_id', report_row.order_id,
      'test_id', report_row.test_id,
      'authored_by', report_row.authored_by,
      'verified_by', auth.uid()
    )
  );

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
  publisher_role text;
BEGIN
  SELECT r INTO report_row FROM public.lab_reports r WHERE r.id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'laboratory report not found'; END IF;
  SELECT o INTO order_row FROM public.lab_orders o WHERE o.id = report_row.order_id FOR UPDATE;

  publisher_role := public.laboratory_staff_role(order_row.lab_id, auth.uid());
  SELECT l.verification INTO lab_verification FROM public.laboratories l WHERE l.id = order_row.lab_id;
  IF NOT public.is_admin() AND publisher_role NOT IN ('reviewer','manager')
  THEN RAISE EXCEPTION 'laboratory reviewer access required'; END IF;
  IF lab_verification <> 'verified' AND NOT public.is_admin() THEN RAISE EXCEPTION 'verified laboratory required'; END IF;
  IF report_row.status <> 'verified' THEN RAISE EXCEPTION 'only verified reports can be delivered'; END IF;
  IF report_row.authored_by IS NOT NULL AND report_row.authored_by = auth.uid()
  THEN RAISE EXCEPTION 'report author cannot publish their own report'; END IF;

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
  VALUES (
    auth.uid(), 'lab_report.delivered', 'lab_reports', report_row.id::text,
    jsonb_build_object(
      'order_id', report_row.order_id,
      'test_id', report_row.test_id,
      'verified_by', report_row.verified_by,
      'delivered_by', auth.uid()
    )
  );

  INSERT INTO public.notifications (user_id, type, title, body, data, priority)
  SELECT o.patient_id, 'lab_report.delivered', 'Laboratory report available',
         'Your verified laboratory report is now available in Medical Records.',
         jsonb_build_object('lab_report_id', report_row.id, 'lab_order_id', o.id), 'high'
  FROM public.lab_orders o WHERE o.id = report_row.order_id;

  INSERT INTO public.notifications (user_id, type, title, body, data, priority)
  SELECT d.profile_id, 'lab_report.delivered', 'Laboratory report delivered',
         'A verified laboratory report is now available for the patient.',
         jsonb_build_object('lab_report_id', report_row.id, 'lab_order_id', o.id), 'normal'
  FROM public.lab_orders o
  JOIN public.doctors d ON d.id = o.doctor_id
  WHERE o.id = report_row.order_id;

  RETURN report_row;
END;
$$;

REVOKE ALL ON FUNCTION public.deliver_lab_report(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.deliver_lab_report(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.authorize_lab_report_document(p_report_id uuid)
RETURNS TABLE (
  report_id uuid,
  report_code text,
  test_name text,
  patient_id uuid,
  doctor_id uuid,
  lab_id uuid,
  bucket text,
  path text,
  mime text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report_row public.lab_reports;
  order_row public.lab_orders;
  test_name_value text;
  lab_owner uuid;
  lab_verification verification_status;
  file_row public.files;
  lab_staff_role text;
  allowed boolean := false;
BEGIN
  SELECT r INTO report_row FROM public.lab_reports r WHERE r.id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'laboratory report not found'; END IF;
  IF report_row.file_id IS NULL THEN RAISE EXCEPTION 'this laboratory report has no document'; END IF;

  SELECT o INTO order_row FROM public.lab_orders o WHERE o.id = report_row.order_id;
  SELECT l.owner_id, l.verification INTO lab_owner, lab_verification
  FROM public.laboratories l WHERE l.id = order_row.lab_id;
  lab_staff_role := public.laboratory_staff_role(order_row.lab_id, auth.uid());

  SELECT t.name INTO test_name_value FROM public.lab_tests t WHERE t.id = report_row.test_id;
  SELECT f INTO file_row FROM public.files f WHERE f.id = report_row.file_id;

  IF NOT FOUND OR file_row.bucket <> 'reports' OR file_row.purpose <> 'lab_report'
  THEN RAISE EXCEPTION 'laboratory document metadata is invalid'; END IF;

  allowed :=
       public.is_admin()
    OR (order_row.patient_id = auth.uid() AND report_row.status = 'delivered')
    OR (
      order_row.doctor_id = (SELECT d.id FROM public.doctors d WHERE d.profile_id = auth.uid())
      AND report_row.status IN ('verified', 'delivered')
      AND public.doctor_verification_eligible(order_row.doctor_id)
    )
    OR (lab_staff_role IS NOT NULL AND lab_verification = 'verified');

  IF NOT allowed THEN RAISE EXCEPTION 'not authorized to open this laboratory document'; END IF;

  INSERT INTO public.clinical_document_access (report_id, file_id, actor_id, actor_role, access_type)
  VALUES (report_row.id, report_row.file_id, auth.uid(), COALESCE(public.current_role()::text, 'unknown'), 'view');

  INSERT INTO public.audit_logs (actor_id, action, table_name, record_id, new_data)
  VALUES (
    auth.uid(), 'clinical_document.viewed', 'lab_reports', report_row.id::text,
    jsonb_build_object('file_id', report_row.file_id, 'report_code', report_row.report_code)
  );

  RETURN QUERY
  SELECT report_row.id, report_row.report_code, test_name_value,
         order_row.patient_id, order_row.doctor_id, order_row.lab_id,
         file_row.bucket, file_row.path, file_row.mime;
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_lab_report_document(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.authorize_lab_report_document(uuid) TO authenticated;

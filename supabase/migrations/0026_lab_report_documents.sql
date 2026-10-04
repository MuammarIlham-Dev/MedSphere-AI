-- 0026: secure laboratory report documents and clinical document access history.

CREATE TABLE public.clinical_document_access (
  id bigint generated always as identity primary key,
  report_id uuid NOT NULL REFERENCES public.lab_reports(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES public.files(id),
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  actor_role text NOT NULL,
  access_type text NOT NULL DEFAULT 'view' CHECK (access_type IN ('view')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX clinical_document_access_report_idx
  ON public.clinical_document_access(report_id, created_at DESC);
CREATE INDEX clinical_document_access_actor_idx
  ON public.clinical_document_access(actor_id, created_at DESC);

ALTER TABLE public.clinical_document_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinical_document_access_admin_read
  ON public.clinical_document_access
  FOR SELECT USING (public.is_admin());

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
  file_row public.files;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT o INTO order_row FROM public.lab_orders o WHERE o.id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'laboratory order not found'; END IF;

  SELECT l.owner_id, l.verification INTO lab_owner, lab_verification
  FROM public.laboratories l WHERE l.id = order_row.lab_id;

  IF NOT public.is_admin() AND lab_owner <> auth.uid() THEN RAISE EXCEPTION 'laboratory access required'; END IF;
  IF lab_verification <> 'verified' AND NOT public.is_admin() THEN RAISE EXCEPTION 'verified laboratory required'; END IF;

  SELECT * INTO item_row
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

  INSERT INTO public.lab_reports (order_id, test_id, file_id, result_json, status, report_code)
  VALUES (p_order_id, p_test_id, p_file_id, p_result_json, 'completed', report_code_value)
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
    UPDATE public.lab_orders SET status = 'completed', completed_at = now() WHERE id = p_order_id;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, table_name, record_id, new_data)
  VALUES (
    auth.uid(), 'lab_report.created', 'lab_reports', report_row.id::text,
    jsonb_build_object(
      'order_id', p_order_id, 'test_id', p_test_id,
      'report_code', report_row.report_code, 'has_file', p_file_id IS NOT NULL
    )
  );

  RETURN report_row;
END;
$$;

REVOKE ALL ON FUNCTION public.create_lab_report(uuid, uuid, jsonb, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_lab_report(uuid, uuid, jsonb, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.attach_lab_report_document(
  p_report_id uuid,
  p_file_id uuid
)
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
  file_row public.files;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT r INTO report_row FROM public.lab_reports r WHERE r.id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'laboratory report not found'; END IF;
  IF report_row.status <> 'completed' THEN RAISE EXCEPTION 'only completed reports can receive a document'; END IF;
  IF report_row.file_id IS NOT NULL THEN RAISE EXCEPTION 'laboratory report already has a document'; END IF;

  SELECT o INTO order_row FROM public.lab_orders o WHERE o.id = report_row.order_id;
  SELECT l.owner_id, l.verification INTO lab_owner, lab_verification
  FROM public.laboratories l WHERE l.id = order_row.lab_id;

  IF NOT public.is_admin() AND lab_owner <> auth.uid() THEN RAISE EXCEPTION 'laboratory access required'; END IF;
  IF lab_verification <> 'verified' AND NOT public.is_admin() THEN RAISE EXCEPTION 'verified laboratory required'; END IF;

  SELECT * INTO file_row FROM public.files f WHERE f.id = p_file_id;
  IF NOT FOUND OR file_row.owner_id <> auth.uid()
     OR file_row.bucket <> 'reports' OR file_row.purpose <> 'lab_report'
  THEN
    RAISE EXCEPTION 'report file is not a valid laboratory document';
  END IF;

  UPDATE public.lab_reports SET file_id = p_file_id
  WHERE id = p_report_id
  RETURNING * INTO report_row;

  INSERT INTO public.audit_logs (actor_id, action, table_name, record_id, new_data)
  VALUES (
    auth.uid(), 'lab_report.document_attached', 'lab_reports', report_row.id::text,
    jsonb_build_object('file_id', p_file_id, 'report_code', report_row.report_code)
  );

  RETURN report_row;
END;
$$;

REVOKE ALL ON FUNCTION public.attach_lab_report_document(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.attach_lab_report_document(uuid, uuid) TO authenticated;

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
  allowed boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT r INTO report_row FROM public.lab_reports r WHERE r.id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'laboratory report not found'; END IF;
  IF report_row.file_id IS NULL THEN RAISE EXCEPTION 'this laboratory report has no document'; END IF;

  SELECT o INTO order_row FROM public.lab_orders o WHERE o.id = report_row.order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'laboratory order not found'; END IF;

  SELECT l.owner_id, l.verification INTO lab_owner, lab_verification
  FROM public.laboratories l WHERE l.id = order_row.lab_id;
  SELECT t.name INTO test_name_value FROM public.lab_tests t WHERE t.id = report_row.test_id;
  SELECT f INTO file_row FROM public.files f WHERE f.id = report_row.file_id;

  IF NOT FOUND OR file_row.bucket <> 'reports' OR file_row.purpose <> 'lab_report'
  THEN
    RAISE EXCEPTION 'laboratory document metadata is invalid';
  END IF;

  allowed :=
       public.is_admin()
    OR (order_row.patient_id = auth.uid() AND report_row.status = 'delivered')
    OR (
      order_row.doctor_id = (SELECT d.id FROM public.doctors d WHERE d.profile_id = auth.uid())
      AND report_row.status IN ('verified', 'delivered')
      AND public.doctor_verification_eligible(order_row.doctor_id)
    )
    OR (lab_owner = auth.uid() AND lab_verification = 'verified');

  IF NOT allowed THEN RAISE EXCEPTION 'not authorized to open this laboratory document'; END IF;

  INSERT INTO public.clinical_document_access (report_id, file_id, actor_id, actor_role, access_type)
  VALUES (report_row.id, report_row.file_id, auth.uid(),
          COALESCE(public.current_role()::text, 'unknown'), 'view');

  INSERT INTO public.audit_logs (actor_id, action, table_name, record_id, new_data)
  VALUES (
    auth.uid(), 'clinical_document.viewed', 'lab_reports', report_row.id::text,
    jsonb_build_object(
      'file_id', report_row.file_id,
      'report_code', report_row.report_code,
      'actor_role', COALESCE(public.current_role()::text, 'unknown')
    )
  );

  RETURN QUERY
  SELECT report_row.id, report_row.report_code, test_name_value,
         order_row.patient_id, order_row.doctor_id, order_row.lab_id,
         file_row.bucket, file_row.path, file_row.mime;
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_lab_report_document(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.authorize_lab_report_document(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_lab_report_access_history(p_report_id uuid)
RETURNS TABLE (
  accessed_at timestamptz,
  accessor_name text,
  accessor_role text,
  access_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report_patient uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT o.patient_id INTO report_patient
  FROM public.lab_reports r
  JOIN public.lab_orders o ON o.id = r.order_id
  WHERE r.id = p_report_id;

  IF report_patient IS NULL THEN RAISE EXCEPTION 'laboratory report not found'; END IF;
  IF auth.uid() <> report_patient AND NOT public.is_admin()
  THEN
    RAISE EXCEPTION 'only the patient or an administrator can view document access history';
  END IF;

  RETURN QUERY
  SELECT a.created_at, p.full_name, a.actor_role, a.access_type
  FROM public.clinical_document_access a
  JOIN public.profiles p ON p.id = a.actor_id
  WHERE a.report_id = p_report_id
  ORDER BY a.created_at DESC
  LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.get_lab_report_access_history(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_lab_report_access_history(uuid) TO authenticated;

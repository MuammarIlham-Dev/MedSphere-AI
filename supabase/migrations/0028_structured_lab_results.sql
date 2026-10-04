-- 0028: structured laboratory results, immutable versions, and amendments.

ALTER TABLE public.lab_reports
  ADD COLUMN IF NOT EXISTS version_no integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS supersedes_report_id uuid REFERENCES public.lab_reports(id),
  ADD COLUMN IF NOT EXISTS superseded_by_report_id uuid REFERENCES public.lab_reports(id),
  ADD COLUMN IF NOT EXISTS amendment_reason text;

UPDATE public.lab_reports
SET version_no = COALESCE(version_no, 1),
    is_current = COALESCE(is_current, true);

CREATE INDEX IF NOT EXISTS lab_reports_current_idx
  ON public.lab_reports(order_id, test_id, is_current, created_at DESC);

CREATE INDEX IF NOT EXISTS lab_reports_supersedes_idx
  ON public.lab_reports(supersedes_report_id);

CREATE UNIQUE INDEX IF NOT EXISTS lab_reports_current_unique_idx
  ON public.lab_reports(order_id, test_id)
  WHERE is_current;

CREATE UNIQUE INDEX IF NOT EXISTS lab_reports_version_unique_idx
  ON public.lab_reports(order_id, test_id, version_no);

CREATE OR REPLACE FUNCTION public.lab_result_is_valid(p_result_json jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  range_json jsonb;
  analyte jsonb;
  flag text;
  result_type text;
BEGIN
  IF p_result_json IS NULL OR jsonb_typeof(p_result_json) <> 'object' THEN
    RETURN false;
  END IF;

  IF jsonb_typeof(p_result_json->'schema_version') <> 'number'
     OR (p_result_json->>'schema_version')::numeric <> 1 THEN
    RETURN false;
  END IF;

  result_type := p_result_json->>'result_type';
  IF result_type NOT IN ('numeric','qualitative','text','panel') THEN
    RETURN false;
  END IF;

  IF NOT (p_result_json ? 'value')
     OR jsonb_typeof(p_result_json->'value') = 'null' THEN
    IF result_type <> 'panel' THEN RETURN false; END IF;
  ELSIF result_type = 'numeric' AND jsonb_typeof(p_result_json->'value') <> 'number' THEN
    RETURN false;
  ELSIF result_type IN ('qualitative','text') AND jsonb_typeof(p_result_json->'value') <> 'string' THEN
    RETURN false;
  END IF;

  IF p_result_json ? 'unit'
     AND jsonb_typeof(p_result_json->'unit') NOT IN ('string','null') THEN
    RETURN false;
  END IF;

  IF NOT (p_result_json ? 'reference_range')
     OR jsonb_typeof(p_result_json->'reference_range') <> 'object' THEN
    RETURN false;
  END IF;

  range_json := p_result_json->'reference_range';

  IF range_json ? 'low'
     AND jsonb_typeof(range_json->'low') NOT IN ('number','null') THEN
    RETURN false;
  END IF;
  IF range_json ? 'high'
     AND jsonb_typeof(range_json->'high') NOT IN ('number','null') THEN
    RETURN false;
  END IF;
  IF range_json ? 'text'
     AND jsonb_typeof(range_json->'text') NOT IN ('string','null') THEN
    RETURN false;
  END IF;

  IF range_json->'low' IS NOT NULL
     AND range_json->'high' IS NOT NULL
     AND jsonb_typeof(range_json->'low') = 'number'
     AND jsonb_typeof(range_json->'high') = 'number'
     AND (range_json->>'low')::numeric > (range_json->>'high')::numeric THEN
    RETURN false;
  END IF;

  IF p_result_json ? 'abnormal_flag'
     AND jsonb_typeof(p_result_json->'abnormal_flag') NOT IN ('string','null') THEN
    RETURN false;
  END IF;

  flag := p_result_json->>'abnormal_flag';
  IF flag IS NOT NULL AND flag NOT IN (
    'normal','low','high','critical_low','critical_high',
    'positive','negative','abnormal','indeterminate'
  ) THEN
    RETURN false;
  END IF;

  IF p_result_json ? 'specimen'
     AND jsonb_typeof(p_result_json->'specimen') NOT IN ('string','null') THEN
    RETURN false;
  END IF;

  IF p_result_json ? 'method'
     AND jsonb_typeof(p_result_json->'method') NOT IN ('string','null') THEN
    RETURN false;
  END IF;

  IF p_result_json ? 'comment'
     AND jsonb_typeof(p_result_json->'comment') NOT IN ('string','null') THEN
    RETURN false;
  END IF;

  IF result_type = 'panel' THEN
    IF jsonb_typeof(p_result_json->'analytes') <> 'array'
       OR jsonb_array_length(p_result_json->'analytes') < 1 THEN
      RETURN false;
    END IF;

    FOR analyte IN SELECT value FROM jsonb_array_elements(p_result_json->'analytes')
    LOOP
      IF jsonb_typeof(analyte) <> 'object'
         OR jsonb_typeof(analyte->'name') <> 'string'
         OR NOT (analyte ? 'value') THEN
        RETURN false;
      END IF;
      IF analyte ? 'unit'
         AND jsonb_typeof(analyte->'unit') NOT IN ('string','null') THEN
        RETURN false;
      END IF;
      IF analyte ? 'reference_range'
         AND jsonb_typeof(analyte->'reference_range') <> 'object' THEN
        RETURN false;
      END IF;
      IF analyte ? 'abnormal_flag'
         AND jsonb_typeof(analyte->'abnormal_flag') NOT IN ('string','null') THEN
        RETURN false;
      END IF;
    END LOOP;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.lab_result_is_valid(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.lab_result_is_valid(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_lab_report_payload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.order_id IS DISTINCT FROM OLD.order_id
       OR NEW.test_id IS DISTINCT FROM OLD.test_id
       OR NEW.result_json IS DISTINCT FROM OLD.result_json
       OR NEW.report_code IS DISTINCT FROM OLD.report_code
       OR NEW.version_no IS DISTINCT FROM OLD.version_no
       OR NEW.supersedes_report_id IS DISTINCT FROM OLD.supersedes_report_id
       OR NEW.amendment_reason IS DISTINCT FROM OLD.amendment_reason
       OR NEW.authored_by IS DISTINCT FROM OLD.authored_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'laboratory report clinical payload is immutable; create an amendment instead';
    END IF;

    IF OLD.file_id IS NOT NULL AND NEW.file_id IS DISTINCT FROM OLD.file_id THEN
      RAISE EXCEPTION 'laboratory report document cannot be replaced in place; create an amendment instead';
    END IF;

    IF OLD.superseded_by_report_id IS NOT NULL
       AND NEW.superseded_by_report_id IS DISTINCT FROM OLD.superseded_by_report_id THEN
      RAISE EXCEPTION 'laboratory report supersession history is immutable';
    END IF;

    IF OLD.is_current = false
       AND NEW.is_current = true
       AND NOT (
         OLD.status = 'verified'
         AND NEW.status = 'delivered'
         AND NEW.supersedes_report_id IS NOT NULL
       ) THEN
      RAISE EXCEPTION 'a superseded laboratory report cannot become current again';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_lab_report_payload_trigger ON public.lab_reports;

CREATE TRIGGER protect_lab_report_payload_trigger
BEFORE UPDATE ON public.lab_reports
FOR EACH ROW
EXECUTE FUNCTION public.protect_lab_report_payload();

DROP POLICY IF EXISTS lab_reports_read ON public.lab_reports;

CREATE POLICY lab_reports_read ON public.lab_reports
FOR SELECT USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.lab_orders o
    WHERE o.id = order_id
      AND (
        o.lab_id IN (
          SELECT l.id FROM public.laboratories l
          WHERE l.owner_id = auth.uid()
        )
        OR (
          o.doctor_id = (
            SELECT d.id FROM public.doctors d WHERE d.profile_id = auth.uid()
          )
          AND is_current
          AND status IN ('verified','delivered')
        )
        OR (
          o.patient_id = auth.uid()
          AND is_current
          AND status = 'delivered'
        )
      )
  )
);

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
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT o INTO order_row
  FROM public.lab_orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'laboratory order not found'; END IF;

  staff_role := public.laboratory_staff_role(order_row.lab_id, auth.uid());
  SELECT l.verification INTO lab_verification
  FROM public.laboratories l
  WHERE l.id = order_row.lab_id;

  IF staff_role IS NULL AND NOT public.is_admin()
  THEN RAISE EXCEPTION 'laboratory access required'; END IF;
  IF lab_verification <> 'verified' AND NOT public.is_admin()
  THEN RAISE EXCEPTION 'verified laboratory required'; END IF;

  IF NOT public.lab_result_is_valid(p_result_json)
  THEN RAISE EXCEPTION 'invalid structured laboratory result'; END IF;

  SELECT * INTO item_row
  FROM public.lab_order_items
  WHERE order_id = p_order_id AND test_id = p_test_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'test is not part of this laboratory order'; END IF;
  IF item_row.sample_status <> 'analyzed'
  THEN RAISE EXCEPTION 'sample must be analyzed before a report can be created'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.lab_reports r
    WHERE r.order_id = p_order_id
      AND r.test_id = p_test_id
      AND r.status IN ('completed','verified','delivered')
  ) THEN
    RAISE EXCEPTION 'a report already exists for this laboratory test'; END IF;

  IF p_file_id IS NOT NULL THEN
    SELECT * INTO file_row FROM public.files f WHERE f.id = p_file_id;
    IF NOT FOUND OR file_row.owner_id <> auth.uid()
       OR file_row.bucket <> 'reports'
       OR file_row.purpose <> 'lab_report' THEN
      RAISE EXCEPTION 'report file is not a valid laboratory document';
    END IF;
  END IF;

  LOOP
    report_code_value := 'LAB-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.lab_reports WHERE report_code = report_code_value
    );
  END LOOP;

  INSERT INTO public.lab_reports (
    order_id, test_id, file_id, result_json, status,
    report_code, authored_by, version_no, is_current
  )
  VALUES (
    p_order_id, p_test_id, p_file_id, p_result_json, 'completed',
    report_code_value, auth.uid(), 1, true
  )
  RETURNING * INTO report_row;

  IF NOT EXISTS (
    SELECT 1
    FROM public.lab_order_items i
    WHERE i.order_id = p_order_id
      AND NOT EXISTS (
        SELECT 1 FROM public.lab_reports r
        WHERE r.order_id = p_order_id
          AND r.test_id = i.test_id
          AND r.status IN ('completed','verified','delivered')
          AND r.is_current
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
      'order_id', p_order_id,
      'test_id', p_test_id,
      'report_code', report_row.report_code,
      'version_no', report_row.version_no,
      'authored_by', auth.uid(),
      'has_file', p_file_id IS NOT NULL
    )
  );

  RETURN report_row;
END;
$$;

REVOKE ALL ON FUNCTION public.create_lab_report(uuid, uuid, jsonb, uuid)
FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_lab_report(uuid, uuid, jsonb, uuid)
TO authenticated;

CREATE OR REPLACE FUNCTION public.amend_lab_report(
  p_report_id uuid,
  p_result_json jsonb,
  p_file_id uuid DEFAULT NULL,
  p_amendment_reason text DEFAULT ''
)
RETURNS public.lab_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_row public.lab_reports;
  order_row public.lab_orders;
  staff_role text;
  lab_verification verification_status;
  file_row public.files;
  new_report public.lab_reports;
  report_code_value text;
  reason text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT r INTO source_row
  FROM public.lab_reports r
  WHERE r.id = p_report_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'laboratory report not found'; END IF;

  SELECT o INTO order_row
  FROM public.lab_orders o
  WHERE o.id = source_row.order_id
  FOR UPDATE;

  staff_role := public.laboratory_staff_role(order_row.lab_id, auth.uid());
  SELECT l.verification INTO lab_verification
  FROM public.laboratories l
  WHERE l.id = order_row.lab_id;

  IF NOT public.is_admin() AND staff_role NOT IN ('reviewer','manager')
  THEN RAISE EXCEPTION 'laboratory reviewer access required'; END IF;
  IF lab_verification <> 'verified' AND NOT public.is_admin()
  THEN RAISE EXCEPTION 'verified laboratory required'; END IF;
  IF NOT source_row.is_current
  THEN RAISE EXCEPTION 'only the current report can be amended'; END IF;
  IF source_row.status <> 'delivered'
  THEN RAISE EXCEPTION 'only delivered laboratory reports can be amended'; END IF;

  reason := trim(coalesce(p_amendment_reason, ''));
  IF char_length(reason) < 5 OR char_length(reason) > 2000
  THEN RAISE EXCEPTION 'amendment reason must be between 5 and 2000 characters'; END IF;

  IF NOT public.lab_result_is_valid(p_result_json)
  THEN RAISE EXCEPTION 'invalid structured laboratory result'; END IF;

  IF source_row.file_id IS NOT NULL AND p_file_id IS NULL
  THEN RAISE EXCEPTION 'an amended report must include a replacement document'; END IF;

  IF p_file_id IS NOT NULL THEN
    SELECT * INTO file_row FROM public.files f WHERE f.id = p_file_id;
    IF NOT FOUND OR file_row.owner_id <> auth.uid()
       OR file_row.bucket <> 'reports'
       OR file_row.purpose <> 'lab_report' THEN
      RAISE EXCEPTION 'amendment file is not a valid laboratory document';
    END IF;
  END IF;

  LOOP
    report_code_value := 'LAB-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.lab_reports WHERE report_code = report_code_value
    );
  END LOOP;

  INSERT INTO public.lab_reports (
    order_id, test_id, file_id, result_json, status, report_code,
    authored_by, version_no, is_current, supersedes_report_id, amendment_reason
  )
  VALUES (
    source_row.order_id, source_row.test_id, p_file_id, p_result_json, 'completed',
    report_code_value, auth.uid(), source_row.version_no + 1, false,
    source_row.id, reason
  )
  RETURNING * INTO new_report;

  UPDATE public.lab_reports
  SET superseded_by_report_id = new_report.id
  WHERE id = source_row.id;

  INSERT INTO public.audit_logs (actor_id, action, table_name, record_id, new_data)
  VALUES (
    auth.uid(), 'lab_report.amended', 'lab_reports', new_report.id::text,
    jsonb_build_object(
      'source_report_id', source_row.id,
      'version_no', new_report.version_no,
      'authored_by', auth.uid(),
      'amendment_reason', reason
    )
  );

  RETURN new_report;
END;
$$;

REVOKE ALL ON FUNCTION public.amend_lab_report(uuid, jsonb, uuid, text)
FROM public, anon;
GRANT EXECUTE ON FUNCTION public.amend_lab_report(uuid, jsonb, uuid, text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.get_laboratory_report_archive(
  p_lab_id uuid
)
RETURNS TABLE (
  report_id uuid,
  order_id uuid,
  patient_name text,
  test_name text,
  report_code text,
  status report_status,
  version_no integer,
  is_current boolean,
  result_json jsonb,
  file_id uuid,
  authored_by uuid,
  verified_by uuid,
  delivered_by uuid,
  amendment_reason text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  IF NOT public.is_admin()
     AND public.laboratory_staff_role(p_lab_id, auth.uid()) NOT IN ('reviewer','manager')
  THEN
    RAISE EXCEPTION 'laboratory reviewer access required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.laboratories l
    WHERE l.id = p_lab_id AND l.verification = 'verified'
  ) THEN
    RAISE EXCEPTION 'verified laboratory required';
  END IF;

  RETURN QUERY
  SELECT r.id, r.order_id, p.full_name, t.name, r.report_code, r.status,
         r.version_no, r.is_current, r.result_json, r.file_id,
         r.authored_by, r.verified_by, r.delivered_by,
         r.amendment_reason, r.created_at
  FROM public.lab_reports r
  JOIN public.lab_orders o ON o.id = r.order_id
  JOIN public.profiles p ON p.id = o.patient_id
  LEFT JOIN public.lab_tests t ON t.id = r.test_id
  WHERE o.lab_id = p_lab_id
    AND (r.is_current OR r.status = 'completed' OR r.status = 'verified')
  ORDER BY r.created_at DESC
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.get_laboratory_report_archive(uuid)
FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_laboratory_report_archive(uuid)
TO authenticated;

CREATE OR REPLACE FUNCTION public.get_lab_report_history(
  p_report_id uuid
)
RETURNS TABLE (
  report_id uuid,
  report_code text,
  version_no integer,
  status report_status,
  is_current boolean,
  result_json jsonb,
  file_id uuid,
  amendment_reason text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_order public.lab_orders;
  allowed boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT o.* INTO source_order
  FROM public.lab_reports r
  JOIN public.lab_orders o ON o.id = r.order_id
  WHERE r.id = p_report_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'laboratory report not found'; END IF;

  allowed :=
       public.is_admin()
    OR source_order.patient_id = auth.uid()
    OR source_order.doctor_id = (
         SELECT d.id FROM public.doctors d WHERE d.profile_id = auth.uid()
       )
    OR EXISTS (
         SELECT 1
         FROM public.laboratories l
         WHERE l.id = source_order.lab_id
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
       );

  IF NOT allowed THEN RAISE EXCEPTION 'not authorized to view laboratory report history'; END IF;

  RETURN QUERY
  WITH RECURSIVE lineage AS (
    SELECT r.*
    FROM public.lab_reports r
    WHERE r.id = p_report_id

    UNION ALL

    SELECT parent.*
    FROM public.lab_reports parent
    JOIN lineage child ON child.supersedes_report_id = parent.id
  ),
  descendants AS (
    SELECT r.*
    FROM public.lab_reports r
    WHERE r.id = p_report_id

    UNION ALL

    SELECT child.*
    FROM public.lab_reports child
    JOIN descendants parent ON child.supersedes_report_id = parent.id
  )
  SELECT
    x.id, x.report_code, x.version_no, x.status, x.is_current,
    x.result_json, x.file_id, x.amendment_reason, x.created_at
  FROM (
    SELECT * FROM lineage
    UNION
    SELECT * FROM descendants
  ) x
  ORDER BY x.version_no;

END;
$$;

REVOKE ALL ON FUNCTION public.get_lab_report_history(uuid)
FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_lab_report_history(uuid)
TO authenticated;

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
  lab_verification verification_status;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT r INTO report_row FROM public.lab_reports r WHERE r.id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'laboratory report not found'; END IF;

  SELECT o INTO order_row FROM public.lab_orders o WHERE o.id = report_row.order_id FOR UPDATE;
  verifier_role := public.laboratory_staff_role(order_row.lab_id, auth.uid());
  SELECT l.verification INTO lab_verification
  FROM public.laboratories l WHERE l.id = order_row.lab_id;

  IF NOT public.is_admin() AND verifier_role NOT IN ('reviewer','manager')
  THEN RAISE EXCEPTION 'laboratory reviewer access required'; END IF;
  IF lab_verification <> 'verified' AND NOT public.is_admin()
  THEN RAISE EXCEPTION 'verified laboratory required'; END IF;
  IF report_row.status <> 'completed'
  THEN RAISE EXCEPTION 'only completed reports can be verified'; END IF;
  IF report_row.authored_by IS NOT NULL AND report_row.authored_by = auth.uid()
  THEN RAISE EXCEPTION 'independent verification requires a different reviewer'; END IF;

  UPDATE public.lab_reports
  SET status = 'verified', verified_by = auth.uid(), verified_at = now()
  WHERE id = report_row.id
  RETURNING * INTO report_row;

  IF report_row.is_current AND NOT EXISTS (
    SELECT 1
    FROM public.lab_order_items i
    WHERE i.order_id = report_row.order_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.lab_reports r
        WHERE r.order_id = report_row.order_id
          AND r.test_id = i.test_id
          AND r.status IN ('verified','delivered')
          AND r.is_current
      )
  ) THEN
    UPDATE public.lab_orders SET status = 'verified'
    WHERE id = report_row.order_id
      AND status IN ('completed','in_progress');
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, table_name, record_id, new_data)
  VALUES (
    auth.uid(), 'lab_report.verified', 'lab_reports', report_row.id::text,
    jsonb_build_object(
      'order_id', report_row.order_id,
      'test_id', report_row.test_id,
      'version_no', report_row.version_no,
      'authored_by', report_row.authored_by,
      'verified_by', auth.uid()
    )
  );

  RETURN report_row;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_lab_report(uuid)
FROM public, anon;
GRANT EXECUTE ON FUNCTION public.verify_lab_report(uuid)
TO authenticated;

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
  lab_verification verification_status;
  previous_current_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT r INTO report_row
  FROM public.lab_reports r
  WHERE r.id = p_report_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'laboratory report not found'; END IF;

  SELECT o INTO order_row
  FROM public.lab_orders o
  WHERE o.id = report_row.order_id
  FOR UPDATE;

  publisher_role := public.laboratory_staff_role(order_row.lab_id, auth.uid());
  SELECT l.verification INTO lab_verification
  FROM public.laboratories l WHERE l.id = order_row.lab_id;

  IF NOT public.is_admin()
     AND publisher_role NOT IN ('reviewer','manager')
  THEN RAISE EXCEPTION 'laboratory reviewer access required'; END IF;
  IF lab_verification <> 'verified' AND NOT public.is_admin()
  THEN RAISE EXCEPTION 'verified laboratory required'; END IF;
  IF report_row.status <> 'verified'
  THEN RAISE EXCEPTION 'only verified reports can be delivered'; END IF;
  IF report_row.authored_by IS NOT NULL AND report_row.authored_by = auth.uid()
  THEN RAISE EXCEPTION 'report author cannot publish their own report'; END IF;

  previous_current_id := report_row.supersedes_report_id;

  IF previous_current_id IS NOT NULL THEN
    UPDATE public.lab_reports
    SET is_current = false
    WHERE id = previous_current_id
      AND is_current = true;
  END IF;

  UPDATE public.lab_reports
  SET status = 'delivered',
      delivered_by = auth.uid(),
      delivered_at = now(),
      is_current = true
  WHERE id = report_row.id
  RETURNING * INTO report_row;

  IF previous_current_id IS NOT NULL THEN
    UPDATE public.lab_reports
    SET is_current = false
    WHERE id = previous_current_id
      AND is_current = true;

    UPDATE public.lab_orders
    SET status = 'delivered'
    WHERE id = report_row.order_id;
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM public.lab_order_items i
      WHERE i.order_id = report_row.order_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.lab_reports r
          WHERE r.order_id = report_row.order_id
            AND r.test_id = i.test_id
            AND r.status = 'delivered'
            AND r.is_current
        )
    ) THEN
      UPDATE public.lab_orders
      SET status = 'delivered'
      WHERE id = report_row.order_id;
    END IF;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, table_name, record_id, new_data)
  VALUES (
    auth.uid(), 'lab_report.delivered', 'lab_reports', report_row.id::text,
    jsonb_build_object(
      'order_id', report_row.order_id,
      'test_id', report_row.test_id,
      'version_no', report_row.version_no,
      'verified_by', report_row.verified_by,
      'delivered_by', auth.uid(),
      'amends_report_id', report_row.supersedes_report_id
    )
  );

  INSERT INTO public.notifications (user_id, type, title, body, data, priority)
  SELECT o.patient_id,
         'lab_report.delivered',
         CASE WHEN report_row.version_no > 1
              THEN 'Corrected laboratory report available'
              ELSE 'Laboratory report available'
         END,
         CASE WHEN report_row.version_no > 1
              THEN 'A corrected, independently verified laboratory report is now available in Medical Records.'
              ELSE 'Your verified laboratory report is now available in Medical Records.'
         END,
         jsonb_build_object(
           'lab_report_id', report_row.id,
           'lab_order_id', o.id,
           'version_no', report_row.version_no,
           'is_amendment', report_row.version_no > 1
         ),
         'high'
  FROM public.lab_orders o
  WHERE o.id = report_row.order_id;

  INSERT INTO public.notifications (user_id, type, title, body, data, priority)
  SELECT d.profile_id,
         'lab_report.delivered',
         CASE WHEN report_row.version_no > 1
              THEN 'Corrected laboratory report delivered'
              ELSE 'Laboratory report delivered'
         END,
         CASE WHEN report_row.version_no > 1
              THEN 'A corrected, independently verified laboratory report is now available for this patient.'
              ELSE 'A verified laboratory report is now available for the patient.'
         END,
         jsonb_build_object(
           'lab_report_id', report_row.id,
           'lab_order_id', o.id,
           'version_no', report_row.version_no,
           'is_amendment', report_row.version_no > 1
         ),
         'normal'
  FROM public.lab_orders o
  JOIN public.doctors d ON d.id = o.doctor_id
  WHERE o.id = report_row.order_id;

  RETURN report_row;
END;
$$;

REVOKE ALL ON FUNCTION public.deliver_lab_report(uuid)
FROM public, anon;
GRANT EXECUTE ON FUNCTION public.deliver_lab_report(uuid)
TO authenticated;

 
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
  report_authored_by uuid,
  report_version_no integer,
  report_is_current boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  caller_role := public.laboratory_staff_role(p_lab_id, auth.uid());
  IF caller_role IS NULL THEN RAISE EXCEPTION 'laboratory workspace access required'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.laboratories l
    WHERE l.id = p_lab_id AND l.verification = 'verified'
  ) THEN
    RAISE EXCEPTION 'verified laboratory required';
  END IF;

  RETURN QUERY
  WITH latest_reports AS (
    SELECT DISTINCT ON (r.order_id, r.test_id)
      r.id, r.order_id, r.test_id, r.status, r.report_code,
      r.file_id, r.authored_by, r.version_no, r.is_current, r.created_at
    FROM public.lab_reports r
    WHERE r.is_current
    ORDER BY r.order_id, r.test_id, r.version_no DESC, r.created_at DESC
  )
  SELECT
    o.id, o.appointment_id, o.patient_id, p.full_name,
    o.doctor_id, dp.full_name, h.name,
    o.priority, o.status, o.booked_at, o.accepted_at,
    i.test_id, t.code, t.name, i.sample_status, i.collected_at,
    lr.id, lr.status, lr.report_code, lr.file_id, lr.authored_by,
    lr.version_no, lr.is_current
  FROM public.lab_orders o
  JOIN public.profiles p ON p.id = o.patient_id
  LEFT JOIN public.doctors d ON d.id = o.doctor_id
  LEFT JOIN public.profiles dp ON dp.id = d.profile_id
  LEFT JOIN public.appointments a ON a.id = o.appointment_id
  LEFT JOIN public.hospitals h ON h.id = a.hospital_id
  JOIN public.lab_order_items i ON i.order_id = o.id
  JOIN public.lab_tests t ON t.id = i.test_id
  LEFT JOIN latest_reports lr ON lr.order_id = o.id AND lr.test_id = i.test_id
  WHERE o.lab_id = p_lab_id
    AND o.status <> 'delivered'
  ORDER BY o.booked_at DESC, p.full_name, t.name
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.get_laboratory_worklist(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_laboratory_worklist(uuid) TO authenticated;

-- Migration 0006: Research Ethics & Differential Privacy

CREATE TYPE study_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.research_studies (
  id uuid primary key default gen_random_uuid(),
  researcher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  purpose text not null,
  status study_status not null default 'pending',
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX research_studies_researcher_idx ON public.research_studies(researcher_id);
CREATE INDEX research_studies_status_idx ON public.research_studies(status);

ALTER TABLE public.research_studies ENABLE ROW LEVEL SECURITY;

-- Researchers can view their own studies
CREATE POLICY "Researchers can view own studies"
ON public.research_studies FOR SELECT
USING (researcher_id = auth.uid());

-- Researchers can insert studies
CREATE POLICY "Researchers can insert studies"
ON public.research_studies FOR INSERT
WITH CHECK (researcher_id = auth.uid());

-- Admins and Ethics Committee (researchers with special flags, or super_admin) can view all
CREATE POLICY "Admins can view all studies"
ON public.research_studies FOR SELECT
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin'));

CREATE POLICY "Admins can update studies"
ON public.research_studies FOR UPDATE
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin'));


-- Function to get anonymized cohort stats (k-anonymity = 5)
-- We take a study_id (to ensure only approved researchers can query) and filters.
CREATE OR REPLACE FUNCTION get_anonymized_cohort_stats(
  p_study_id uuid,
  p_region text DEFAULT NULL,
  p_diagnosis text DEFAULT NULL
) 
RETURNS TABLE (
  region_id text,
  diagnosis text,
  patient_count bigint
) 
SECURITY DEFINER
AS $$
DECLARE
  v_study_status study_status;
BEGIN
  -- 1. Validate study is approved and caller owns it
  SELECT status INTO v_study_status 
  FROM public.research_studies 
  WHERE id = p_study_id AND researcher_id = auth.uid();

  IF v_study_status IS NULL OR v_study_status != 'approved' THEN
    RAISE EXCEPTION 'Access denied. Study is not approved or does not belong to you.';
  END IF;

  -- 2. Execute cohort aggregation
  RETURN QUERY
  SELECT 
    mr.region_id,
    COALESCE(mr.diagnosis, 'Unknown') as diagnosis,
    COUNT(DISTINCT mr.patient_id) as patient_count
  FROM public.medical_records mr
  WHERE (p_region IS NULL OR mr.region_id = p_region)
    AND (p_diagnosis IS NULL OR mr.diagnosis ILIKE '%' || p_diagnosis || '%')
  GROUP BY mr.region_id, mr.diagnosis
  -- 3. k-Anonymity threshold: Hide cohorts with fewer than 5 patients
  HAVING COUNT(DISTINCT mr.patient_id) >= 5;

END;
$$ LANGUAGE plpgsql;

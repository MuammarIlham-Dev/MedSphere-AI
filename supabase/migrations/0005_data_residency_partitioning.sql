-- Migration 0005: Regional Data Residency via Partitioning

-- 1. Add region_id to profiles to track data residency
ALTER TABLE public.profiles ADD COLUMN region_id text DEFAULT 'national';
CREATE INDEX profiles_region_idx ON public.profiles(region_id);

-- 2. Convert medical_records to a partitioned table by region_id
-- We rename the old table and recreate the partitioned one.
ALTER TABLE public.medical_records RENAME TO medical_records_old;

CREATE TABLE public.medical_records (
  id uuid default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id),
  doctor_id uuid references public.doctors(id),
  appointment_id uuid references public.appointments(id),
  type record_type not null,
  title text not null,
  diagnosis text, notes text,
  vitals jsonb not null default '{}',
  attachments uuid[] not null default '{}',
  region_id text not null default 'national',
  created_at timestamptz not null default now(),
  PRIMARY KEY (id, region_id)
) PARTITION BY LIST (region_id);

-- Create partitions for primary regions
CREATE TABLE public.medical_records_national PARTITION OF public.medical_records FOR VALUES IN ('national');
CREATE TABLE public.medical_records_dhaka PARTITION OF public.medical_records FOR VALUES IN ('dhaka');
CREATE TABLE public.medical_records_chittagong PARTITION OF public.medical_records FOR VALUES IN ('chittagong');
CREATE TABLE public.medical_records_sylhet PARTITION OF public.medical_records FOR VALUES IN ('sylhet');
CREATE TABLE public.medical_records_khulna PARTITION OF public.medical_records FOR VALUES IN ('khulna');
CREATE TABLE public.medical_records_default PARTITION OF public.medical_records DEFAULT;

-- Migrate existing data
INSERT INTO public.medical_records (id, patient_id, doctor_id, appointment_id, type, title, diagnosis, notes, vitals, attachments, region_id, created_at)
SELECT id, patient_id, doctor_id, appointment_id, type, title, diagnosis, notes, vitals, attachments, 'national', created_at
FROM public.medical_records_old;

DROP TABLE public.medical_records_old;

-- Create indexes on the partitioned table
CREATE INDEX medical_records_patient_idx ON public.medical_records(patient_id, created_at desc);
CREATE INDEX medical_records_region_idx ON public.medical_records(region_id);

-- Enable RLS
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

-- 3. RLS Data Residency Policy for Researchers and Gov Officials
-- Researchers and government officials can only query records that belong to their designated region
CREATE POLICY "Data Residency: Regional Read Access" 
ON public.medical_records FOR SELECT 
USING (
  region_id = (SELECT p.region_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('researcher', 'government'))
  OR (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) IN ('admin', 'super_admin')
  OR patient_id = auth.uid()
  OR doctor_id IN (SELECT d.id FROM public.doctors d WHERE d.profile_id = auth.uid())
);

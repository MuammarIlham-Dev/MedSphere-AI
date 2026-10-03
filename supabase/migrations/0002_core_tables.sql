create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  role                app_role not null default 'citizen',
  full_name           text not null,
  phone               text unique,
  dob                 date,
  gender              gender_type,
  blood_group         blood_group,
  avatar_url          text,
  digital_health_id   text not null unique,
  address             text,
  city                text,
  country             text not null default 'BD',
  lat                 double precision,
  lng                 double precision,
  emergency_contacts  jsonb not null default '[]',
  mfa_enabled         boolean not null default false,
  onboarding_completed boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index profiles_role_idx on public.profiles(role);
create index profiles_city_idx  on public.profiles(city);

create table public.hospitals (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles(id),
  name             text not null,
  license_no       text not null unique,
  type             text not null default 'general',
  address          text, city text, phone text, email text,
  lat double precision, lng double precision,
  bed_capacity     int not null default 0 check (bed_capacity >= 0),
  beds_available   int not null default 0 check (beds_available >= 0),
  icu_capacity     int not null default 0,
  icu_available    int not null default 0,
  ot_count         int not null default 0,
  emergency_capacity int not null default 0,
  verification     verification_status not null default 'pending',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index hospitals_city_idx on public.hospitals(city);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  name text not null,
  unique (hospital_id, name)
);

create table public.doctors (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null unique references public.profiles(id) on delete cascade,
  hospital_id      uuid references public.hospitals(id),
  specialty        text not null,
  qualifications   text[] not null default '{}',
  languages        text[] not null default '{}',
  experience_years int not null default 0 check (experience_years >= 0),
  license_no       text not null unique,
  consultation_fee numeric(10,2) not null default 0 check (consultation_fee >= 0),
  video_enabled    boolean not null default true,
  clinic_enabled   boolean not null default true,
  bio              text,
  rating_avg       numeric(2,1) not null default 0,
  rating_count     int not null default 0,
  verification     verification_status not null default 'pending',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index doctors_specialty_idx on public.doctors(specialty);
create index doctors_hospital_idx on public.doctors(hospital_id);

create table public.doctor_schedules (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time   time not null,
  slot_minutes int not null default 15 check (slot_minutes between 5 and 120),
  type consultation_type not null,
  is_active boolean not null default true,
  check (end_time > start_time)
);
create index doctor_schedules_idx on public.doctor_schedules(doctor_id, weekday);

create table public.patient_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  height_cm numeric(5,1), weight_kg numeric(5,1),
  allergies text[] not null default '{}',
  chronic_conditions text[] not null default '{}',
  insurance jsonb not null default '{}',
  wearable_links jsonb not null default '{}'
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id),
  doctor_id  uuid not null references public.doctors(id),
  hospital_id uuid references public.hospitals(id),
  scheduled_at timestamptz not null,
  day date generated always as ((scheduled_at at time zone 'utc')::date) stored,
  duration_min int not null default 15,
  type consultation_type not null,
  status appointment_status not null default 'booked',
  token_number int not null,
  reason text, cancel_reason text,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (doctor_id, day, token_number)
);
create index appointments_doctor_idx  on public.appointments(doctor_id, scheduled_at);
create index appointments_patient_idx on public.appointments(patient_id, status);

create table public.medical_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id),
  doctor_id uuid references public.doctors(id),
  appointment_id uuid references public.appointments(id),
  type record_type not null,
  title text not null,
  diagnosis text, notes text,
  vitals jsonb not null default '{}',
  attachments uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index medical_records_patient_idx on public.medical_records(patient_id, created_at desc);

create table public.vaccinations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id),
  vaccine_name text not null,
  dose_no int not null default 1,
  administered_at date not null,
  administered_by text, batch_no text,
  next_due_at date
);

create table public.medicines (
  id uuid primary key default gen_random_uuid(),
  name text not null, generic_name text, form text, strength text,
  manufacturer text, atc_code text
);
create index medicines_name_idx on public.medicines using gin (to_tsvector('simple', name));

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id),
  patient_id uuid not null references public.profiles(id),
  doctor_id uuid not null references public.doctors(id),
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now()
);

create table public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id),
  dosage text not null, frequency text not null,
  duration_days int not null check (duration_days > 0),
  instructions text
);

create table public.medication_reminders (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id),
  label text not null,
  times jsonb not null,             -- ["08:00","20:00"]
  start_date date not null, end_date date,
  is_active boolean not null default true
);

create table public.pharmacies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  name text not null, license_no text not null unique,
  address text, city text, lat double precision, lng double precision,
  delivery_enabled boolean not null default false,
  verification verification_status not null default 'pending'
);

create table public.pharmacy_inventory (
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id),
  quantity int not null default 0 check (quantity >= 0),
  price numeric(10,2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (pharmacy_id, medicine_id)
);

create table public.laboratories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  hospital_id uuid references public.hospitals(id),
  name text not null, license_no text not null unique,
  address text, city text,
  verification verification_status not null default 'pending'
);

create table public.lab_tests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, name text not null,
  category text, sample_type text,
  price numeric(10,2) not null default 0, tat_hours int not null default 24
);

create table public.lab_orders (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id),
  doctor_id uuid references public.doctors(id),
  lab_id uuid not null references public.laboratories(id),
  priority urgency_level not null default 'standard',
  status report_status not null default 'pending',
  booked_at timestamptz not null default now()
);

create table public.lab_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.lab_orders(id) on delete cascade,
  test_id uuid not null references public.lab_tests(id),
  sample_status sample_status not null default 'ordered',
  collected_at timestamptz
);

create table public.lab_reports (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.lab_orders(id),
  test_id uuid references public.lab_tests(id),
  file_id uuid,
  result_json jsonb not null default '{}',
  status report_status not null default 'pending',
  report_code text not null unique,          -- public verification code
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  bucket text not null, path text not null,
  mime text not null, size_bytes bigint not null check (size_bytes >= 0),
  sha256 text, purpose text,
  created_at timestamptz not null default now(),
  unique (bucket, path)
);

create table public.blood_banks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  hospital_id uuid references public.hospitals(id),
  name text not null, license_no text not null unique,
  city text, phone text, lat double precision, lng double precision,
  verification verification_status not null default 'pending'
);

create table public.blood_inventory (
  bank_id uuid not null references public.blood_banks(id) on delete cascade,
  blood_group blood_group not null,
  units_available int not null default 0 check (units_available >= 0),
  units_reserved  int not null default 0 check (units_reserved >= 0),
  updated_at timestamptz not null default now(),
  primary key (bank_id, blood_group)
);

create table public.blood_donors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id),
  blood_group blood_group not null,
  last_donation_at date,
  donation_count int not null default 0,
  is_eligible boolean not null default true
);

create table public.blood_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id),
  hospital_id uuid references public.hospitals(id),
  patient_name text not null,
  blood_group blood_group not null,
  units int not null check (units > 0),
  urgency urgency_level not null default 'standard',
  status request_status not null default 'open',
  needed_by timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index blood_requests_idx on public.blood_requests(status, blood_group);

create table public.donation_campaigns (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid not null references public.blood_banks(id),
  title text not null, venue text, city text,
  starts_at timestamptz not null, ends_at timestamptz not null
);

create table public.blood_donations (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references public.blood_donors(id),
  bank_id uuid not null references public.blood_banks(id),
  campaign_id uuid references public.donation_campaigns(id),
  donated_at date not null default current_date,
  units int not null default 1 check (units > 0)
);

create table public.organ_donors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  blood_group blood_group not null,
  hla jsonb not null default '[]',             -- ["A*02:01","B*07:02", ...]
  organs organ_type[] not null,
  age smallint, weight_kg numeric(5,1), height_cm numeric(5,1),
  city text, lat double precision, lng double precision,
  medical_eligibility text,
  consent consent_status not null default 'pending',
  consent_file_id uuid references public.files(id),
  is_deceased_registry boolean not null default false,
  status party_status not null default 'active',
  registered_at timestamptz not null default now()
);
create index organ_donors_idx on public.organ_donors(status, blood_group);

create table public.organ_recipients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  hospital_id uuid references public.hospitals(id),
  blood_group blood_group not null,
  hla jsonb not null default '[]',
  organ_needed organ_type not null,
  urgency urgency_level not null default 'standard',
  priority_score int not null default 0,
  diagnosis text,
  age smallint, weight_kg numeric(5,1), height_cm numeric(5,1),
  city text, lat double precision, lng double precision,
  waiting_since date not null default current_date,
  status party_status not null default 'waiting'
);
create index organ_recipients_idx on public.organ_recipients(status, organ_needed);

create table public.organ_matches (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references public.organ_donors(id),
  recipient_id uuid not null references public.organ_recipients(id),
  organ organ_type not null,
  compatibility_score int not null,
  blood_compatible boolean not null,
  hla_score int not null default 0,
  distance_km numeric(8,1),
  status match_status not null default 'proposed',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (donor_id, recipient_id, organ)
);
create index organ_matches_idx on public.organ_matches(status, compatibility_score desc);

create table public.transplant_schedules (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.organ_matches(id),
  hospital_id uuid not null references public.hospitals(id),
  scheduled_at timestamptz not null,
  status text not null default 'scheduled',
  outcome_notes text
);

create table public.ambulances (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid references public.hospitals(id),
  driver_id uuid references public.profiles(id),
  vehicle_no text not null unique,
  type text not null default 'basic',
  equipment text[] not null default '{}',
  status ambulance_status not null default 'available',
  current_lat double precision, current_lng double precision,
  updated_at timestamptz not null default now()
);

create table public.emergencies (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id),
  type text not null default 'medical',
  status emergency_status not null default 'active',
  lat double precision not null, lng double precision not null,
  address text,
  assigned_ambulance_id uuid references public.ambulances(id),
  assigned_hospital_id uuid references public.hospitals(id),
  log jsonb not null default '[]',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index emergencies_idx on public.emergencies(status, created_at desc);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id),
  subject text,
  created_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null,
  attachments uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index messages_idx on public.messages(conversation_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null, body text,
  data jsonb not null default '{}',
  priority notification_priority not null default 'normal',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_idx on public.notifications(user_id, read_at, created_at desc);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  table_name text not null,
  record_id text,
  old_data jsonb, new_data jsonb,
  ip inet, user_agent text,
  created_at timestamptz not null default now()
);

create table public.settings (
  key text primary key,
  value jsonb not null
);

create table public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid,
  event text not null,
  properties jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index analytics_events_idx on public.analytics_events(event, created_at desc);
-- At national scale, convert analytics_events + audit_logs to monthly partitions.

create table public.appointment_feedback (
  appointment_id uuid primary key references public.appointments(id),
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

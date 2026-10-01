create extension if not exists pgcrypto;
create extension if not exists cube;
create extension if not exists earthdistance;

create type app_role as enum (
  'citizen','doctor','hospital','laboratory','pharmacy','blood_bank',
  'organ_authority','ambulance_driver','emergency_operator','government',
  'researcher','volunteer','admin','super_admin'
);
create type verification_status as enum ('pending','verified','rejected','suspended');
create type blood_group as enum ('O-','O+','A-','A+','B-','B+','AB-','AB+');
create type gender_type as enum ('male','female','other');
create type consultation_type as enum ('video','clinic');
create type appointment_status as enum
  ('booked','confirmed','checked_in','in_progress','completed','cancelled','no_show','rescheduled');
create type urgency_level as enum ('low','standard','high','critical');
create type organ_type as enum ('kidney','liver','heart','lung','pancreas','cornea','bone_marrow');
create type match_status as enum ('proposed','under_review','accepted','rejected','transplanted','expired');
create type request_status as enum ('open','fulfilled','partially_fulfilled','cancelled','expired');
create type emergency_status as enum ('active','dispatched','on_scene','transporting','arrived','resolved','cancelled');
create type notification_priority as enum ('low','normal','high','critical');
create type report_status as enum ('pending','in_progress','completed','verified','delivered');
create type sample_status as enum ('ordered','collected','in_transit','received','processing','analyzed');
create type consent_status as enum ('pending','granted','withdrawn');
create type party_status as enum ('active','waiting','matched','transplanted','inactive','deceased');
create type ambulance_status as enum ('available','dispatched','busy','maintenance','offline');
create type record_type as enum
  ('consultation','diagnosis','surgery','vaccination','allergy','lab','imaging','note');
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
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create or replace function public.apply_updated_at(t regclass) returns void
language plpgsql as $$
begin execute format(
  'create trigger trg_updated_at before update on %s
   for each row execute function public.set_updated_at()', t);
end $$;

select public.apply_updated_at('public.profiles');
select public.apply_updated_at('public.hospitals');
select public.apply_updated_at('public.doctors');
select public.apply_updated_at('public.appointments');
select public.apply_updated_at('public.pharmacy_inventory');
select public.apply_updated_at('public.blood_inventory');
select public.apply_updated_at('public.ambulances');

-- Profile bootstrap on signup (role arrives via user metadata)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare r app_role;
begin
  begin r := coalesce((new.raw_user_meta_data->>'role')::app_role, 'citizen');
  exception when others then r := 'citizen'; end;
  if r in ('admin','super_admin') then r := 'citizen'; end if;  -- never self-serve admin
  insert into public.profiles (id, role, full_name, phone, digital_health_id)
  values (
    new.id, r,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.phone,
    'MSH-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role helpers (used by RLS)
create or replace function public.current_role() returns app_role
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select public.current_role() in ('admin','super_admin') $$;

create or replace function public.is_treating_doctor(p_patient uuid, p_doctor uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from public.appointments a
     where a.patient_id = p_patient
       and a.doctor_id = p_doctor
       and a.status in ('confirmed','checked_in','in_progress','completed')) $$;

-- Immutable audit trail
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  values (auth.uid(), TG_OP, TG_TABLE_NAME,
          coalesce(new.id::text, old.id::text),
          case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when TG_OP in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create trigger audit_organ_matches   after insert or update or delete on public.organ_matches   for each row execute function public.audit_row();
create trigger audit_organ_donors    after insert or update or delete on public.organ_donors    for each row execute function public.audit_row();
create trigger audit_organ_recipients after insert or update or delete on public.organ_recipients for each row execute function public.audit_row();
create trigger audit_blood_inventory after insert or update or delete on public.blood_inventory for each row execute function public.audit_row();
create trigger audit_verifications   after update on public.doctors for each row execute function public.audit_row();

-- Blood compatibility (transfusion rules)
create or replace function public.blood_compatible(d blood_group, r blood_group)
returns boolean language sql immutable as $$
  select case d
    when 'O-'  then true
    when 'O+'  then r in ('O+','A+','B+','AB+')
    when 'A-'  then r in ('A-','A+','AB-','AB+')
    when 'A+'  then r in ('A+','AB+')
    when 'B-'  then r in ('B-','B+','AB-','AB+')
    when 'B+'  then r in ('B+','AB+')
    when 'AB-' then r in ('AB-','AB+')
    when 'AB+' then r = 'AB+' end $$;

-- Recipient priority score (urgency + waiting time + age modifiers)
create or replace function public.compute_organ_priority(p_recipient uuid)
returns int language plpgsql stable security definer set search_path = public as $$
declare r public.organ_recipients;
begin
  select * into r from public.organ_recipients where id = p_recipient;
  if not found then return 0; end if;
  return least(100,
    (case r.urgency when 'critical' then 60 when 'high' then 40 when 'standard' then 20 else 10 end)
    + least(20, greatest(0, extract(month from age(current_date, r.waiting_since))::int * 2))
    + (case when r.age is not null and r.age < 18 then 10
            when r.age is not null and r.age > 65 then 5 else 0 end));
end $$;

create or replace function public.refresh_recipient_priority() returns trigger
language plpgsql security definer set search_path = public as $$
begin new.priority_score = public.compute_organ_priority(new.id); return new; end $$;

create trigger trg_recipient_priority before insert or update of urgency, waiting_since
  on public.organ_recipients for each row execute function public.refresh_recipient_priority();

-- HLA overlap score: 6 points per shared allele (max 36)
create or replace function public.hla_score(a jsonb, b jsonb)
returns int language sql immutable as $$
  select least(36, coalesce(6 * (select count(*) from jsonb_array_elements_text(a) x
    join jsonb_array_elements_text(b) y on x.value = y.value), 0)) $$;

-- Compatibility engine â€” ASSISTIVE ONLY.
-- Produces an explainable score for authorized coordinators; never auto-accepts.
create or replace function public.score_organ_match(p_donor uuid, p_recipient uuid)
returns table (score int, blood_ok boolean, hla int, distance_km numeric)
language plpgsql security definer set search_path = public as $$
declare d public.organ_donors; r public.organ_recipients;
        b boolean; h int; km numeric; s int;
begin
  select * into d from public.organ_donors where id = p_donor;
  select * into r from public.organ_recipients where id = p_recipient;
  b := public.blood_compatible(d.blood_group, r.blood_group);
  h := public.hla_score(d.hla, r.hla);
  km := case when d.lat is not null and r.lat is not null then round(
        (earth_distance(ll_to_earth(d.lat,d.lng), ll_to_earth(r.lat,r.lng))/1000)::numeric, 1) end;
  s := (case when b then 40 else 0 end) + h
     + (case when km is null then 6 when km <= 100 then 12 when km <= 500 then 8 else 4 end)
     + least(12, round(r.priority_score * 0.12)::int);
  return query select s, b, h, km;
end $$;

-- Generate proposed matches for a donor (organ_authority / hospital / admin only)
create or replace function public.run_organ_matching(p_donor uuid)
returns int language plpgsql security definer set search_path = public as $$
declare d public.organ_donors; r record; o organ_type; n int := 0; m record;
begin
  if public.current_role() not in ('organ_authority','hospital','admin','super_admin') then
    raise exception 'forbidden';
  end if;
  select * into d from public.organ_donors where id = p_donor and status = 'active';
  if not found then return 0; end if;
  foreach o in array d.organs loop
    for r in select * from public.organ_recipients
             where organ_needed = o and status = 'waiting' loop
      select * into m from public.score_organ_match(d.id, r.id);
      insert into public.organ_matches
        (donor_id, recipient_id, organ, compatibility_score, blood_compatible, hla_score, distance_km)
      values (d.id, r.id, o, m.score, m.blood_ok, m.hla, m.distance_km)
      on conflict (donor_id, recipient_id, organ)
      do update set compatibility_score = excluded.compatibility_score,
                    blood_compatible = excluded.blood_compatible,
                    hla_score = excluded.hla_score,
                    distance_km = excluded.distance_km;
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;
alter table public.profiles enable row level security;
alter table public.hospitals enable row level security;
alter table public.departments enable row level security;
alter table public.doctors enable row level security;
alter table public.doctor_schedules enable row level security;
alter table public.patient_profiles enable row level security;
alter table public.appointments enable row level security;
alter table public.medical_records enable row level security;
alter table public.vaccinations enable row level security;
alter table public.prescriptions enable row level security;
alter table public.prescription_items enable row level security;
alter table public.medication_reminders enable row level security;
alter table public.medicines enable row level security;
alter table public.pharmacies enable row level security;
alter table public.pharmacy_inventory enable row level security;
alter table public.laboratories enable row level security;
alter table public.lab_tests enable row level security;
alter table public.lab_orders enable row level security;
alter table public.lab_order_items enable row level security;
alter table public.lab_reports enable row level security;
alter table public.files enable row level security;
alter table public.blood_banks enable row level security;
alter table public.blood_inventory enable row level security;
alter table public.blood_donors enable row level security;
alter table public.blood_requests enable row level security;
alter table public.blood_donations enable row level security;
alter table public.donation_campaigns enable row level security;
alter table public.organ_donors enable row level security;
alter table public.organ_recipients enable row level security;
alter table public.organ_matches enable row level security;
alter table public.transplant_schedules enable row level security;
alter table public.ambulances enable row level security;
alter table public.emergencies enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.settings enable row level security;
alter table public.analytics_events enable row level security;
alter table public.appointment_feedback enable row level security;

-- Profiles
create policy profiles_self on public.profiles
  for select using (id = auth.uid() or public.is_admin()
    or public.current_role() in ('government','organ_authority','emergency_operator'));
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

-- Hospitals / departments / doctors: public-readable when verified
create policy hospitals_read on public.hospitals
  for select using (verification = 'verified' or owner_id = auth.uid() or public.is_admin());
create policy hospitals_write on public.hospitals
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
create policy departments_read on public.departments for select using (true);
create policy departments_write on public.departments for all using (
  exists (select 1 from public.hospitals h where h.id = hospital_id
          and (h.owner_id = auth.uid() or public.is_admin())));
create policy doctors_read on public.doctors
  for select using (verification = 'verified' or profile_id = auth.uid() or public.is_admin());
create policy doctors_self on public.doctors
  for all using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());
create policy schedules_read on public.doctor_schedules for select using (is_active = true
  or exists (select 1 from public.doctors d where d.id = doctor_id and d.profile_id = auth.uid()));
create policy schedules_write on public.doctor_schedules for all using (
  exists (select 1 from public.doctors d where d.id = doctor_id and d.profile_id = auth.uid()));

-- Patient profile & records: owner + treating clinician
create policy patient_profile_rw on public.patient_profiles
  for all using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());
create policy records_read on public.medical_records for select using (
  patient_id = auth.uid() or public.is_admin()
  or (public.current_role() = 'doctor' and public.is_treating_doctor(patient_id,
        (select id from public.doctors where profile_id = auth.uid()))));
create policy records_write on public.medical_records for insert with check (
  public.current_role() = 'doctor' and public.is_treating_doctor(patient_id,
        (select id from public.doctors where profile_id = auth.uid())));
create policy vaccinations_read on public.vaccinations for select using (
  patient_id = auth.uid() or public.is_admin() or public.current_role() in ('doctor','government','researcher'));

-- Appointments
create policy appointments_read on public.appointments for select using (
  patient_id = auth.uid() or public.is_admin()
  or doctor_id = (select id from public.doctors where profile_id = auth.uid())
  or hospital_id in (select id from public.hospitals where owner_id = auth.uid()));
create policy appointments_insert on public.appointments for insert with check (patient_id = auth.uid());
create policy appointments_update on public.appointments for update using (
  patient_id = auth.uid()
  or doctor_id = (select id from public.doctors where profile_id = auth.uid())
  or hospital_id in (select id from public.hospitals where owner_id = auth.uid())
  or public.is_admin());
create policy feedback_rw on public.appointment_feedback for all using (
  exists (select 1 from public.appointments a where a.id = appointment_id and a.patient_id = auth.uid()));

-- Prescriptions & reminders
create policy prescriptions_read on public.prescriptions for select using (
  patient_id = auth.uid() or public.is_admin()
  or doctor_id = (select id from public.doctors where profile_id = auth.uid())
  or public.current_role() = 'pharmacy');
create policy prescriptions_write on public.prescriptions for insert with check (
  public.current_role() = 'doctor'
  and doctor_id = (select id from public.doctors where profile_id = auth.uid()));
create policy prescription_items_read on public.prescription_items for select using (
  exists (select 1 from public.prescriptions p where p.id = prescription_id
          and (p.patient_id = auth.uid() or public.current_role() in ('doctor','pharmacy','admin','super_admin'))));
create policy prescription_items_write on public.prescription_items for insert with check (
  exists (select 1 from public.prescriptions p where p.id = prescription_id
          and p.doctor_id = (select id from public.doctors where profile_id = auth.uid())));
create policy reminders_owner on public.medication_reminders
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());

-- Catalogs: readable by all authenticated users; writable by admins
create policy medicines_read on public.medicines for select using (true);
create policy medicines_admin on public.medicines for all using (public.is_admin());
create policy lab_tests_read on public.lab_tests for select using (true);
create policy lab_tests_admin on public.lab_tests for all using (public.is_admin());

-- Pharmacy / labs
create policy pharmacies_read on public.pharmacies for select using
  (verification = 'verified' or owner_id = auth.uid() or public.is_admin());
create policy pharmacies_write on public.pharmacies for all using
  (owner_id = auth.uid() or public.is_admin());
create policy pharmacy_inv_read on public.pharmacy_inventory for select using (true);
create policy pharmacy_inv_write on public.pharmacy_inventory for all using (
  exists (select 1 from public.pharmacies p where p.id = pharmacy_id and p.owner_id = auth.uid()));
create policy laboratories_read on public.laboratories for select using
  (verification = 'verified' or owner_id = auth.uid() or public.is_admin());
create policy laboratories_write on public.laboratories for all using
  (owner_id = auth.uid() or public.is_admin());
create policy lab_orders_rw on public.lab_orders for all using (
  patient_id = auth.uid() or public.is_admin()
  or lab_id in (select id from public.laboratories where owner_id = auth.uid())
  or doctor_id = (select id from public.doctors where profile_id = auth.uid()));
create policy lab_items_rw on public.lab_order_items for all using (
  exists (select 1 from public.lab_orders o where o.id = order_id and (
    o.patient_id = auth.uid() or public.is_admin()
    or o.lab_id in (select id from public.laboratories where owner_id = auth.uid()))));
create policy lab_reports_read on public.lab_reports for select using (
  public.is_admin()
  or exists (select 1 from public.lab_orders o where o.id = order_id and (
    o.patient_id = auth.uid()
    or o.lab_id in (select id from public.laboratories where owner_id = auth.uid())
    or o.doctor_id = (select id from public.doctors where profile_id = auth.uid()))));
create policy lab_reports_write on public.lab_reports for all using (
  exists (select 1 from public.lab_orders o where o.id = order_id
          and o.lab_id in (select id from public.laboratories where owner_id = auth.uid()))
  or public.is_admin());

-- Files metadata mirrors storage ownership
create policy files_owner on public.files for all using
  (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid());

-- Blood
create policy banks_read on public.blood_banks for select using
  (verification = 'verified' or owner_id = auth.uid() or public.is_admin());
create policy banks_write on public.blood_banks for all using
  (owner_id = auth.uid() or public.is_admin());
create policy blood_inv_read on public.blood_inventory for select using (true);
create policy blood_inv_write on public.blood_inventory for all using (
  exists (select 1 from public.blood_banks b where b.id = bank_id and b.owner_id = auth.uid())
  or public.is_admin());
create policy blood_donors_self on public.blood_donors for all using
  (profile_id = auth.uid() or public.is_admin()
   or public.current_role() in ('blood_bank','hospital'));
create policy blood_requests_read on public.blood_requests for select using (
  requester_id = auth.uid() or public.is_admin()
  or public.current_role() in ('blood_bank','hospital','government','emergency_operator'));
create policy blood_requests_write on public.blood_requests for insert with check (requester_id = auth.uid());
create policy blood_requests_update on public.blood_requests for update using (
  requester_id = auth.uid() or public.is_admin()
  or public.current_role() in ('blood_bank','hospital'));
create policy donations_read on public.blood_donations for select using (
  exists (select 1 from public.blood_donors d where d.id = donor_id and d.profile_id = auth.uid())
  or public.is_admin() or public.current_role() in ('blood_bank','government'));
create policy donations_write on public.blood_donations for insert with check (
  public.current_role() in ('blood_bank','admin','super_admin'));
create policy campaigns_read on public.donation_campaigns for select using (true);
create policy campaigns_write on public.donation_campaigns for all using (
  exists (select 1 from public.blood_banks b where b.id = bank_id and b.owner_id = auth.uid()));

-- Organ (coordinator-assisted workflow)
create policy organ_donors_read on public.organ_donors for select using (
  profile_id = auth.uid() or public.is_admin()
  or public.current_role() in ('organ_authority','hospital'));
create policy organ_donors_insert on public.organ_donors for insert with check (profile_id = auth.uid());
create policy organ_donors_update on public.organ_donors for update using (
  profile_id = auth.uid() or public.is_admin() or public.current_role() = 'organ_authority');
create policy organ_recipients_read on public.organ_recipients for select using (
  profile_id = auth.uid() or public.is_admin()
  or public.current_role() in ('organ_authority','hospital'));
create policy organ_recipients_insert on public.organ_recipients for insert with check (
  profile_id = auth.uid() or public.current_role() in ('organ_authority','hospital'));
create policy organ_recipients_update on public.organ_recipients for update using (
  public.is_admin() or public.current_role() = 'organ_authority'
  or hospital_id in (select id from public.hospitals where owner_id = auth.uid()));
create policy organ_matches_read on public.organ_matches for select using (
  public.is_admin() or public.current_role() in ('organ_authority','hospital')
  or exists (select 1 from public.organ_donors d where d.id = donor_id and d.profile_id = auth.uid())
  or exists (select 1 from public.organ_recipients r where r.id = recipient_id and r.profile_id = auth.uid()));
create policy organ_matches_review on public.organ_matches for update using (
  public.is_admin() or public.current_role() = 'organ_authority'
  or public.current_role() = 'hospital');
create policy transplant_rw on public.transplant_schedules for all using (
  public.is_admin() or public.current_role() in ('organ_authority','hospital'));

-- Emergency
create policy emergencies_read on public.emergencies for select using (
  reporter_id = auth.uid() or public.is_admin()
  or public.current_role() in ('emergency_operator','government','hospital','ambulance_driver'));
create policy emergencies_insert on public.emergencies for insert with check (reporter_id = auth.uid());
create policy emergencies_update on public.emergencies for update using (
  public.is_admin() or public.current_role() in ('emergency_operator','hospital','ambulance_driver'));
create policy ambulances_read on public.ambulances for select using (true);
create policy ambulances_write on public.ambulances for all using (
  driver_id = auth.uid() or public.is_admin()
  or hospital_id in (select id from public.hospitals where owner_id = auth.uid()));

-- Chat
create policy conversations_rw on public.conversations for all using (
  public.is_admin() or exists (select 1 from public.conversation_participants p
    where p.conversation_id = id and p.user_id = auth.uid()));
create policy participants_read on public.conversation_participants for select using (
  user_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.conversation_participants me
    where me.conversation_id = conversation_id and me.user_id = auth.uid()));
create policy participants_write on public.conversation_participants for all using (
  user_id = auth.uid() or public.is_admin()
  or public.current_role() in ('doctor','hospital'));
create policy messages_rw on public.messages for all using (
  exists (select 1 from public.conversation_participants p
    where p.conversation_id = conversation_id and p.user_id = auth.uid()))
  with check (sender_id = auth.uid());

-- Notifications / settings / analytics / audit
create policy notifications_owner on public.notifications for all using
  (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_system_insert on public.notifications for insert
  with check (public.current_role() in ('admin','super_admin','organ_authority','hospital','emergency_operator') or user_id = auth.uid());
create policy settings_read on public.settings for select using (true);
create policy settings_admin on public.settings for all using (public.is_admin());
create policy analytics_insert on public.analytics_events for insert with check (true);
create policy analytics_read on public.analytics_events for select using
  (public.is_admin() or public.current_role() in ('government','researcher'));
create policy audit_read on public.audit_logs for select using (public.is_admin());

-- Realtime publications (idempotent)
do $$ begin alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.emergencies;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.appointments;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.blood_inventory;
exception when duplicate_object then null; end $$;

-- Storage buckets
insert into storage.buckets (id, name, public) values
  ('avatars','avatars', true),
  ('documents','documents', false),
  ('reports','reports', false),
  ('consent','consent', false)
on conflict (id) do nothing;

-- Path convention: {bucket}/{user_id}/{filename}
create policy storage_own_read on storage.objects for select using (
  bucket_id in ('documents','reports','consent')
  and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin()
       or public.current_role() in ('organ_authority','doctor','laboratory')));
create policy storage_own_write on storage.objects for insert with check (
  bucket_id in ('documents','reports','consent','avatars')
  and auth.uid()::text = (storage.foldername(name))[1]);
create policy storage_avatars_read on storage.objects for select using (bucket_id = 'avatars');
create policy storage_own_delete on storage.objects for delete using (
  auth.uid()::text = (storage.foldername(name))[1]);
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

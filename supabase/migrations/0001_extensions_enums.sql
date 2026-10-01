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

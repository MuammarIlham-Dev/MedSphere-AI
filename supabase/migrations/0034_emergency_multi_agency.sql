-- Migration 0034: Emergency multi-agency enum prerequisites
-- app_role is extended in its own migration so the new enum value is committed
-- before any subsequent migration uses it in policies, queries, or function bodies.

alter type public.app_role add value if not exists 'emergency_responder';

do $$
begin
  create type public.emergency_agency_type as enum ('ems','fire','police','rescue');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.emergency_agency_dispatch_status as enum (
    'offered','acknowledged','en_route','on_scene','completed',
    'declined','timed_out','cancelled'
  );
exception when duplicate_object then null;
end $$;

-- The concrete agency schema and RPCs are created in migration 0035 after this
-- transaction has committed.

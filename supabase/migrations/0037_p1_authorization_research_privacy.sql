-- 0037: P1 authorization and research privacy boundary
-- Converges legacy clinical writes onto server-authorized workflows and makes the
-- research API strictly scoped to the caller's approved study + residency scope.
--
-- This migration intentionally does NOT claim differential privacy. The research
-- query engine enforces a minimum cohort size (k=5), not DP noise/accounting.

-- ---------------------------------------------------------------------------
-- Organ network: hospital-scoped visibility + server-authorized match review
-- ---------------------------------------------------------------------------

drop policy if exists organ_donors_read on public.organ_donors;
create policy organ_donors_read on public.organ_donors
for select using (
  profile_id = auth.uid()
  or public.is_admin()
  or public.current_role() = 'organ_authority'
  or exists (
    select 1
    from public.organ_matches om
    join public.organ_recipients r on r.id = om.recipient_id
    join public.hospitals h on h.id = r.hospital_id
    where om.donor_id = organ_donors.id
      and h.owner_id = auth.uid()
  )
);

drop policy if exists organ_recipients_read on public.organ_recipients;
create policy organ_recipients_read on public.organ_recipients
for select using (
  profile_id = auth.uid()
  or public.is_admin()
  or public.current_role() = 'organ_authority'
  or hospital_id in (
    select h.id from public.hospitals h where h.owner_id = auth.uid()
  )
);

drop policy if exists organ_matches_read on public.organ_matches;
create policy organ_matches_read on public.organ_matches
for select using (
  public.is_admin()
  or public.current_role() = 'organ_authority'
  or exists (
    select 1 from public.organ_donors d
    where d.id = donor_id and d.profile_id = auth.uid()
  )
  or exists (
    select 1 from public.organ_recipients r
    where r.id = recipient_id and r.profile_id = auth.uid()
  )
  or exists (
    select 1
    from public.organ_recipients r
    join public.hospitals h on h.id = r.hospital_id
    where r.id = recipient_id and h.owner_id = auth.uid()
  )
);

-- No direct mutation of match decisions. The RPC below is the authority boundary.
drop policy if exists organ_matches_review on public.organ_matches;
revoke insert, update, delete on public.organ_matches from authenticated, anon;

create or replace function public.review_organ_match(
  p_match_id uuid,
  p_approve boolean,
  p_notes text
) returns public.organ_matches
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.organ_matches%rowtype;
  r public.organ_recipients%rowtype;
  result public.organ_matches%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_match_id is null or nullif(trim(p_notes), '') is null then
    raise exception 'match and review notes are required';
  end if;

  select * into m
  from public.organ_matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'organ match not found';
  end if;

  select * into r
  from public.organ_recipients
  where id = m.recipient_id;

  if not found then
    raise exception 'recipient not found';
  end if;

  if public.current_role() not in ('organ_authority','admin','super_admin','hospital') then
    raise exception 'organ match review access required';
  end if;

  if public.current_role() = 'hospital'
     and not exists (
       select 1 from public.hospitals h
       where h.id = r.hospital_id and h.owner_id = auth.uid()
     ) then
    raise exception 'hospital may only review its own recipient matches';
  end if;

  if m.status not in ('proposed','under_review') then
    raise exception 'match is no longer awaiting review';
  end if;

  update public.organ_matches
  set status = case when p_approve then 'accepted'::public.match_status else 'rejected'::public.match_status end,
      notes = trim(p_notes),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = m.id
  returning * into result;

  insert into public.audit_logs(actor_id, action, table_name, record_id, new_data)
  values (
    auth.uid(),
    case when p_approve then 'organ_match.accepted' else 'organ_match.rejected' end,
    'organ_matches',
    result.id::text,
    jsonb_build_object(
      'recipient_id', result.recipient_id,
      'donor_id', result.donor_id,
      'organ', result.organ,
      'status', result.status,
      'notes', result.notes
    )
  );

  return result;
end;
$$;

revoke all on function public.review_organ_match(uuid,boolean,text) from public, anon;
grant execute on function public.review_organ_match(uuid,boolean,text) to authenticated;

-- ---------------------------------------------------------------------------
-- Transplant scheduling: hospital ownership / accepted-match boundary
-- ---------------------------------------------------------------------------

drop policy if exists transplant_rw on public.transplant_schedules;
revoke insert, update, delete on public.transplant_schedules from authenticated, anon;

create policy transplant_read on public.transplant_schedules
for select using (
  public.is_admin()
  or public.current_role() = 'organ_authority'
  or hospital_id in (
    select h.id from public.hospitals h where h.owner_id = auth.uid()
  )
);

create or replace function public.create_transplant_schedule(
  p_match_id uuid,
  p_hospital_id uuid,
  p_scheduled_at timestamptz
) returns public.transplant_schedules
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.organ_matches%rowtype;
  r public.organ_recipients%rowtype;
  result public.transplant_schedules%rowtype;
begin
  if auth.uid() is null or p_match_id is null or p_hospital_id is null then
    raise exception 'match and hospital are required';
  end if;

  if p_scheduled_at <= now() then
    raise exception 'transplant schedule must be in the future';
  end if;

  select * into m from public.organ_matches where id=p_match_id;
  if not found or m.status <> 'accepted' then
    raise exception 'an accepted organ match is required';
  end if;

  select * into r from public.organ_recipients where id=m.recipient_id;
  if not found then raise exception 'recipient not found'; end if;

  if r.hospital_id is not null and r.hospital_id <> p_hospital_id then
    raise exception 'schedule hospital must match the recipient hospital';
  end if;

  if not (
    public.is_admin()
    or public.current_role() = 'organ_authority'
    or exists (
      select 1 from public.hospitals h
      where h.id=p_hospital_id and h.owner_id=auth.uid()
    )
  ) then
    raise exception 'hospital scheduling access required';
  end if;

  insert into public.transplant_schedules(match_id,hospital_id,scheduled_at,status)
  values (p_match_id,p_hospital_id,p_scheduled_at,'scheduled')
  returning * into result;

  insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
  values(auth.uid(),'transplant_schedule.created','transplant_schedules',result.id::text,
    jsonb_build_object('match_id',result.match_id,'hospital_id',result.hospital_id,'scheduled_at',result.scheduled_at));

  return result;
end;
$$;

create or replace function public.update_transplant_schedule(
  p_schedule_id uuid,
  p_status text,
  p_outcome_notes text default null
) returns public.transplant_schedules
language plpgsql
security definer
set search_path = public
as $$
declare s public.transplant_schedules%rowtype;
  result public.transplant_schedules%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_status not in ('scheduled','completed','cancelled') then
    raise exception 'invalid transplant schedule status';
  end if;

  select * into s from public.transplant_schedules where id=p_schedule_id for update;
  if not found then raise exception 'transplant schedule not found'; end if;

  if not (
    public.is_admin()
    or public.current_role() = 'organ_authority'
    or exists (
      select 1 from public.hospitals h
      where h.id=s.hospital_id and h.owner_id=auth.uid()
    )
  ) then
    raise exception 'transplant schedule access required';
  end if;

  if s.status='cancelled' and p_status<>'cancelled' then
    raise exception 'cancelled schedules cannot be reopened';
  end if;
  if s.status='completed' and p_status<>'completed' then
    raise exception 'completed schedules cannot be reopened';
  end if;

  update public.transplant_schedules
  set status=p_status,
      outcome_notes=case
        when nullif(trim(p_outcome_notes),'') is not null then trim(p_outcome_notes)
        else outcome_notes
      end
  where id=s.id
  returning * into result;

  insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
  values(auth.uid(),'transplant_schedule.updated','transplant_schedules',result.id::text,
    jsonb_build_object('status',result.status,'outcome_notes',result.outcome_notes));

  return result;
end;
$$;

revoke all on function public.create_transplant_schedule(uuid,uuid,timestamptz),
  public.update_transplant_schedule(uuid,text,text) from public, anon;
grant execute on function public.create_transplant_schedule(uuid,uuid,timestamptz),
  public.update_transplant_schedule(uuid,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- Pharmacy inventory: public discovery remains read-only + verified only
-- ---------------------------------------------------------------------------

drop policy if exists pharmacy_inv_read on public.pharmacy_inventory;
create policy pharmacy_inv_read on public.pharmacy_inventory
for select using (
  public.is_admin()
  or exists (
    select 1 from public.pharmacies p
    where p.id = pharmacy_id
      and (p.verification='verified' or p.owner_id=auth.uid())
  )
);

drop policy if exists pharmacy_inv_write on public.pharmacy_inventory;
revoke insert, update, delete on public.pharmacy_inventory from authenticated, anon;

create or replace function public.set_pharmacy_inventory(
  p_pharmacy_id uuid,
  p_medicine_id uuid,
  p_quantity int,
  p_price numeric
) returns public.pharmacy_inventory
language plpgsql
security definer
set search_path = public
as $$
declare
  pharmacy public.pharmacies%rowtype;
  result public.pharmacy_inventory%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_quantity < 0 or p_price < 0 then raise exception 'quantity and price must be non-negative'; end if;

  select * into pharmacy
  from public.pharmacies
  where id=p_pharmacy_id
    and owner_id=auth.uid()
    and verification='verified'
  for update;

  if not found then raise exception 'verified pharmacy access required'; end if;
  if not exists (select 1 from public.medicines where id=p_medicine_id) then
    raise exception 'medicine not found';
  end if;

  insert into public.pharmacy_inventory(pharmacy_id,medicine_id,quantity,price,updated_at)
  values(p_pharmacy_id,p_medicine_id,p_quantity,round(p_price,2),now())
  on conflict (pharmacy_id,medicine_id)
  do update set quantity=excluded.quantity,price=excluded.price,updated_at=now()
  returning * into result;

  insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
  values(auth.uid(),'pharmacy_inventory.adjusted','pharmacy_inventory',
    p_pharmacy_id::text||':'||p_medicine_id::text,
    jsonb_build_object('pharmacy_id',p_pharmacy_id,'medicine_id',p_medicine_id,
                       'quantity',p_quantity,'price',round(p_price,2)));

  return result;
end;
$$;

revoke all on function public.set_pharmacy_inventory(uuid,uuid,int,numeric) from public, anon;
grant execute on function public.set_pharmacy_inventory(uuid,uuid,int,numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- Research: role + residency authorization, honest k-anonymity semantics,
-- query audit trail, and bounded filter sizes.
-- ---------------------------------------------------------------------------

alter table public.research_studies
  add column if not exists scope_region text;

update public.research_studies
set scope_region = coalesce(
  scope_region,
  (select p.region_id from public.profiles p where p.id=research_studies.researcher_id),
  'national'
)
where scope_region is null;

alter table public.research_studies
  alter column scope_region set default 'national';

alter table public.research_studies
  add constraint research_studies_title_len_check
  check (char_length(trim(title)) between 3 and 200);

alter table public.research_studies
  add constraint research_studies_purpose_len_check
  check (char_length(trim(purpose)) between 10 and 4000);

create table if not exists public.research_query_audit (
  id bigint generated always as identity primary key,
  study_id uuid not null references public.research_studies(id) on delete cascade,
  researcher_id uuid not null references public.profiles(id) on delete cascade,
  requested_region text,
  diagnosis_filter text,
  result_group_count int not null default 0,
  queried_at timestamptz not null default now()
);

create index if not exists research_query_audit_researcher_idx
  on public.research_query_audit(researcher_id, queried_at desc);
create index if not exists research_query_audit_study_idx
  on public.research_query_audit(study_id, queried_at desc);

alter table public.research_query_audit enable row level security;
drop policy if exists research_query_audit_read on public.research_query_audit;
create policy research_query_audit_read on public.research_query_audit
for select using (researcher_id=auth.uid() or public.is_admin());
revoke insert, update, delete on public.research_query_audit from authenticated, anon;

drop policy if exists "Researchers can insert studies" on public.research_studies;
create policy "Researchers can insert studies"
on public.research_studies for insert
with check (
  researcher_id=auth.uid()
  and public.current_role()='researcher'
);

create or replace function public.get_anonymized_cohort_stats(
  p_study_id uuid,
  p_region text default null,
  p_diagnosis text default null
)
returns table (
  region_id text,
  diagnosis text,
  patient_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  study public.research_studies%rowtype;
  caller_region text;
  normalized_region text;
  normalized_diagnosis text;
  result_groups int := 0;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if public.current_role() <> 'researcher' then
    raise exception 'researcher access required';
  end if;

  select * into study
  from public.research_studies
  where id=p_study_id
    and researcher_id=auth.uid()
    and status='approved';

  if not found then
    raise exception 'approved research study access required';
  end if;

  select coalesce(nullif(trim(p.region_id),''),'national')
  into caller_region
  from public.profiles p
  where p.id=auth.uid();

  normalized_region := nullif(trim(p_region),'');
  normalized_diagnosis := nullif(trim(p_diagnosis),'');

  if normalized_region is not null and normalized_region <> caller_region then
    raise exception 'requested region is outside your residency scope';
  end if;

  if study.scope_region is not null
     and study.scope_region <> 'national'
     and caller_region <> 'national'
     and study.scope_region <> caller_region then
    raise exception 'study is outside your assigned research region';
  end if;

  if normalized_region is null then
    normalized_region := case when caller_region='national' then study.scope_region else caller_region end;
  end if;

  if normalized_region is null then
    normalized_region := 'national';
  end if;

  if char_length(coalesce(normalized_diagnosis,'')) > 120 then
    raise exception 'diagnosis filter is too long';
  end if;

  return query
  select
    mr.region_id,
    coalesce(mr.diagnosis,'Unknown') as diagnosis,
    count(distinct mr.patient_id) as patient_count
  from public.medical_records mr
  where mr.region_id = normalized_region
    and (
      normalized_diagnosis is null
      or mr.diagnosis ilike '%' || normalized_diagnosis || '%'
    )
  group by mr.region_id, mr.diagnosis
  having count(distinct mr.patient_id) >= 5
  order by count(distinct mr.patient_id) desc;

  get diagnostics result_groups = row_count;

  insert into public.research_query_audit(
    study_id,researcher_id,requested_region,diagnosis_filter,result_group_count
  )
  values (
    study.id,auth.uid(),normalized_region,normalized_diagnosis,result_groups
  );
end;
$$;

revoke all on function public.get_anonymized_cohort_stats(uuid,text,text) from public, anon;
grant execute on function public.get_anonymized_cohort_stats(uuid,text,text) to authenticated;

-- System/platform tables: callers may not write arbitrary configuration or analytics.
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings
for select using (public.is_admin());

drop policy if exists analytics_insert on public.analytics_events;
create policy analytics_insert on public.analytics_events
for insert with check (
  user_id = auth.uid()
  and char_length(trim(event)) between 1 and 100
  and jsonb_typeof(properties)='object'
  and pg_column_size(properties) <= 16384
);

-- Keep public discovery data available, but do not expose inventory for unverified
-- pharmacies through the broad legacy policy above.

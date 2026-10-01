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

-- Compatibility engine — ASSISTIVE ONLY.
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

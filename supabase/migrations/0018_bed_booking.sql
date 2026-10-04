-- 0018: independent bed booking + inpatient admission lifecycle.
create table public.hospital_beds(
 id uuid primary key default gen_random_uuid(), hospital_id uuid not null references public.hospitals(id) on delete cascade,
 ward_name text not null, bed_number text not null, category text not null check(category in('general','cabin','icu','hdu','emergency','maternity','pediatric','other')),
 status text not null default 'available' check(status in('available','reserved','occupied','maintenance','blocked')),
 citizen_visible boolean not null default true, citizen_requestable boolean not null default true, emergency_only boolean not null default false,
 notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(hospital_id,bed_number));
create index hospital_beds_hs on public.hospital_beds(hospital_id,status);
create table public.bed_requests(
 id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.profiles(id), hospital_id uuid not null references public.hospitals(id),
 category text not null check(category in('general','cabin','icu','hdu','emergency','maternity','pediatric','other')),
 requested_from timestamptz not null, requested_until timestamptz, is_emergency boolean not null default false,
 reason text not null, contact_name text not null, contact_phone text not null, patient_name_snapshot text not null,
 patient_phone_snapshot text, patient_digital_health_id text not null, status text not null default 'requested'
 check(status in('requested','reviewing','approved','admitted','rejected','cancelled','expired')),
 reviewed_by uuid references public.profiles(id), reviewed_at timestamptz, review_notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(requested_until is null or requested_until>requested_from));
create index bed_requests_hs on public.bed_requests(hospital_id,status,created_at desc);
create table public.bed_reservations(
 id uuid primary key default gen_random_uuid(), request_id uuid not null unique references public.bed_requests(id) on delete cascade,
 hospital_id uuid not null references public.hospitals(id), bed_id uuid not null references public.hospital_beds(id), patient_id uuid not null references public.profiles(id),
 reserved_from timestamptz not null, reserved_until timestamptz, status text not null default 'reserved'
 check(status in('reserved','consumed','released','cancelled','expired')), approved_by uuid not null references public.profiles(id),
 reserved_at timestamptz not null default now(), released_at timestamptz);
create unique index bed_res_active on public.bed_reservations(bed_id) where status='reserved';
create table public.admissions(
 id uuid primary key default gen_random_uuid(), hospital_id uuid not null references public.hospitals(id), bed_id uuid not null references public.hospital_beds(id),
 reservation_id uuid unique references public.bed_reservations(id), patient_id uuid not null references public.profiles(id), doctor_id uuid references public.doctors(id),
 patient_name_snapshot text not null, contact_phone text, admission_reason text not null,
 status text not null default 'admitted' check(status in('admitted','transferred','discharged','cancelled')),
 admitted_at timestamptz not null default now(), discharged_at timestamptz, discharge_notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index admissions_hs on public.admissions(hospital_id,status,admitted_at desc);
create index admissions_patient on public.admissions(patient_id,status,admitted_at desc);

create or replace function public.sync_hospital_bed_capacity() returns trigger language plpgsql security definer set search_path=public as $$
declare h uuid; total int; av int; it int; ia int;
begin h:=coalesce(new.hospital_id,old.hospital_id);
select count(*) filter(where status<>'blocked'),count(*) filter(where status='available'),
count(*) filter(where category='icu' and status<>'blocked'),count(*) filter(where category='icu' and status='available')
into total,av,it,ia from public.hospital_beds where hospital_id=h;
update public.hospitals set bed_capacity=total,beds_available=av,icu_capacity=it,icu_available=ia,updated_at=now() where id=h; return coalesce(new,old); end $$;
create trigger hospital_bed_capacity after insert or update of hospital_id,status,category or delete on public.hospital_beds for each row execute function public.sync_hospital_bed_capacity();

create or replace function public.get_public_bed_availability(p_city text default null) returns table(hospital_id uuid,hospital_name text,city text,address text,category text,total_count bigint,available_count bigint)
language sql security definer stable set search_path=public as $$
select h.id,h.name,h.city,h.address,b.category,count(*) filter(where b.status<>'blocked'),count(*) filter(where b.status='available')
from public.hospitals h join public.hospital_beds b on b.hospital_id=h.id
where h.verification='verified' and b.citizen_visible and b.citizen_requestable and (nullif(trim(p_city),'') is null or lower(h.city)=lower(trim(p_city)))
group by h.id,h.name,h.city,h.address,b.category having count(*) filter(where b.status='available')>0 order by h.name,b.category $$;

create or replace function public.request_bed(p_hospital_id uuid,p_category text,p_requested_from timestamptz,p_requested_until timestamptz default null,p_is_emergency boolean default false,p_reason text default '',p_contact_name text default '',p_contact_phone text default '')
returns public.bed_requests language plpgsql security definer set search_path=public as $$
declare p public.profiles%rowtype; h public.hospitals%rowtype; r public.bed_requests%rowtype;
begin
if auth.uid() is null or public.current_role()<>'citizen' then raise exception 'citizen authentication required'; end if;
if p_requested_from<now()-interval '5 minutes' then raise exception 'requested time is in the past'; end if;
select * into p from public.profiles where id=auth.uid(); select * into h from public.hospitals where id=p_hospital_id and verification='verified';
if not found then raise exception 'hospital unavailable'; end if;
if not exists(select 1 from public.hospital_beds where hospital_id=p_hospital_id and category=p_category and status='available' and citizen_visible and citizen_requestable and (not emergency_only or p_is_emergency)) then raise exception 'no bookable bed is currently available'; end if;
insert into public.bed_requests(patient_id,hospital_id,category,requested_from,requested_until,is_emergency,reason,contact_name,contact_phone,patient_name_snapshot,patient_phone_snapshot,patient_digital_health_id)
values(auth.uid(),p_hospital_id,p_category,p_requested_from,p_requested_until,p_is_emergency,trim(p_reason),trim(p_contact_name),trim(p_contact_phone),p.full_name,p.phone,p.digital_health_id) returning * into r;
insert into public.notifications(user_id,type,title,body,data,priority) values(h.owner_id,'bed_request','New bed request',p.full_name||' requested a '||p_category||' bed.',jsonb_build_object('bed_request_id',r.id),'high');
insert into public.audit_logs(actor_id,action,table_name,record_id,new_data) values(auth.uid(),'bed_request.created','bed_requests',r.id::text,to_jsonb(r)); return r; end $$;

create or replace function public.approve_bed_request(p_request_id uuid,p_bed_id uuid default null) returns public.bed_reservations
language plpgsql security definer set search_path=public as $$
declare r public.bed_requests%rowtype; b public.hospital_beds%rowtype; x public.bed_reservations%rowtype;
begin
select * into r from public.bed_requests where id=p_request_id for update;
if not found or not exists(select 1 from public.hospitals where id=r.hospital_id and (owner_id=auth.uid() or public.is_admin())) then raise exception 'unauthorized request'; end if;
if r.status not in('requested','reviewing') then raise exception 'request is not reviewable'; end if;
if p_bed_id is not null then select * into b from public.hospital_beds where id=p_bed_id and hospital_id=r.hospital_id for update;
else select * into b from public.hospital_beds where hospital_id=r.hospital_id and category=r.category and status='available' and citizen_requestable and (not emergency_only or r.is_emergency) order by ward_name,bed_number for update skip locked limit 1; end if;
if not found or b.status<>'available' or b.category<>r.category then raise exception 'requested bed is no longer available'; end if;
insert into public.bed_reservations(request_id,hospital_id,bed_id,patient_id,reserved_from,reserved_until,approved_by) values(r.id,r.hospital_id,b.id,r.patient_id,r.requested_from,r.requested_until,auth.uid()) returning * into x;
update public.hospital_beds set status='reserved',updated_at=now() where id=b.id;
update public.bed_requests set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=r.id;
insert into public.notifications(user_id,type,title,body,data,priority) values(r.patient_id,'bed_request.approved','Bed request approved','A bed has been reserved for your request.',jsonb_build_object('reservation_id',x.id,'bed_id',b.id),'high');
return x; end $$;

create or replace function public.cancel_bed_request(p_request_id uuid) returns public.bed_requests language plpgsql security definer set search_path=public as $$
declare r public.bed_requests%rowtype; x public.bed_reservations%rowtype;
begin select * into r from public.bed_requests where id=p_request_id and patient_id=auth.uid() for update; if not found then raise exception 'request not found'; end if;
select * into x from public.bed_reservations where request_id=r.id and status='reserved' for update;
if found then update public.hospital_beds set status='available',updated_at=now() where id=x.bed_id; update public.bed_reservations set status='cancelled',released_at=now() where id=x.id; end if;
update public.bed_requests set status='cancelled',updated_at=now() where id=r.id returning * into r; return r; end $$;

create or replace function public.admit_bed_reservation(p_reservation_id uuid) returns public.admissions language plpgsql security definer set search_path=public as $$
declare x public.bed_reservations%rowtype; r public.bed_requests%rowtype; b public.hospital_beds%rowtype; a public.admissions%rowtype;
begin
select x.* into x from public.bed_reservations x join public.hospitals h on h.id=x.hospital_id where x.id=p_reservation_id and (h.owner_id=auth.uid() or public.is_admin()) for update;
if not found or x.status<>'reserved' then raise exception 'reservation unavailable'; end if;
select * into b from public.hospital_beds where id=x.bed_id for update; select * into r from public.bed_requests where id=x.request_id;
insert into public.admissions(hospital_id,bed_id,reservation_id,patient_id,patient_name_snapshot,contact_phone,admission_reason) values(x.hospital_id,x.bed_id,x.id,x.patient_id,r.patient_name_snapshot,r.contact_phone,r.reason) returning * into a;
update public.bed_reservations set status='consumed' where id=x.id; update public.hospital_beds set status='occupied',updated_at=now() where id=b.id; update public.bed_requests set status='admitted',updated_at=now() where id=r.id;
return a; end $$;

create or replace function public.discharge_admission(p_admission_id uuid,p_discharge_notes text default null) returns public.admissions language plpgsql security definer set search_path=public as $$
declare a public.admissions%rowtype;
begin select a.* into a from public.admissions a join public.hospitals h on h.id=a.hospital_id where a.id=p_admission_id and (h.owner_id=auth.uid() or public.is_admin()) for update;
if not found or a.status<>'admitted' then raise exception 'active admission not found'; end if;
update public.hospital_beds set status='available',updated_at=now() where id=a.bed_id and status='occupied';
update public.admissions set status='discharged',discharged_at=now(),discharge_notes=nullif(trim(coalesce(p_discharge_notes,'')),''),updated_at=now() where id=a.id returning * into a; return a; end $$;

create or replace function public.create_hospital_bed(p_hospital_id uuid,p_ward_name text,p_bed_number text,p_category text,p_citizen_visible boolean default true,p_citizen_requestable boolean default true,p_emergency_only boolean default false)
returns public.hospital_beds language plpgsql security definer set search_path=public as $$
declare b public.hospital_beds%rowtype;
begin if not(public.is_admin() or exists(select 1 from public.hospitals where id=p_hospital_id and owner_id=auth.uid())) then raise exception 'unauthorized'; end if;
insert into public.hospital_beds(hospital_id,ward_name,bed_number,category,citizen_visible,citizen_requestable,emergency_only) values(p_hospital_id,trim(p_ward_name),trim(p_bed_number),p_category,p_citizen_visible,p_citizen_requestable,p_emergency_only) returning * into b; return b; end $$;

alter table public.hospital_beds enable row level security; alter table public.bed_requests enable row level security; alter table public.bed_reservations enable row level security; alter table public.admissions enable row level security;
create policy hospital_beds_read on public.hospital_beds for select using(public.is_admin() or hospital_id in(select id from public.hospitals where owner_id=auth.uid()));
create policy bed_requests_read on public.bed_requests for select using(patient_id=auth.uid() or public.is_admin() or hospital_id in(select id from public.hospitals where owner_id=auth.uid()));
create policy bed_reservations_read on public.bed_reservations for select using(patient_id=auth.uid() or public.is_admin() or hospital_id in(select id from public.hospitals where owner_id=auth.uid()));
create policy admissions_read on public.admissions for select using(patient_id=auth.uid() or public.is_admin() or hospital_id in(select id from public.hospitals where owner_id=auth.uid()));
revoke all on function public.get_public_bed_availability(text),public.request_bed(uuid,text,timestamptz,timestamptz,boolean,text,text,text),public.approve_bed_request(uuid,uuid),public.cancel_bed_request(uuid),public.admit_bed_reservation(uuid),public.discharge_admission(uuid,text),public.create_hospital_bed(uuid,text,text,text,boolean,boolean,boolean) from public,anon;
grant execute on function public.get_public_bed_availability(text),public.request_bed(uuid,text,timestamptz,timestamptz,boolean,text,text,text),public.approve_bed_request(uuid,uuid),public.cancel_bed_request(uuid),public.admit_bed_reservation(uuid),public.discharge_admission(uuid,text),public.create_hospital_bed(uuid,text,text,text,boolean,boolean,boolean) to authenticated;
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
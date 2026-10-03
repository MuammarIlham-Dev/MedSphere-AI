-- 0008_ably_notifications.sql

-- Trigger for new blood requests
create or replace function public.trg_notify_blood_request()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.notifications (user_id, type, title, body, priority, data)
    select d.profile_id, 'blood_request', 
           initcap(new.urgency::text) || ' Blood Request',
           'A patient needs ' || new.blood_group || ' blood. Urgency: ' || new.urgency || '.', 
           case when new.urgency in ('high', 'critical') then 'high' else 'normal' end,
           jsonb_build_object('request_id', new.id)
    from public.blood_donors d
    where d.blood_group = new.blood_group and d.is_eligible = true;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_blood_request on public.blood_requests;
create trigger on_blood_request
after insert on public.blood_requests
for each row execute function public.trg_notify_blood_request();

-- Trigger for appointment status changes
create or replace function public.trg_notify_appointment_status()
returns trigger as $$
begin
  if TG_OP = 'UPDATE' and old.status is distinct from new.status then
    insert into public.notifications (user_id, type, title, body, priority, data)
    values (
      new.patient_id,
      'appointment_update',
      'Appointment ' || initcap(new.status),
      'Your appointment status has changed to ' || new.status || '.',
      'normal',
      jsonb_build_object('appointment_id', new.id)
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_appointment_status_change on public.appointments;
create trigger on_appointment_status_change
after update on public.appointments
for each row execute function public.trg_notify_appointment_status();

-- Trigger for emergency status changes
create or replace function public.trg_notify_emergency_status()
returns trigger as $$
begin
  if TG_OP = 'UPDATE' and old.status is distinct from new.status then
    insert into public.notifications (user_id, type, title, body, priority, data)
    values (
      new.reporter_id,
      'emergency_update',
      'Emergency ' || initcap(new.status),
      'Emergency status updated to ' || new.status || '.',
      'high',
      jsonb_build_object('emergency_id', new.id)
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_emergency_status_change on public.emergencies;
create trigger on_emergency_status_change
after update on public.emergencies
for each row execute function public.trg_notify_emergency_status();

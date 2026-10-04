-- 0038: make auth profile bootstrap idempotent
-- A duplicate auth-user hook invocation must never create two profile rows.
-- Public signup remains citizen-only; requested professional role is non-authoritative.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested public.app_role;
  safe_request public.app_role;
begin
  begin
    requested := (new.raw_user_meta_data->>'role')::public.app_role;
  exception when others then
    requested := null;
  end;

  -- Never trust signup metadata for operational authority.
  if requested in ('admin','super_admin','emergency_responder') then
    safe_request := null;
  elsif requested is distinct from 'citizen' then
    safe_request := requested;
  else
    safe_request := null;
  end if;

  insert into public.profiles (
    id, role, requested_role, full_name, phone, digital_health_id
  )
  values (
    new.id,
    'citizen',
    safe_request,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''), '@', 1)),
    new.phone,
    'MSH-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

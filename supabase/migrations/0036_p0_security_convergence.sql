-- 0036: P0 security convergence
-- Privileged roles are administrator-provisioned. Public signup may only create citizens.
-- Professional/service role requests are retained as non-authoritative metadata for onboarding.

alter table public.profiles
  add column if not exists requested_role public.app_role;

create index if not exists profiles_requested_role_idx
  on public.profiles(requested_role)
  where requested_role is not null;

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
  );

  return new;
end;
$$;

-- Blood inventory is read-only through PostgREST. Physical inventory changes use one
-- server-authorized RPC so reservations can never be rewritten by the client.
drop policy if exists blood_inv_write on public.blood_inventory;

revoke insert, update, delete on table public.blood_inventory from authenticated, anon;

create or replace function public.set_blood_inventory(
  p_bank_id uuid,
  p_blood_group public.blood_group,
  p_units_available int
) returns public.blood_inventory
language plpgsql
security definer
set search_path = public
as $$
declare
  bank public.blood_banks%rowtype;
  row public.blood_inventory%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_bank_id is null or p_blood_group is null then
    raise exception 'bank and blood group are required';
  end if;

  if p_units_available < 0 then
    raise exception 'inventory cannot be negative';
  end if;

  select *
    into bank
  from public.blood_banks
  where id = p_bank_id
    and owner_id = auth.uid()
    and verification = 'verified'
  for update;

  if not found then
    raise exception 'verified blood bank access required';
  end if;

  select *
    into row
  from public.blood_inventory
  where bank_id = p_bank_id
    and blood_group = p_blood_group
  for update;

  if found then
    if p_units_available < row.units_reserved then
      raise exception 'available inventory cannot be below reserved inventory';
    end if;

    update public.blood_inventory
    set units_available = p_units_available,
        updated_at = now()
    where bank_id = p_bank_id
      and blood_group = p_blood_group
    returning * into row;
  else
    insert into public.blood_inventory (
      bank_id, blood_group, units_available, units_reserved, updated_at
    )
    values (
      p_bank_id, p_blood_group, p_units_available, 0, now()
    )
    returning * into row;
  end if;

  insert into public.audit_logs(
    actor_id, action, table_name, record_id, new_data
  )
  values(
    auth.uid(),
    'blood_inventory.adjusted',
    'blood_inventory',
    p_bank_id::text || ':' || p_blood_group::text,
    jsonb_build_object(
      'bank_id', p_bank_id,
      'blood_group', p_blood_group,
      'units_available', p_units_available
    )
  );

  return row;
end;
$$;

revoke all on function public.set_blood_inventory(uuid,public.blood_group,int) from public, anon;
grant execute on function public.set_blood_inventory(uuid,public.blood_group,int) to authenticated;

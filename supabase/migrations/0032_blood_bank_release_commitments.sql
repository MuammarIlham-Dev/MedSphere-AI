-- 0032_blood_bank_release_commitments.sql
-- Backfill the existing bank fulfillment RPC so fully supplied requests release
-- redundant donor commitments instead of leaving donors unnecessarily committed.

create or replace function public.fulfill_hospital_blood_request(p_request_id uuid,p_bank_id uuid,p_units int)
returns public.blood_request_fulfillments
language plpgsql security definer set search_path=public as $$
declare r public.blood_requests%rowtype; inv public.blood_inventory%rowtype; b public.blood_banks%rowtype; f public.blood_request_fulfillments%rowtype; remaining int;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_units<1 then raise exception 'units must be positive'; end if;

  select * into b from public.blood_banks where id=p_bank_id and (owner_id=auth.uid() or public.is_admin()) and (verification='verified' or public.is_admin()) for update;
  if not found then raise exception 'verified blood bank not found or unauthorized'; end if;

  select * into r from public.blood_requests where id=p_request_id for update;
  if not found or r.hospital_id is null then raise exception 'hospital blood request not found'; end if;
  if r.status not in('open','partially_fulfilled') then raise exception 'request is no longer open'; end if;

  remaining:=r.units-r.units_fulfilled;
  if p_units>remaining then raise exception 'fulfillment exceeds remaining request'; end if;

  select * into inv from public.blood_inventory where bank_id=p_bank_id and blood_group=r.blood_group for update;
  if not found then raise exception 'blood group inventory is not configured'; end if;
  if inv.units_available<p_units then raise exception 'insufficient blood inventory'; end if;
  if inv.units_available-inv.units_reserved<p_units then raise exception 'available stock is already reserved'; end if;

  update public.blood_inventory set units_available=units_available-p_units,updated_at=now()
  where bank_id=p_bank_id and blood_group=r.blood_group;

  insert into public.blood_request_fulfillments(request_id,bank_id,units,fulfilled_by)
  values(r.id,p_bank_id,p_units,auth.uid()) returning * into f;

  update public.blood_requests
  set units_fulfilled=units_fulfilled+p_units,
      status=case when units_fulfilled+p_units>=units then 'fulfilled'::request_status else 'partially_fulfilled'::request_status end
  where id=r.id returning * into r;

  IF r.status='fulfilled' THEN
    PERFORM public.release_excess_blood_broadcast_commitments(r.id);
  END IF;

  insert into public.notifications(user_id,type,title,body,data,priority)
  values(r.requester_id,'blood_request.fulfilled','Blood request fulfilled',
    'A blood bank fulfilled '||p_units||' unit(s) of your '||r.blood_group||' request.',
    jsonb_build_object('blood_request_id',r.id,'fulfillment_id',f.id,'bank_id',p_bank_id,'units',p_units),'high');

  insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
  values(auth.uid(),'blood_request.fulfilled','blood_request_fulfillments',f.id::text,
    jsonb_build_object('request_id',r.id,'bank_id',p_bank_id,'units',p_units,'request_status',r.status));
  return f;
end $$;

revoke all on function public.create_hospital_blood_request(uuid,text,blood_group,int,urgency_level,timestamptz,text),
 public.get_hospital_blood_requests(uuid),public.cancel_hospital_blood_request(uuid),
 public.get_blood_bank_hospital_requests(uuid),public.fulfill_hospital_blood_request(uuid,uuid,int) from public,anon;
grant execute on function public.create_hospital_blood_request(uuid,text,blood_group,int,urgency_level,timestamptz,text),
 public.get_hospital_blood_requests(uuid),public.cancel_hospital_blood_request(uuid),
 public.get_blood_bank_hospital_requests(uuid),public.fulfill_hospital_blood_request(uuid,uuid,int) to authenticated;


// @ts-nocheck
// Deploy: supabase functions deploy emergency-ably-event
// Secret: supabase secrets set ABLY_API_KEY=keyId:keySecret
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import Ably from 'npm:ably';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED = new Set([
  'sos_created',
  'dispatch_offered',
  'dispatch_accepted',
  'dispatch_declined',
  'dispatch_cancelled',
  'status_changed',
  'agency_dispatches_changed',
  'agency_dispatch_acknowledged',
  'agency_dispatch_declined',
  'agency_dispatch_status_changed',
  'agency_dispatch_timed_out',
  'agency_dispatch_cancelled',
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) return new Response('unauthorized', { status: 401, headers: CORS });

  const authClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  );
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return new Response('unauthorized', { status: 401, headers: CORS });

  let body: any;
  try { body = await req.json(); } catch { return new Response('invalid json', { status: 400, headers: CORS }); }

  const { action, emergencyId, dispatchId } = body ?? {};
  if (!ALLOWED.has(action) || typeof emergencyId !== 'string') {
    return new Response('invalid event', { status: 400, headers: CORS });
  }
  if (dispatchId !== undefined && typeof dispatchId !== 'string') {
    return new Response('invalid dispatch', { status: 400, headers: CORS });
  }

  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: emergency } = await service
    .from('emergencies')
    .select('id,reporter_id,type,status,city,assigned_ambulance_id,assigned_hospital_id')
    .eq('id', emergencyId)
    .single();

  if (!emergency) return new Response('not found', { status: 404, headers: CORS });

  const { data: profile } = await service
    .from('profiles')
    .select('role,city')
    .eq('id', user.id)
    .single();

  const role = profile?.role ?? 'citizen';
  let allowed = false;

  if (['admin','super_admin'].includes(role)) {
    allowed = true;
  } else if (role === 'citizen') {
    allowed = emergency.reporter_id === user.id && action === 'sos_created';
  } else if (role === 'emergency_operator') {
    allowed = (
      ['dispatch_offered','dispatch_cancelled','status_changed','agency_dispatches_changed','agency_dispatch_cancelled'].includes(action)
      && (!profile?.city || !emergency.city || profile.city === emergency.city)
    );
  } else if (role === 'ambulance_driver') {
    const { data: dispatch } = await service
      .from('emergency_dispatches')
      .select('driver_id,ambulance_id,status')
      .eq('emergency_id', emergency.id)
      .order('offered_at', { ascending:false })
      .limit(1)
      .maybeSingle();

    const { data: ownAmbulance } = dispatch?.ambulance_id
      ? await service
          .from('ambulances')
          .select('id')
          .eq('driver_id', user.id)
          .eq('id', dispatch.ambulance_id)
          .maybeSingle()
      : { data: null };

    allowed = !!ownAmbulance && !!dispatch && dispatch.driver_id === user.id && (
      action === 'dispatch_accepted' ||
      action === 'dispatch_declined' ||
      action === 'status_changed'
    );
  } else if (role === 'hospital' && emergency.assigned_hospital_id) {
    const { data: hospital } = await service
      .from('hospitals')
      .select('id')
      .eq('id', emergency.assigned_hospital_id)
      .eq('owner_id', user.id)
      .maybeSingle();
    allowed = !!hospital && action === 'status_changed';
  }

  let agencyDispatch: any = null;
  let agency: any = null;

  if (action.startsWith('agency_dispatch_') && action !== 'agency_dispatches_changed') {
    if (!dispatchId) return new Response('dispatch id required', { status: 400, headers: CORS });

    const { data: dispatch } = await service
      .from('emergency_agency_dispatches')
      .select('id,emergency_id,agency_id,assigned_member_id,status')
      .eq('id', dispatchId)
      .eq('emergency_id', emergency.id)
      .single();
    agencyDispatch = dispatch;

    if (agencyDispatch) {
      const { data: agencyRow } = await service
        .from('emergency_agencies')
        .select('id,name,agency_type,city')
        .eq('id', agencyDispatch.agency_id)
        .single();
      agency = agencyRow;
    }

    if (role === 'emergency_responder') {
      const { data: membership } = await service
        .from('emergency_agency_members')
        .select('agency_id,is_active')
        .eq('agency_id', agencyDispatch?.agency_id)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      allowed = !!membership && (
        action === 'agency_dispatch_acknowledged' ||
        action === 'agency_dispatch_declined' ||
        action === 'agency_dispatch_status_changed'
      );
    } else if (['emergency_operator','admin','super_admin'].includes(role)) {
      allowed = action !== 'agency_dispatch_acknowledged' &&
        (!profile?.city || !emergency.city || profile.city === emergency.city);
    }
  }

  if (!allowed) return new Response('forbidden', { status: 403, headers: CORS });

  const payload = {
    emergencyId: emergency.id,
    action,
    status: emergency.status,
    ambulanceId: emergency.assigned_ambulance_id,
    hospitalId: emergency.assigned_hospital_id,
    dispatchId: dispatchId ?? null,
    agencyId: agencyDispatch?.agency_id ?? null,
    agencyType: agency?.agency_type ?? null,
    agencyStatus: agencyDispatch?.status ?? null,
    at: new Date().toISOString(),
  };

  const rest = new Ably.Rest(Deno.env.get('ABLY_API_KEY')!);

  const operatorChannel = `sos:operator:${emergency.city ?? 'national'}`;
  await rest.channels.get(operatorChannel).publish('emergency:update', payload);
  await rest.channels.get(`sos:emergency:${emergency.id}`).publish('emergency:update', payload);

  if (emergency.assigned_ambulance_id) {
    await rest.channels
      .get(`sos:ambulance:${emergency.assigned_ambulance_id}`)
      .publish('emergency:update', payload);
  }

  if (action === 'agency_dispatches_changed') {
    const { data: activeDispatches } = await service
      .from('emergency_agency_dispatches')
      .select('id,agency_id,status')
      .eq('emergency_id', emergency.id)
      .in('status', ['offered','acknowledged','en_route','on_scene']);

    for (const dispatch of activeDispatches ?? []) {
      await rest.channels
        .get(`sos:agency:${dispatch.agency_id}`)
        .publish('emergency:update', {
          emergencyId: emergency.id,
          action,
          status: emergency.status,
          dispatchId: dispatch.id,
          agencyId: dispatch.agency_id,
          agencyStatus: dispatch.status,
          at: new Date().toISOString(),
        });
    }
  }

  if (agencyDispatch?.agency_id) {
    await rest.channels
      .get(`sos:agency:${agencyDispatch.agency_id}`)
      .publish('emergency:update', payload);
  }

  if (action === 'status_changed') {
    const { data: agencyDispatches } = await service
      .from('emergency_agency_dispatches')
      .select('id,agency_id,status')
      .eq('emergency_id', emergency.id)
      .in('status', ['offered','acknowledged','en_route','on_scene','cancelled']);

    const sent = new Set<string>();
    for (const dispatch of agencyDispatches ?? []) {
      if (sent.has(dispatch.agency_id)) continue;
      sent.add(dispatch.agency_id);
      await rest.channels
        .get(`sos:agency:${dispatch.agency_id}`)
        .publish('emergency:update', {
          emergencyId: emergency.id,
          action,
          status: emergency.status,
          dispatchId: dispatch.id,
          agencyId: dispatch.agency_id,
          agencyStatus: dispatch.status,
          at: new Date().toISOString(),
        });
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});

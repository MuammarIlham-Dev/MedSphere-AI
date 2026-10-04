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

  const { action, emergencyId } = body ?? {};
  if (!ALLOWED.has(action) || typeof emergencyId !== 'string') {
    return new Response('invalid event', { status: 400, headers: CORS });
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
  } else if (role === 'emergency_operator' || role === 'government') {
    allowed = action !== 'sos_created'
      ? (!profile?.city || !emergency.city || profile.city === emergency.city)
      : true;
  } else if (role === 'ambulance_driver') {
    const { data: ownAmbulance } = await service
      .from('ambulances')
      .select('id')
      .eq('driver_id', user.id)
      .eq('id', emergency.assigned_ambulance_id)
      .maybeSingle();

    const { data: dispatch } = await service
      .from('emergency_dispatches')
      .select('driver_id,ambulance_id,status')
      .eq('emergency_id', emergency.id)
      .in('status', ['offered','accepted'])
      .order('offered_at', { ascending:false })
      .limit(1)
      .maybeSingle();

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

  if (!allowed) return new Response('forbidden', { status: 403, headers: CORS });

  const payload = {
    emergencyId: emergency.id,
    action,
    status: emergency.status,
    ambulanceId: emergency.assigned_ambulance_id,
    hospitalId: emergency.assigned_hospital_id,
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

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});

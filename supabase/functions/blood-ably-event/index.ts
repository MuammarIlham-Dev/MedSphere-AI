import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import Ably from 'npm:ably';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type EventAction = 'created' | 'closed' | 'response_changed' | 'coverage_changed';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) return new Response('unauthorized', { status: 401, headers: CORS });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(
    supabaseUrl,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return new Response('unauthorized', { status: 401, headers: CORS });

  const body = await req.json().catch(() => null) as { requestId?: string; action?: EventAction } | null;
  if (!body?.requestId || !body.action) {
    return new Response('requestId and action are required', { status: 400, headers: CORS });
  }

  const { data: request } = await supabase
    .from('blood_requests')
    .select('id,hospital_id,broadcast_mode')
    .eq('id', body.requestId)
    .maybeSingle();

  if (!request?.id || !request.hospital_id) {
    return new Response('blood request not found', { status: 404, headers: CORS });
  }

  const { data: hospital } = await supabase
    .from('hospitals')
    .select('id,owner_id,city,verification')
    .eq('id', request.hospital_id)
    .maybeSingle();

  const { data: response } = await supabase
    .from('blood_broadcast_responses')
    .select('id,donor_id')
    .eq('request_id', request.id)
    .eq('donor_id', (await supabase.from('blood_donors').select('id').eq('profile_id', user.id).maybeSingle()).data?.id ?? '')
    .limit(1);

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const { data: bank } = await supabase.from('blood_banks').select('id,owner_id,city,hospital_id').eq('owner_id', user.id).maybeSingle();

  const hospitalOwner = hospital?.owner_id === user.id;
  const donorResponder = !!response?.length;
  const bankOperator = !!bank && (
    bank.hospital_id === hospital?.id ||
    (hospital?.city && bank.city
      ? hospital.city.trim().toLowerCase() === bank.city.trim().toLowerCase()
      : false)
  );
  const privileged = profile?.role === 'admin' || profile?.role === 'super_admin';

  const authorized =
    privileged ||
    (hospitalOwner && ['created','closed','response_changed','coverage_changed'].includes(body.action)) ||
    (donorResponder && body.action === 'response_changed') ||
    (bankOperator && body.action === 'coverage_changed');

  if (!authorized || hospital?.verification !== 'verified') {
    return new Response('forbidden', { status: 403, headers: CORS });
  }

  const key = Deno.env.get('ABLY_API_KEY');
  if (!key) return new Response('Ably is not configured', { status: 503, headers: CORS });

  const payload = {
    requestId: request.id,
    hospitalId: request.hospital_id,
    hospitalCity: hospital.city,
    mode: request.broadcast_mode ?? 'normal',
    action: body.action,
  };

  const rest = new Ably.Rest(key);
  const channels = ['chat:blood:hospital:' + request.hospital_id];
  if (hospital.city) channels.push('chat:blood:city:' + hospital.city.trim().toLowerCase());

  await Promise.all(
    channels.map((channel) => rest.channels.get(channel).publish('blood:broadcast', payload))
  );

  return new Response(JSON.stringify({ published: true }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});

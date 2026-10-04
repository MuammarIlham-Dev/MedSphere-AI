// @ts-nocheck
// Deploy: supabase functions deploy emergency-ably-token
// Secret: supabase secrets set ABLY_API_KEY=keyId:keySecret
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import Ably from 'npm:ably';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACTIVE = ['active','dispatched','on_scene','transporting','arrived'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) return new Response('unauthorized', { status: 401, headers: CORS });

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  );

  const { data: { user }, error: authError } = await supa.auth.getUser();
  if (authError || !user) return new Response('unauthorized', { status: 401, headers: CORS });

  const { data: profile } = await supa
    .from('profiles')
    .select('role,city')
    .eq('id', user.id)
    .single();

  const role = profile?.role ?? 'citizen';
  const capability: Record<string, string[]> = {};

  if (role === 'emergency_operator') {
    capability[`sos:operator:${profile?.city ?? 'national'}`] = ['subscribe'];
    capability['track:ambulance:*'] = ['subscribe'];
  }

  if (['admin','super_admin'].includes(role)) {
    capability['sos:operator:*'] = ['subscribe'];
    capability['track:ambulance:*'] = ['subscribe'];
  }

  if (['government'].includes(role)) {
    capability[`sos:operator:${profile?.city ?? 'national'}`] = ['subscribe'];
  }

  if (role === 'ambulance_driver') {
    const { data: ambulances } = await supa
      .from('ambulances')
      .select('id')
      .eq('driver_id', user.id);

    for (const ambulance of ambulances ?? []) {
      capability[`sos:ambulance:${ambulance.id}`] = ['subscribe'];
      capability[`track:ambulance:${ambulance.id}`] = ['publish','subscribe'];
    }
  }

  if (role === 'emergency_responder') {
    const { data: memberships } = await supa
      .from('emergency_agency_members')
      .select('agency_id, emergency_agencies!inner(is_active,verification)')
      .eq('user_id', user.id)
      .eq('is_active', true);

    for (const membership of memberships ?? []) {
      if (membership.emergency_agencies?.is_active && membership.emergency_agencies?.verification === 'verified') {
        capability[`sos:agency:${membership.agency_id}`] = ['subscribe'];
      }
    }
  }

  if (role === 'citizen') {
    const { data: emergencies } = await supa
      .from('emergencies')
      .select('id,assigned_ambulance_id')
      .eq('reporter_id', user.id)
      .in('status', ACTIVE)
      .order('created_at', { ascending: false })
      .limit(1);

    const emergency = emergencies?.[0];
    if (emergency?.id) {
      capability[`sos:emergency:${emergency.id}`] = ['subscribe'];
      if (emergency.assigned_ambulance_id) {
        capability[`track:ambulance:${emergency.assigned_ambulance_id}`] = ['subscribe'];
      }
    }
  }

  const apiKey = Deno.env.get('ABLY_API_KEY');
  if (!apiKey) return new Response('ABLY_API_KEY not configured', { status: 500, headers: CORS });

  const rest = new Ably.Rest(apiKey);
  const tokenRequest = await rest.auth.createTokenRequest({
    clientId: user.id,
    capability: JSON.stringify(capability),
    ttl: 60 * 60 * 1000,
  });

  return new Response(JSON.stringify(tokenRequest), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});

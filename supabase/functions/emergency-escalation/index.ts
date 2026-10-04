// Emergency escalation worker
// Deploy: supabase functions deploy emergency-escalation
// Secret: supabase secrets set EMERGENCY_ESCALATION_SECRET=<random-secret>
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import Ably from 'npm:ably';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const expected = Deno.env.get('EMERGENCY_ESCALATION_SECRET');
  const supplied = req.headers.get('x-emergency-escalation-secret');
  if (!expected || !supplied || supplied !== expected) {
    return new Response('unauthorized', { status: 401, headers: CORS });
  }

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const ablyKey = Deno.env.get('ABLY_API_KEY');

  if (!serviceRoleKey || !supabaseUrl || !ablyKey) {
    return new Response('required server secrets are not configured', { status: 500, headers: CORS });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const ably = new Ably.Rest(ablyKey);

  const { data: emergencies, error } = await supabase
    .from('emergencies')
    .select('id,city,status')
    .in('status', ['active','dispatched','on_scene','transporting','arrived'])
    .limit(500);

  if (error) return new Response(error.message, { status: 500, headers: CORS });

  let escalated = 0;

  for (const emergency of emergencies ?? []) {
    const { data: count, error: escalationError } = await supabase.rpc(
      'escalate_expired_emergency_agency_dispatches',
      { p_emergency_id: emergency.id },
    );

    if (escalationError) continue;
    const changed = Number(count ?? 0);
    escalated += Number.isFinite(changed) ? changed : 0;

    if (changed <= 0) continue;

    const { data: dispatches } = await supabase
      .from('emergency_agency_dispatches')
      .select('id,agency_id,status')
      .eq('emergency_id', emergency.id)
      .in('status', ['offered','acknowledged','en_route','on_scene']);

    const payload = {
      emergencyId: emergency.id,
      action: 'agency_dispatches_changed',
      status: emergency.status,
      at: new Date().toISOString(),
    };

    await ably.channels
      .get(`sos:operator:${emergency.city ?? 'national'}`)
      .publish('emergency:update', payload);

    await ably.channels
      .get(`sos:emergency:${emergency.id}`)
      .publish('emergency:update', payload);

    for (const dispatch of dispatches ?? []) {
      await ably.channels
        .get(`sos:agency:${dispatch.agency_id}`)
        .publish('emergency:update', {
          ...payload,
          dispatchId: dispatch.id,
          agencyId: dispatch.agency_id,
          agencyStatus: dispatch.status,
        });
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    processed: emergencies?.length ?? 0,
    escalated,
  }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});

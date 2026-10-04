import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import Ably from 'npm:ably';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role,city')
    .eq('id', user.id)
    .single();

  const capabilities: Record<string, string[]> = {};
  const add = (channel: string, modes: string[]) => {
    capabilities[channel] = Array.from(new Set([...(capabilities[channel] ?? []), ...modes]));
  };

  if (profile?.role === 'citizen' && profile.city) {
    add('chat:blood:city:' + profile.city.trim().toLowerCase(), ['subscribe']);
  }

  if (profile?.role === 'hospital') {
    const { data: hospital } = await supabase
      .from('hospitals')
      .select('id,city')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (hospital?.id) {
      add('chat:blood:hospital:' + hospital.id, ['subscribe']);
      if (hospital.city) add('chat:blood:city:' + hospital.city.trim().toLowerCase(), ['subscribe']);
    }
  }

  if (profile?.role === 'blood_bank') {
    const { data: bank } = await supabase
      .from('blood_banks')
      .select('id,city')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (bank?.id) {
      add('chat:blood:bank:' + bank.id, ['subscribe']);
      if (bank.city) add('chat:blood:city:' + bank.city.trim().toLowerCase(), ['subscribe']);
    }
  }

  const key = Deno.env.get('ABLY_API_KEY');
  if (!key) return new Response('Ably is not configured', { status: 503, headers: CORS });

  const rest = new Ably.Rest(key);
  const request = await rest.auth.createTokenRequest({
    clientId: user.id,
    capability: JSON.stringify(capabilities),
    ttl: 60 * 60 * 1000,
  });

  return new Response(JSON.stringify(request), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});

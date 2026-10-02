// Deploy: supabase functions deploy ably-token
// Secret: supabase secrets set ABLY_API_KEY=keyId:keySecret
// import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
// import Ably from 'https://esm.sh/ably@2.5.0';
//
// const CORS = {
//   'Access-Control-Allow-Origin': '*',
//   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
// };
//
// // Capability matrix: least-privilege per role.
// function capabilityFor(userId: string, role: string): Record<string, string[]> {
//   const base: Record<string, string[]> = {
//     [`notify:user:${userId}`]: ['subscribe'],
//     'presence:doctors': ['subscribe', 'presence'],
//     'chat:*': ['publish', 'subscribe', 'presence'],
//     'track:*': ['subscribe'],
//   };
//   if (role === 'doctor') base['presence:doctors'] = ['publish', 'subscribe', 'presence'];
//   if (role === 'citizen') base['sos:*'] = ['publish'];
//   if (['emergency_operator', 'government', 'hospital', 'admin', 'super_admin'].includes(role))
//     base['sos:*'] = ['subscribe', 'publish'];
//   if (role === 'ambulance_driver') base['track:*'] = ['publish', 'subscribe'];
//   if (['admin', 'super_admin', 'organ_authority', 'hospital'].includes(role))
//     base['notify:user:*'] = ['publish'];
//   return base;
// }
//
// serve(async (req) => {
//   if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
//   const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
//   if (!jwt) return new Response('unauthorized', { status: 401, headers: CORS });
//
//   const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
//     global: { headers: { Authorization: `Bearer ${jwt}` } },
//   });
//   const { data: { user }, error } = await supa.auth.getUser();
//   if (error || !user) return new Response('unauthorized', { status: 401, headers: CORS });
//
//   const { data: profile } = await supa.from('profiles').select('role').eq('id', user.id).single();
//   const rest = new Ably.Rest(Deno.env.get('ABLY_API_KEY')!);
//   const tokenRequest = await rest.auth.createTokenRequest({
//     clientId: user.id,
//     capability: JSON.stringify(capabilityFor(user.id, profile?.role ?? 'citizen')),
//     ttl: 60 * 60 * 1000, // 1h
//   });
//   return new Response(JSON.stringify(tokenRequest), {
//     headers: { ...CORS, 'Content-Type': 'application/json' },
//   });
// });
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";
import * as Ably from "npm:ably@2.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) throw new Error("Authentication required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const ablyKey = Deno.env.get("ABLY_API_KEY");
    if (!supabaseUrl || !anonKey || !ablyKey) throw new Error("Realtime service is not configured");

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Invalid session");

    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();
    if (profileError) throw new Error("Profile not found");

    const capability: Record<string, string[]> = {
      [`notify:user:${user.id}`]: ["subscribe"],
    };

    if (profile.role === "ambulance_driver") {
      const { data: ambulances } = await supabase.from("ambulances").select("id").eq("driver_id", user.id);
      for (const ambulance of ambulances ?? []) {
        capability[`track:ambulance:${ambulance.id}`] = ["publish", "subscribe"];
      }
    } else if (profile.role === "citizen") {
      const { data: emergencies } = await supabase.from("emergencies")
        .select("assigned_ambulance_id").eq("reporter_id", user.id)
        .not("assigned_ambulance_id", "is", null)
        .in("status", ["active", "dispatched", "on_scene", "transporting"]);
      for (const emergency of emergencies ?? []) {
        if (emergency.assigned_ambulance_id) {
          capability[`track:ambulance:${emergency.assigned_ambulance_id}`] = ["subscribe"];
        }
      }
    }

    const rest = new Ably.Rest(ablyKey);
    const tokenRequest = await rest.auth.createTokenRequest({
      clientId: user.id,
      capability: JSON.stringify(capability),
      ttl: 60 * 60 * 1000,
    });

    return new Response(JSON.stringify(tokenRequest), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Token request failed";
    return new Response(JSON.stringify({ error: message }), {
      status: message.includes("Authentication") || message.includes("session") ? 401 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

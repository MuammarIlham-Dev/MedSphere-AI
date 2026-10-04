// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const dailyApiKey = Deno.env.get("DAILY_API_KEY") ?? "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !dailyApiKey) return json({ error: "Telemedicine service is not configured" }, 500);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const appointmentId = typeof body.appointmentId === "string" ? body.appointmentId : "";
    if (!appointmentId) return json({ error: "Missing appointmentId" }, 400);

    const { data: rows, error: contextError } = await userClient.rpc("request_telemedicine_join", {
      p_appointment_id: appointmentId,
    });
    if (contextError) return json({ error: contextError.message }, 403);

    const context = rows?.[0];
    if (!context) return json({ error: "Telemedicine session unavailable" }, 403);

    const roomName = context.room_name;
    const expiresAt = new Date(context.expires_at);
    const exp = Math.max(Math.floor(Date.now() / 1000) + 60, Math.floor(expiresAt.getTime() / 1000));

    let roomUrl = context.room_url;
    if (!roomUrl) {
      let roomResponse = await fetch("https://api.daily.co/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dailyApiKey}`,
        },
        body: JSON.stringify({
          name: roomName,
          privacy: "private",
          properties: {
            exp,
            enable_chat: true,
            enable_screenshare: true,
          },
        }),
      });

      if (roomResponse.status === 400) {
        const errorBody = await roomResponse.json().catch(() => ({}));
        if (String(errorBody.info ?? "").toLowerCase().includes("already exists")) {
          roomResponse = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
            headers: { Authorization: `Bearer ${Deno.env.get("DAILY_API_KEY") ?? ""}` },
          });
        } else {
          return json({ error: "Daily room creation failed" }, 502);
        }
      }

      if (!roomResponse.ok) return json({ error: "Daily room service unavailable" }, 502);
      const room = await roomResponse.json();
      roomUrl = room.url;
      const { error: updateError } = await adminClient
        .from("telemedicine_sessions")
        .update({ room_url: roomUrl, expires_at: expiresAt.toISOString(), updated_at: new Date().toISOString() })
        .eq("id", context.session_id);
      if (updateError) return json({ error: "Could not persist telemedicine room" }, 500);
    }

    const tokenResponse = await fetch("https://api.daily.co/v1/meeting-tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("DAILY_API_KEY") ?? ""}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          is_owner: context.participant_role === "doctor",
          user_name: context.participant_name,
          user_id: user.id,
          exp,
        },
      }),
    });

    if (!tokenResponse.ok) return json({ error: "Could not issue telemedicine access token" }, 502);
    const tokenData = await tokenResponse.json();

    return json({
      sessionId: context.session_id,
      appointmentId: context.appointment_id,
      role: context.participant_role,
      participantName: context.participant_name,
      otherParticipantName: context.other_participant_name,
      scheduledAt: context.scheduled_at,
      durationMin: context.duration_min,
      expiresAt: context.expires_at,
      sessionStatus: context.session_status,
      url: roomUrl,
      token: tokenData.token,
    });
  } catch (error) {
    console.error("daily-room error", error);
    return json({ error: error instanceof Error ? error.message : "Telemedicine service failed" }, 500);
  }
});

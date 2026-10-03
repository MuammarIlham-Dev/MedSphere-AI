// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401
      });
    }

    const { appointmentId } = await req.json();
    
    const apiKey = Deno.env.get("DAILY_API_KEY");
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Daily.co API key not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    if (!appointmentId) {
      return new Response(
        JSON.stringify({ error: "Missing appointmentId" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Verify appointment ownership
    const { data: appt, error: apptErr } = await supabase
      .from('appointments')
      .select('patient_id, doctors(profile_id)')
      .eq('id', appointmentId)
      .single();

    if (apptErr || !appt) {
      return new Response(JSON.stringify({ error: "Appointment not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404
      });
    }

    if (appt.patient_id !== user.id && appt.doctors?.profile_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403
      });
    }

    // Try to create a room with the name of the appointment ID
    // If it already exists, Daily will return a 400 with 'error' = 'invalid-request-error' and 'info' = 'room already exists' (actually Daily allows GET to fetch it, but let's try POST first)
    const roomName = `medsphere-${appointmentId}`.replace(/[^a-zA-Z0-9-]/g, '-').substring(0, 40);

    let response = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        name: roomName,
        privacy: "private",
        properties: {
          exp: Math.round(Date.now() / 1000) + 86400, // Expires in 24 hours
          enable_chat: true,
          enable_screenshare: true,
        },
      }),
    });

    if (response.status === 400) {
      const errBody = await response.json();
      if (errBody.info?.includes("already exists")) {
        // Fetch the existing room
        response = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });
      } else {
        throw new Error(errBody.info || "Failed to create Daily room");
      }
    }

    if (!response.ok) {
      throw new Error("Failed to communicate with Daily.co rooms API");
    }

    const roomData = await response.json();
    
    // Generate meeting token
    // First fetch user's profile to get their name
    const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single();
    const userName = profile?.full_name || 'Participant';
    const isOwner = profile?.role === 'doctor';

    const tokenResponse = await fetch("https://api.daily.co/v1/meeting-tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          is_owner: isOwner,
          user_name: userName,
          user_id: user.id
        }
      })
    });
    
    if (!tokenResponse.ok) {
      throw new Error("Failed to generate Daily meeting token");
    }
    
    const tokenData = await tokenResponse.json();

    return new Response(JSON.stringify({ url: roomData.url, token: tokenData.token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

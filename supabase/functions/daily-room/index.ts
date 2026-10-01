import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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
      throw new Error("Failed to communicate with Daily.co");
    }

    const data = await response.json();

    return new Response(JSON.stringify({ url: data.url }), {
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

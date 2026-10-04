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
    const payload = await req.json();

    // Verify auth
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Connect to Google Cloud Healthcare API (Mock integration for production grade architecture)
    const gcpProject = Deno.env.get('GCP_PROJECT_ID');
    const location = Deno.env.get('GCP_LOCATION') || 'us-central1';
    const dataset = Deno.env.get('GCP_DATASET') || 'medsphere';
    const fhirStore = Deno.env.get('GCP_FHIR_STORE') || 'primary';
    const gcpToken = Deno.env.get('GCP_BEARER_TOKEN');

    if (gcpProject && gcpToken) {
      const gcpUrl = `https://healthcare.googleapis.com/v1/projects/${gcpProject}/locations/${location}/datasets/${dataset}/fhirStores/${fhirStore}/fhir/${payload.resourceType}`;
      
      const gcpResponse = await fetch(gcpUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${gcpToken}`,
          'Content-Type': 'application/fhir+json'
        },
        body: JSON.stringify(payload)
      });

      if (!gcpResponse.ok) {
        console.error("GCP Healthcare API error:", await gcpResponse.text());
        // For resilience, we'll continue to process locally even if GCP fails to sync
      }
    } else {
      console.log("Skipping GCP sync - missing credentials. Simulating production behavior.");
    }

    // Local Sync: Map FHIR Observation to our internal medical_records or stats
    if (payload.resourceType === 'Observation') {
      const observation = payload;
      const recordType = 'vitals';
      let description = 'Wearable vital sign recorded';
      
      if (observation.code?.coding?.[0]?.display) {
        description = observation.code.coding[0].display;
      }

      // Write to internal DB
      const { error: dbError } = await supabase.from('medical_records').insert({
        patient_id: user.id,
        record_type: recordType,
        title: description,
        description: `Value: ${observation.valueQuantity?.value} ${observation.valueQuantity?.unit || ''}`,
        file_url: null,
      });

      if (dbError) throw dbError;
    }

    return new Response(
      JSON.stringify({ success: true, message: 'FHIR payload ingested successfully' }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("FHIR Gateway error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

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
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "Laboratory document service is not configured" }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const reportId = typeof body.reportId === "string" ? body.reportId : "";
    if (!reportId) return json({ error: "Missing reportId" }, 400);

    const { data: rows, error: accessError } = await userClient.rpc("authorize_lab_report_document", {
      p_report_id: reportId,
    });
    if (accessError) return json({ error: accessError.message }, 403);

    const document = rows?.[0];
    if (!document?.bucket || !document?.path) return json({ error: "Laboratory document unavailable" }, 404);

    const { data: signed, error: signedError } = await adminClient.storage
      .from(document.bucket)
      .createSignedUrl(document.path, 300);

    if (signedError || !signed?.signedUrl) {
      console.error("lab-report-document signing error", signedError);
      return json({ error: "Could not issue laboratory document URL" }, 502);
    }

    return json({
      signedUrl: signed.signedUrl,
      expiresInSeconds: 300,
      reportId: document.report_id,
      reportCode: document.report_code,
      testName: document.test_name,
      mime: document.mime,
    });
  } catch (error) {
    console.error("lab-report-document error", error);
    return json({ error: error instanceof Error ? error.message : "Laboratory document service failed" }, 500);
  }
});

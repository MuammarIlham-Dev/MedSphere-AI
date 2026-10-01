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
    const { task, payload } = await req.json();
    const apiKey = Deno.env.get("AI_API_KEY");
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI API key not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    let systemInstruction = "";
    let userPrompt = "";

    if (task === "symptom_check") {
      systemInstruction = `You are an AI medical assistant for MedSphere AI. Your role is to provide informational symptom guidance based on user input. 
CRITICAL RULES:
1. You MUST state that you are an AI and your guidance is NOT a medical diagnosis.
2. Provide a structured response with possible causes and recommended next steps.
3. Keep it empathetic but clinical and objective.
4. Output in JSON format with fields: "guidance" (markdown string), "confidence" (High, Medium, or Low), and "disclaimer" (boolean true).`;
      userPrompt = `User is experiencing the following:
Symptoms: ${payload.symptoms}
Duration: ${payload.duration}
Severity: ${payload.severity}
Additional context: ${payload.history || 'None'}
Please provide guidance as JSON.`;
    } else if (task === "summarize_timeline") {
      systemInstruction = `You are a medical record summarizer. You take a list of chronological medical events and summarize them into a concise, easy-to-read chronological overview for a doctor.
Output in JSON format with a single field: "summary" (markdown string).`;
      userPrompt = `Please summarize the following patient history:\n${JSON.stringify(payload.records, null, 2)}`;
    } else if (task === "forecast_demand") {
      systemInstruction = `You are a healthcare logistics AI. Analyze the historical usage data and predict demand for the next 7 days.
Output in JSON format with fields: "forecast" (markdown string explaining the trend) and "confidence" (High, Medium, or Low).`;
      userPrompt = `Historical data: ${JSON.stringify(payload.history, null, 2)}\nProvide the forecast.`;
    } else if (task === "research_insights") {
      if (!Array.isArray(payload.cohort) || payload.cohort.length > 500) {
        throw new Error("A cohort array with at most 500 aggregate rows is required");
      }
      systemInstruction = `You are a public-health research assistant. Analyze only the supplied aggregate cohort rows. Never infer individual patient details or claim causation. Clearly qualify uncertainty.
Return a JSON array of at most four objects with fields: "title" (string), "summary" (string), "confidence" (integer 0-100), and "tags" (array of short strings).`;
      userPrompt = `Analyze these k-anonymous aggregate cohort rows and suggest research hypotheses:\n${JSON.stringify(payload.cohort, null, 2)}`;
    } else {
      throw new Error(`Unknown task: ${task}`);
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: { response_mime_type: "application/json" }
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("LLM Error:", err);
      throw new Error("Failed to generate AI response");
    }

    const data = await response.json();
    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textOutput) {
      throw new Error("Empty response from LLM");
    }

    return new Response(textOutput, {
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

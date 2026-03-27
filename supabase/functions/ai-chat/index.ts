import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an AI Todo Planner assistant. You help users create structured study plans, work plans, fitness plans, project roadmaps, and any goal-based plans.

When the user asks for a plan, generate a detailed, structured plan. Include:
- Day-by-day breakdown with specific tasks
- Time slots when applicable
- Topics and subtopics
- YouTube video links when relevant (for study plans)
- Priority levels (low, medium, high, urgent)
- Categories/subjects

IMPORTANT: When generating a plan, output a JSON code block with an array of tasks. Each task should have:
{
  "title": "Task title",
  "description": "Detailed description",
  "date": "YYYY-MM-DD",
  "start_time": "HH:MM",
  "end_time": "HH:MM",
  "priority": "low|medium|high|urgent",
  "category": "Subject/Category name",
  "youtube_links": ["optional urls"]
}

Wrap the JSON in a \`\`\`json code block.

Before the JSON, provide a brief summary of the plan. After the JSON, ask the user if they want to modify anything.

If the user says the plan is not correct, ask what needs to change and regenerate. Keep chatting until the user is satisfied.

For partial plans (single day, few hours), generate only the relevant tasks.
For bulk plans (60 days, monthly), generate tasks spread across the requested timeframe.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

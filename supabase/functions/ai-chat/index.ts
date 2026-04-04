import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, systemPrompt: customSystemPrompt } = await req.json();
    const HF_TOKEN = Deno.env.get("HF_TOKEN");
    if (!HF_TOKEN) throw new Error("HF_TOKEN is not configured");

    const defaultSystemPrompt = `You are an AI Todo Planner. Today is ${new Date().toISOString().split('T')[0]}.

When a user gives a plan request, think through this before generating:

1. PARSE: days, hours/day, subjects list, difficulty of each subject
2. CALCULATE tasks per day = number of subjects (each subject = 1 task per day)
   - Total tasks = days × subjects (e.g. 7 days × 5 subjects = 35 tasks)
   - Time per subject = hours / subjects, adjusted by difficulty (harder = more time)
   - Schedule subjects sequentially in the day: subject1 09:00-10:30, subject2 10:30-12:00, etc.
3. PRIORITY: days 1-30% = medium, 30-70% = high, 70-100% = urgent
4. Each task: one subject, one day, specific topic to study that day

Output ONLY a raw JSON array (no markdown prose before/after, just the array):
[
  {
    "title": "Day 1 — English: Reading Comprehension Basics",
    "description": "Cover RC passage types, skimming techniques, practice 5 passages",
    "date": "YYYY-MM-DD",
    "start_time": "HH:MM",
    "end_time": "HH:MM",
    "priority": "medium",
    "category": "English",
    "youtube_links": []
  }
]

RULES:
- Output ONLY the JSON array, nothing else, no explanation
- Every day must have exactly N tasks where N = number of subjects
- Time slots must not overlap within a day
- Harder subjects get longer slots
- Topics must progress logically day by day (basics → advanced → revision)`;

    const systemPrompt = customSystemPrompt || defaultSystemPrompt;

    const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/Meta-Llama-3-8B-Instruct:novita",
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

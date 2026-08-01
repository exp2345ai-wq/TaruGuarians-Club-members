import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Authorization: fail closed — FUNCTION_SECRET must be set and must match.
  // If the secret is absent (misconfigured deployment), reject all requests
  // rather than allowing anyone to invoke privileged automation.
  const functionSecret = Deno.env.get("FUNCTION_SECRET");
  if (!functionSecret) {
    return new Response(JSON.stringify({ error: "Function not configured: FUNCTION_SECRET missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${functionSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminUrl = `${supabaseUrl}/rest/v1/`;
    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };

    const now = new Date();
    const twoDaysAhead = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    const scheduleRes = await fetch(
      `${adminUrl}schedule?select=*&due_date=gte.${now.toISOString()}&due_date=lte.${twoDaysAhead.toISOString()}`,
      { headers }
    );
    if (!scheduleRes.ok) throw new Error(`schedule fetch failed: ${scheduleRes.status}`);
    const entries = await scheduleRes.json();

    let reminders = 0;
    for (const entry of entries) {
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const existingRes = await fetch(
        `${adminUrl}notifications?user_id=eq.${entry.member_id}&type=eq.task_reminder&created_at=gte.${since}`,
        { headers }
      );
      const existing = await existingRes.json();
      const alreadySent = existing.some((n: any) => n.message.includes(entry.topic));
      if (alreadySent) continue;

      const dueDate = new Date(entry.due_date);
      const formatted = dueDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      await fetch(`${adminUrl}notifications`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          user_id: entry.member_id,
          type: "task_reminder",
          message: `Reminder: Post on "${entry.topic}" — due ${formatted}. Don't miss it!`,
        }),
      });
      reminders++;
    }

    return new Response(JSON.stringify({ checked: entries.length, reminders }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

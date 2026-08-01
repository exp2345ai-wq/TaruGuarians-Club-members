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
    const twentyFourHoursAhead = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Check schedule entries due within 24 hours
    const scheduleRes = await fetch(
      `${adminUrl}schedule?select=*&due_date=gte.${now.toISOString()}&due_date=lte.${twentyFourHoursAhead.toISOString()}`,
      { headers }
    );
    if (!scheduleRes.ok) throw new Error(`schedule fetch failed: ${scheduleRes.status}`);
    const entries = await scheduleRes.json();

    // Check tasks due within 24 hours that are still pending
    const taskRes = await fetch(
      `${adminUrl}tasks?select=*&status=eq.pending&deadline=gte.${now.toISOString()}&deadline=lte.${twentyFourHoursAhead.toISOString()}`,
      { headers }
    );
    if (!taskRes.ok) throw new Error(`task fetch failed: ${taskRes.status}`);
    const tasks = await taskRes.json();

    let reminders = 0;

    // Send reminders for schedule entries
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
          message: `Reminder: ${entry.content_type.toUpperCase()} on "${entry.topic}" — due ${formatted}. Don't miss it!`,
        }),
      });
      reminders++;
    }

    // Send reminders for pending tasks
    for (const task of tasks) {
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const existingRes = await fetch(
        `${adminUrl}notifications?user_id=eq.${task.assigned_to}&type=eq.task_reminder&created_at=gte.${since}`,
        { headers }
      );
      const existing = await existingRes.json();
      const alreadySent = existing.some((n: any) => n.message.includes(task.topic));
      if (alreadySent) continue;

      const dueDate = new Date(task.deadline);
      const formatted = dueDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      await fetch(`${adminUrl}notifications`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          user_id: task.assigned_to,
          type: "task_reminder",
          message: `Reminder: ${task.content_type.toUpperCase()} on "${task.topic}" — due ${formatted}. Submit before deadline or AI will auto-generate!`,
        }),
      });
      reminders++;
    }

    return new Response(JSON.stringify({ checked: entries.length + tasks.length, reminders }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

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
    // 24-hour cutoff: any pending task whose deadline is within 24 hours or past
    const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    // Check both tasks AND schedule entries
    const taskRes = await fetch(
      `${adminUrl}tasks?select=*&status=eq.pending&deadline=lte.${cutoff}`,
      { headers }
    );
    if (!taskRes.ok) throw new Error(`task fetch failed: ${taskRes.status}`);
    const tasks = await taskRes.json();

    // Also check schedule entries approaching deadline
    const scheduleRes = await fetch(
      `${adminUrl}schedule?select=*&due_date=lte.${cutoff}`,
      { headers }
    );
    if (!scheduleRes.ok) throw new Error(`schedule fetch failed: ${scheduleRes.status}`);
    const scheduleEntries = await scheduleRes.json();

    // Fetch settings
    const settingsRes = await fetch(
      `${adminUrl}app_settings?select=admin_whatsapp_number,whatsapp_provider,ai_provider&id=eq.1`,
      { headers }
    );
    const settings = (await settingsRes.json())[0] || {};

    // Support separate keys for each provider
    const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? Deno.env.get("AI_API_KEY") ?? null;
    const geminiKey = Deno.env.get("GEMINI_API_KEY") ?? null;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") ?? null;

    let generated = 0;

    // Process tasks
    for (const task of tasks) {
      // Check if content already generated for this task
      const existingRes = await fetch(
        `${adminUrl}content?linked_task_id=eq.${task.id}&limit=1`,
        { headers }
      );
      const existing = await existingRes.json();
      if (existing.length > 0) continue;

      let aiContent: string;
      try {
        aiContent = await generateContent(task, settings.ai_provider, openaiKey, geminiKey, anthropicKey);
      } catch (e) {
        console.error("AI generation failed for task", task.id, e);
        continue;
      }

      const contentBody = {
        user_id: task.assigned_to,
        type: task.content_type,
        topic: task.topic,
        description: aiContent,
        ai_generated: true,
        linked_task_id: task.id,
      };
      const contentRes = await fetch(`${adminUrl}content`, {
        method: "POST",
        headers,
        body: JSON.stringify(contentBody),
      });
      const content = await contentRes.json();
      const contentId = content[0]?.id;

      await fetch(`${adminUrl}tasks?id=eq.${task.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          status: "ai_generated",
          linked_content_id: contentId ?? null,
        }),
      });

      // Notify the assigned member
      await fetch(`${adminUrl}notifications`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          user_id: task.assigned_to,
          type: "ai_fallback",
          message: `AI generated your ${task.content_type.toUpperCase()} on "${task.topic}" — Successfully generated. Please contact respective member to upload to Instagram.`,
        }),
      });

      // Send to admin WhatsApp
      if (settings.admin_whatsapp_number) {
        try {
          await sendWhatsApp(settings, task, aiContent, "task");
        } catch (e) {
          console.error("WhatsApp send failed", e);
        }
      }

      // Send to club members chat (broadcast to all members)
      await broadcastToMembers(adminUrl, headers, task, aiContent);

      generated++;
    }

    // Process schedule entries (create tasks + generate content if within 24hrs)
    for (const entry of scheduleEntries) {
      // Check if a task already exists for this schedule entry
      const existingTaskRes = await fetch(
        `${adminUrl}tasks?assigned_to=eq.${entry.member_id}&topic=eq.${entry.topic}&content_type=eq.${entry.content_type}&limit=1`,
        { headers }
      );
      const existingTasks = await existingTaskRes.json();
      if (existingTasks.length > 0) continue; // already has a task

      // Create a task from the schedule entry
      const taskBody = {
        assigned_to: entry.member_id,
        assigned_by: entry.member_id, // self-assigned from schedule
        topic: entry.topic,
        content_type: entry.content_type,
        deadline: entry.due_date,
        status: "pending",
      };
      const newTaskRes = await fetch(`${adminUrl}tasks`, {
        method: "POST",
        headers,
        body: JSON.stringify(taskBody),
      });
      const newTask = await newTaskRes.json();
      const taskId = newTask[0]?.id;
      if (!taskId) continue;

      // Generate AI content for this schedule entry
      let aiContent: string;
      try {
        aiContent = await generateContent({ ...entry, content_type: entry.content_type, topic: entry.topic }, settings.ai_provider, openaiKey, geminiKey, anthropicKey);
      } catch (e) {
        console.error("AI generation failed for schedule entry", entry.id, e);
        continue;
      }

      const contentBody = {
        user_id: entry.member_id,
        type: entry.content_type,
        topic: entry.topic,
        description: aiContent,
        ai_generated: true,
        linked_task_id: taskId,
      };
      const contentRes = await fetch(`${adminUrl}content`, {
        method: "POST",
        headers,
        body: JSON.stringify(contentBody),
      });
      const content = await contentRes.json();
      const contentId = content[0]?.id;

      await fetch(`${adminUrl}tasks?id=eq.${taskId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          status: "ai_generated",
          linked_content_id: contentId ?? null,
        }),
      });

      await fetch(`${adminUrl}notifications`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          user_id: entry.member_id,
          type: "ai_fallback",
          message: `AI generated your ${entry.content_type.toUpperCase()} on "${entry.topic}" — Successfully generated. Please contact respective member to upload to Instagram.`,
        }),
      });

      if (settings.admin_whatsapp_number) {
        try {
          await sendWhatsApp(settings, { ...entry, assigned_to: entry.member_id }, aiContent, "schedule");
        } catch (e) {
          console.error("WhatsApp send failed", e);
        }
      }

      await broadcastToMembers(adminUrl, headers, { ...entry, assigned_to: entry.member_id }, aiContent);

      generated++;
    }

    return new Response(JSON.stringify({ checked: tasks.length + scheduleEntries.length, generated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function generateContent(
  task: any,
  provider: string | null,
  openaiKey: string | null,
  geminiKey: string | null,
  anthropicKey: string | null
): Promise<string> {
  const hasKey = (provider === "openai" && openaiKey) || (provider === "gemini" && geminiKey) || (provider === "anthropic" && anthropicKey);
  if (!provider || !hasKey) {
    return (
      `[AI Fallback — Placeholder Content]\n\n` +
      `Content Type: ${task.content_type?.toUpperCase()}\n` +
      `Topic: ${task.topic}\n\n` +
      `To enable real AI generation:\n` +
      `1. Set AI_API_KEY in Supabase Edge Function Secrets\n` +
      `2. Choose your AI provider in Settings\n\n` +
      `Once configured, this will auto-generate ${task.content_type} content for "${task.topic}".`
    );
  }

  const prompt = buildPrompt(task);

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a content assistant for an elite club called TaruGuardians. Generate clear, well-structured, professional content." },
          { role: "user", content: prompt },
        ],
        max_tokens: 1200,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "[empty response]";
  }

  if (provider === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1200, temperature: 0.7 },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini error ${res.status}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "[empty response]";
  }

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text ?? "[empty response]";
  }

  return `[Unsupported provider: ${provider}]`;
}

function buildPrompt(task: any): string {
  const typeMap: Record<string, string> = {
    gd: "a group discussion (GD) script with an introduction, 4-5 key arguments with talking points, counter-arguments, and a strong conclusion. Format it clearly with headings",
    video: "a short video outline with scene-by-scene direction, including visual cues, voiceover/narration text, and estimated duration for each scene",
    post: "an engaging social media post with a strong hook, informative body, relevant hashtags, and a clear call-to-action",
  };
  return `Generate ${typeMap[task.content_type] ?? "content"} on the topic: "${task.topic}". 

This is for an elite club called TaruGuardians. The content should be professional, well-structured, and ready to use. Keep it concise but comprehensive.`;
}

async function broadcastToMembers(
  adminUrl: string,
  headers: Record<string, string>,
  task: any,
  content: string
): Promise<void> {
  // Send a message from admin to the assigned member's chat
  // Find admin profile
  const adminRes = await fetch(
    `${adminUrl}profiles?role=eq.admin&limit=1`,
    { headers }
  );
  const admins = await adminRes.json();
  if (admins.length === 0) return;
  const adminId = admins[0].id;

  const truncatedContent = content.slice(0, 1500);
  const messageText = `AI Generated Content\n\nType: ${task.content_type?.toUpperCase()}\nTopic: ${task.topic}\n\n${truncatedContent}\n\nSuccessfully generated. Please contact respective member to upload to Instagram.`;

  await fetch(`${adminUrl}messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      sender_id: adminId,
      receiver_id: task.assigned_to,
      text: messageText,
    }),
  });
}

async function sendWhatsApp(settings: any, task: any, content: string, source: string): Promise<void> {
  const provider = settings.whatsapp_provider;
  const to = settings.admin_whatsapp_number;
  const message = `AI Fallback Alert [${source.toUpperCase()}]\n\nTopic: ${task.topic}\nType: ${task.content_type?.toUpperCase()}\n\nGenerated Content:\n${content.slice(0, 1000)}\n\nSuccessfully generated. Please contact respective member to upload to Instagram.`;

  if (provider === "twilio") {
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const token = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from = Deno.env.get("TWILIO_WHATSAPP_FROM");
    if (!sid || !token || !from) throw new Error("Twilio secrets missing");
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${sid}:${token}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: from, To: `whatsapp:${to}`, Body: message }).toString(),
      }
    );
    if (!res.ok) throw new Error(`Twilio send failed ${res.status}`);
    return;
  }

  if (provider === "meta") {
    const token = Deno.env.get("META_WHATSAPP_TOKEN");
    const phoneId = Deno.env.get("META_PHONE_NUMBER_ID");
    if (!token || !phoneId) throw new Error("Meta secrets missing");
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to.replace(/\D/g, ""),
          type: "text",
          text: { body: message },
        }),
      }
    );
    if (!res.ok) throw new Error(`Meta send failed ${res.status}`);
    return;
  }

  console.log(`WhatsApp send skipped (no provider configured).`);
}

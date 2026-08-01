import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
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
    const cutoff = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();

    const taskRes = await fetch(
      `${adminUrl}tasks?select=*&status=eq.pending&deadline=lte.${cutoff}`,
      { headers }
    );
    if (!taskRes.ok) throw new Error(`task fetch failed: ${taskRes.status}`);
    const tasks = await taskRes.json();

    if (!tasks.length) {
      return new Response(JSON.stringify({ checked: 0, generated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const settingsRes = await fetch(`${adminUrl}app_settings?select=*&id=eq.1`, { headers });
    const settings = (await settingsRes.json())[0] || {};

    let generated = 0;
    for (const task of tasks) {
      let aiContent: string;
      try {
        aiContent = await generateContent(task, settings);
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

      await fetch(`${adminUrl}notifications`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          user_id: task.assigned_to,
          type: "ai_fallback",
          message: `AI generated content for "${task.topic}" because it was about to be missed.`,
        }),
      });

      if (settings.admin_whatsapp_number) {
        try {
          await sendWhatsApp(settings, task, aiContent);
        } catch (e) {
          console.error("WhatsApp send failed", e);
        }
      }

      generated++;
    }

    return new Response(JSON.stringify({ checked: tasks.length, generated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function generateContent(task: any, settings: any): Promise<string> {
  const provider = settings.ai_provider;
  const apiKey = settings.ai_api_key;
  if (!provider || !apiKey) {
    return `[AI fallback placeholder] Content type: ${task.content_type}\nTopic: ${task.topic}\n\nConfigure an AI provider in Settings to enable real generation. This is a placeholder generated because the deadline was about to be missed.`;
  }

  const prompt = buildPrompt(task);

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a content assistant for an elite club. Generate clear, structured content." },
          { role: "user", content: prompt },
        ],
        max_tokens: 800,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "[empty response]";
  }

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 800,
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
    gd: "a group discussion script with key points and arguments",
    video: "a short video outline with scene-by-scene direction",
    post: "a social media post with a hook, body, and call-to-action",
  };
  return `Generate ${typeMap[task.content_type] ?? "content"} on the topic: "${task.topic}". Keep it concise and well-structured.`;
}

async function sendWhatsApp(settings: any, task: any, content: string): Promise<void> {
  const provider = settings.whatsapp_provider;
  const to = settings.admin_whatsapp_number;
  const message = `AI Fallback Alert\n\nTask: ${task.topic}\nType: ${task.content_type}\n\nGenerated content:\n${content.slice(0, 1000)}`;

  if (provider === "twilio") {
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const token = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from = Deno.env.get("TWILIO_WHATSAPP_FROM");
    if (!sid || !token || !from) throw new Error("Twilio secrets missing");
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${sid}:${token}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: from, To: `whatsapp:${to}`, Body: message }).toString(),
    });
    if (!res.ok) throw new Error(`Twilio send failed ${res.status}`);
    return;
  }

  if (provider === "meta") {
    const token = Deno.env.get("META_WHATSAPP_TOKEN");
    const phoneId = Deno.env.get("META_PHONE_NUMBER_ID");
    if (!token || !phoneId) throw new Error("Meta secrets missing");
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/\D/g, ""),
        type: "text",
        text: { body: message },
      }),
    });
    if (!res.ok) throw new Error(`Meta send failed ${res.status}`);
    return;
  }

  console.log(`WhatsApp send skipped (no provider). Message would be:\n${message}`);
}

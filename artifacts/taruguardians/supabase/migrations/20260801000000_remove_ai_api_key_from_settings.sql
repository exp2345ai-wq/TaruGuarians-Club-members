-- Security: remove ai_api_key from the browser-readable app_settings table.
-- AI provider credentials are now stored as Supabase Edge Function Secrets
-- (Deno.env.get("AI_API_KEY")) where they are never exposed to browser clients.
ALTER TABLE public.app_settings DROP COLUMN IF EXISTS ai_api_key;

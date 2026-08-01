# TaruGuardians — Supabase Setup

This directory contains everything needed to deploy the Supabase backend for TaruGuardians.

## 1. Apply migrations (in order)

Run with the Supabase CLI:
```sh
supabase db push
```

Or apply each file in the SQL Editor in this exact order:

1. `migrations/20260730155045_create_core_schema_v2.sql` — tables, RLS, indexes (initial)
2. `migrations/20260730175029_create_core_schema_v2.sql` — idempotent re-apply (all DROP IF EXISTS)
3. `migrations/20260801000000_remove_ai_api_key_from_settings.sql` — drops `ai_api_key` column (security)
4. `migrations/20260801000001_fix_rls_and_storage.sql` — profiles INSERT, admin-only tasks, notification scope, storage path restriction per uid, signup trigger
5. `migrations/20260801000002_fix_role_immutability.sql` — DB trigger preventing non-admin role escalation

## 2. Create storage buckets

In Supabase Dashboard → Storage, create two **public** buckets:
- `avatars` — member profile photos (uploaded as `{uid}.{ext}` at bucket root)
- `content` — uploaded GDs/videos/posts (uploaded as `{uid}/{timestamp}.{ext}`)

## 3. Configure Auth

In Authentication → URL Configuration:
- Add your Replit dev URL as a **redirect URL**: `https://<your-repl>.replit.dev/**`
- Add your published production URL once deployed

Enable **Google** OAuth provider (Authentication → Providers → Google) and paste your Google Client ID/Secret.

## 4. Deploy Edge Functions

```sh
supabase functions deploy ai-fallback
supabase functions deploy schedule-reminders
```

### Required Edge Function Secrets

Set in Supabase Dashboard → Edge Functions → Secrets (or `supabase secrets set KEY value`):

| Key | Required | Description |
|-----|----------|-------------|
| `FUNCTION_SECRET` | **Yes** | A strong random token (e.g. `openssl rand -hex 32`) — required in the `Authorization: Bearer <token>` header when invoking from the cron schedule |
| `AI_API_KEY` | If using AI | Your OpenAI or Anthropic API key — **never store in the database** |
| `TWILIO_ACCOUNT_SID` | If using Twilio | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | If using Twilio | Twilio auth token |
| `TWILIO_WHATSAPP_FROM` | If using Twilio | Sender number e.g. `+14155238886` |
| `META_WHATSAPP_TOKEN` | If using Meta | Meta Cloud API access token |
| `META_PHONE_NUMBER_ID` | If using Meta | Meta phone number ID |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — do not set manually.

## 5. Schedule the functions (pg_cron)

Enable the `pg_cron` extension in Supabase Dashboard → Database → Extensions, then run:

```sql
-- Run ai-fallback every hour (include FUNCTION_SECRET as Bearer token)
SELECT cron.schedule(
  'ai-fallback-hourly',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url      := (SELECT value FROM vault.secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/ai-fallback',
      headers  := jsonb_build_object(
        'Authorization', 'Bearer ' || (SELECT value FROM vault.secrets WHERE name = 'FUNCTION_SECRET')
      )
    )
  $$
);

-- Run schedule-reminders twice daily
SELECT cron.schedule(
  'schedule-reminders',
  '0 9,21 * * *',
  $$
    SELECT net.http_post(
      url      := (SELECT value FROM vault.secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/schedule-reminders',
      headers  := jsonb_build_object(
        'Authorization', 'Bearer ' || (SELECT value FROM vault.secrets WHERE name = 'FUNCTION_SECRET')
      )
    )
  $$
);
```

## Security notes

- `ai_api_key` was removed from `app_settings` (migration 3). AI credentials live only in Edge Function Secrets.
- Both Edge Functions **fail closed**: if `FUNCTION_SECRET` is not set, all requests are rejected with HTTP 500. If set but mismatched, HTTP 401. Member JWTs cannot invoke them.
- `profiles.role` is protected by a DB trigger (migration 5) — non-admins cannot escalate their own role regardless of RLS policies.
- Storage policies scope uploads to the authenticated user's own path: avatars `{uid}.{ext}`, content `{uid}/{...}`.
- All tables have RLS enabled. Task and schedule inserts are admin-only. See migrations 4–5 for full policy list.

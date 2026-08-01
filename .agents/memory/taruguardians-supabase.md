---
name: TaruGuardians Supabase-only architecture
description: The frontend talks directly to Supabase — no custom API server routes needed for core features.
---

## Rule
All auth, profile, task, content, message, schedule, and notification data is read/written directly to Supabase from the browser. The Express api-server is unused by the current app.

## Why
The original Vercel app was purely client-rendered with Supabase as the backend. No API routes existed.

## How to apply
- Use `supabase` client from `artifacts/taruguardians/src/lib/supabase.ts` for all data ops
- Types: Profile, Task, Content, Message, ScheduleEntry, Notification — all in that same file
- Secrets needed: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (set in Replit Secrets)
- The api-server is available for future features (AI content generation, cron jobs, WhatsApp delivery — Task #3)

# TaruGuardians — Elite Club Platform

A private club management platform for managing members, tasks, content schedules, and internal communications. Admins assign content tasks; members submit GDs, videos, and posts. Built with Supabase for auth and data.

## Run & Operate

- Workflow `artifacts/taruguardians: web` — starts the Vite dev server automatically
- `pnpm run typecheck` — full typecheck across all packages
- Required secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — set in Replit Secrets

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite + Tailwind CSS v3 + React Router v6
- Auth & DB: Supabase (external — auth, profiles, tasks, content, messages, schedule)
- UI: Custom components in `src/components/` + shadcn/ui in `src/components/ui/`
- Fonts: Plus Jakarta Sans (display), Inter (sans), JetBrains Mono (mono) via Google Fonts

## Where things live

- `artifacts/taruguardians/src/App.tsx` — root router (react-router-dom v6)
- `artifacts/taruguardians/src/context/AuthContext.tsx` — Supabase auth context, session + profile
- `artifacts/taruguardians/src/lib/supabase.ts` — Supabase client + all DB types
- `artifacts/taruguardians/src/pages/` — Login, Onboarding, Dashboard, Members, Tasks, Chat, Schedule, Admin, Settings
- `artifacts/taruguardians/src/components/Layout.tsx` — shared sidebar/nav layout
- `artifacts/taruguardians/src/components/ui.tsx` — FullPageLoader, Spinner (original app UI utils)
- `artifacts/taruguardians/tailwind.config.js` — brand colors: obsidian, slatecard, gold, emerald2, crimson
- `artifacts/taruguardians/index.html` — Google Fonts links + shield.svg favicon

## Architecture decisions

- App is fully client-rendered; all data goes directly to Supabase (no custom API server in use)
- Role-based routing: `Protected` wrapper checks Supabase session; `AdminOnly` checks `profile.role === 'admin'`
- Onboarding gate: unboarded members are redirected to `/onboarding` on every protected route
- Tailwind v3 (not v4) — uses `tailwind.config.js` + `postcss.config.js`, not `@tailwindcss/vite`
- `src/components/ui.tsx` (original app FullPageLoader) coexists with `src/components/ui/` (shadcn); resolution prefers the `.tsx` file

## Product

Members log in, complete onboarding, then see their dashboard with assigned tasks and content schedule. They can submit content, chat with other members, and view the schedule. Admins can manage all members, assign tasks, view all content submissions, and access settings.

## User preferences

- User speaks informally in Hindi-English mix; keep responses concise and action-oriented
- User has ChatGPT (GPT-4) and Gemini Pro — to be used for AI content auto-generation (Task #3)

## Gotchas

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be set in Replit Secrets or the app shows a Configuration Error screen (this is intentional — the app's own error handling)
- Do NOT run `pnpm dev` at workspace root — no dev script there; use `WorkflowsRestart` with `artifacts/taruguardians: web`
- Tailwind v3: always use `tailwind.config.js` content paths `['./index.html', './src/**/*.{ts,tsx}']`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Supabase types are all in `artifacts/taruguardians/src/lib/supabase.ts`: Profile, Task, Content, Message, ScheduleEntry, Notification

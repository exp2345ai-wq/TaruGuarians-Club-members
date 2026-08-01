/*
# Create secure AI API keys table

1. New Tables
- `ai_api_keys`
  - `id` (uuid, primary key)
  - `provider` (text, unique — e.g. "openai", "gemini", "anthropic")
  - `api_key` (text, not null — the actual API key)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

2. Security
- RLS enabled on `ai_api_keys`.
- NO policies created — this means anon and authenticated roles CANNOT read or write any rows.
- Only the service role (used by edge functions) bypasses RLS and can read the keys.
- This ensures API keys are never exposed to the browser/frontend.

3. Important Notes
- The edge function (ai-fallback) reads keys from this table using the service role key.
- Frontend has zero access to this table.
- Keys are set once here and managed via the database, not env vars.
*/

CREATE TABLE IF NOT EXISTS ai_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text UNIQUE NOT NULL,
  api_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_api_keys ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  full_name text,
  photo_url text,
  location text,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_to uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('gd','video','post')),
  deadline timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','ai_generated','overdue')),
  linked_content_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- content
CREATE TABLE IF NOT EXISTS public.content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('gd','video','post')),
  topic text NOT NULL,
  description text,
  file_url text,
  ai_generated boolean NOT NULL DEFAULT false,
  linked_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- back-fill tasks.linked_content_id FK
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tasks_linked_content_id_fkey' AND table_name = 'tasks'
  ) THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_linked_content_id_fkey FOREIGN KEY (linked_content_id) REFERENCES public.content(id) ON DELETE SET NULL;
  END IF;
END $$;

-- messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  read boolean NOT NULL DEFAULT false
);

-- schedule
CREATE TABLE IF NOT EXISTS public.schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('gd','video','post')),
  due_date timestamptz NOT NULL,
  month text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('task_assigned','task_reminder','message','ai_fallback')),
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- app_settings
CREATE TABLE IF NOT EXISTS public.app_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  admin_whatsapp_number text,
  whatsapp_provider text,
  ai_provider text,
  ai_api_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- is_admin helper
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- profiles policies
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- content policies
DROP POLICY IF EXISTS "content_select_own_or_admin" ON public.content;
CREATE POLICY "content_select_own_or_admin" ON public.content FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "content_insert_own" ON public.content;
CREATE POLICY "content_insert_own" ON public.content FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "content_update_own" ON public.content;
CREATE POLICY "content_update_own" ON public.content FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "content_delete_own" ON public.content;
CREATE POLICY "content_delete_own" ON public.content FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- tasks policies
DROP POLICY IF EXISTS "tasks_select_involved_or_admin" ON public.tasks;
CREATE POLICY "tasks_select_involved_or_admin" ON public.tasks FOR SELECT TO authenticated USING (auth.uid() = assigned_to OR auth.uid() = assigned_by OR public.is_admin());
DROP POLICY IF EXISTS "tasks_insert_any" ON public.tasks;
CREATE POLICY "tasks_insert_any" ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "tasks_update_assignee_or_admin" ON public.tasks;
CREATE POLICY "tasks_update_assignee_or_admin" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() = assigned_to OR public.is_admin()) WITH CHECK (auth.uid() = assigned_to OR public.is_admin());
DROP POLICY IF EXISTS "tasks_delete_admin" ON public.tasks;
CREATE POLICY "tasks_delete_admin" ON public.tasks FOR DELETE TO authenticated USING (public.is_admin());

-- messages policies
DROP POLICY IF EXISTS "messages_select_party" ON public.messages;
CREATE POLICY "messages_select_party" ON public.messages FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
DROP POLICY IF EXISTS "messages_insert_sender" ON public.messages;
CREATE POLICY "messages_insert_sender" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS "messages_update_party" ON public.messages;
CREATE POLICY "messages_update_party" ON public.messages FOR UPDATE TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id) WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- schedule policies (STRICT privacy)
DROP POLICY IF EXISTS "schedule_select_own_or_admin" ON public.schedule;
CREATE POLICY "schedule_select_own_or_admin" ON public.schedule FOR SELECT TO authenticated USING (auth.uid() = member_id OR public.is_admin());
DROP POLICY IF EXISTS "schedule_insert_admin" ON public.schedule;
CREATE POLICY "schedule_insert_admin" ON public.schedule FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "schedule_update_admin" ON public.schedule;
CREATE POLICY "schedule_update_admin" ON public.schedule FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "schedule_delete_admin" ON public.schedule;
CREATE POLICY "schedule_delete_admin" ON public.schedule FOR DELETE TO authenticated USING (public.is_admin());

-- notifications policies
DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_insert_any" ON public.notifications;
CREATE POLICY "notif_insert_any" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_delete_own" ON public.notifications;
CREATE POLICY "notif_delete_own" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- app_settings policies
DROP POLICY IF EXISTS "settings_select_admin" ON public.app_settings;
CREATE POLICY "settings_select_admin" ON public.app_settings FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "settings_update_admin" ON public.app_settings;
CREATE POLICY "settings_update_admin" ON public.app_settings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed settings row
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "avatars_read_public" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "avatars_insert_auth" ON storage.objects;
CREATE POLICY "avatars_insert_auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
DROP POLICY IF EXISTS "avatars_update_auth" ON storage.objects;
CREATE POLICY "avatars_update_auth" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "content_read_public" ON storage.objects FOR SELECT TO public USING (bucket_id = 'content');
DROP POLICY IF EXISTS "content_insert_auth" ON storage.objects;
CREATE POLICY "content_insert_auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'content');
DROP POLICY IF EXISTS "content_update_auth" ON storage.objects;
CREATE POLICY "content_update_auth" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'content') WITH CHECK (bucket_id = 'content');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_user_id ON public.content(user_id);
CREATE INDEX IF NOT EXISTS idx_content_created_at ON public.content(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_schedule_member ON public.schedule(member_id);
CREATE INDEX IF NOT EXISTS idx_schedule_month ON public.schedule(month);
CREATE INDEX IF NOT EXISTS idx_notif_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_read ON public.notifications(read);
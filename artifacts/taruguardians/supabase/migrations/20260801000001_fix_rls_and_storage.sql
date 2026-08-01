-- ============================================================
-- Security fix migration
-- Addresses: profiles INSERT, admin-only tasks, notification
-- insert scope, storage path restriction per uid.
-- ============================================================

-- 1. profiles: allow authenticated users to INSERT their own row.
--    The AuthContext client creates the profile after OAuth if one
--    does not exist yet (loadProfile → insert). Also add a trigger
--    so the profile is auto-provisioned at signup as a fallback.
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Trigger: auto-create profile row when a new auth.users row is inserted.
-- Runs with SECURITY DEFINER so it bypasses RLS on the insert.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, photo_url, role, onboarded)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    'member',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. tasks: restrict INSERT to admins only.
--    Members should not be able to assign tasks to others or
--    forge the assigned_by field.
DROP POLICY IF EXISTS "tasks_insert_any" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_admin" ON public.tasks;
CREATE POLICY "tasks_insert_admin" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- 3. notifications: restrict client INSERT to own user_id or admin.
--    Edge functions use the service-role key and bypass RLS, so
--    system-generated notifications (ai_fallback, reminders) are
--    unaffected. This prevents any member from spamming notifications
--    to other members via the client SDK.
DROP POLICY IF EXISTS "notif_insert_any" ON public.notifications;
DROP POLICY IF EXISTS "notif_insert_own_or_admin" ON public.notifications;
CREATE POLICY "notif_insert_own_or_admin" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 4. Storage: scope uploads to the uploading user's own path prefix.
--    Avatar files are stored as  avatars/{user_id}.{ext}
--    Content files are stored as content/{user_id}/{filename}
--    Both patterns start with auth.uid()::text.

-- avatars INSERT: file name must begin with the user's own UUID
DROP POLICY IF EXISTS "avatars_insert_auth" ON storage.objects;
CREATE POLICY "avatars_insert_auth" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (name LIKE (auth.uid()::text || '.%')
         OR name LIKE (auth.uid()::text || '/%'))
  );

-- avatars UPDATE: same ownership check
DROP POLICY IF EXISTS "avatars_update_auth" ON storage.objects;
CREATE POLICY "avatars_update_auth" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (name LIKE (auth.uid()::text || '.%')
         OR name LIKE (auth.uid()::text || '/%'))
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (name LIKE (auth.uid()::text || '.%')
         OR name LIKE (auth.uid()::text || '/%'))
  );

-- content INSERT: path must start with the user's own UUID
DROP POLICY IF EXISTS "content_insert_auth" ON storage.objects;
CREATE POLICY "content_insert_auth" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'content'
    AND name LIKE (auth.uid()::text || '/%')
  );

-- content UPDATE: same
DROP POLICY IF EXISTS "content_update_auth" ON storage.objects;
CREATE POLICY "content_update_auth" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'content'
    AND name LIKE (auth.uid()::text || '/%')
  )
  WITH CHECK (
    bucket_id = 'content'
    AND name LIKE (auth.uid()::text || '/%')
  );

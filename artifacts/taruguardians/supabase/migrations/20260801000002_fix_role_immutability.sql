-- Prevent self-role escalation.
-- The profiles_update_own policy uses USING(uid=id)/WITH CHECK(uid=id)
-- which lets a member update any column including `role`.
-- This trigger fires BEFORE UPDATE on every row and rejects role changes
-- from non-admins, regardless of which RLS policy allowed the update.

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Allow if role is unchanged
  IF NEW.role = OLD.role THEN
    RETURN NEW;
  END IF;

  -- Allow if the caller is an established admin (role checked against stored DB value)
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN NEW;
  END IF;

  -- Reject all other role changes
  RAISE EXCEPTION 'Unauthorized: role changes require admin privileges';
END;
$$;

DROP TRIGGER IF EXISTS enforce_role_immutability ON public.profiles;
CREATE TRIGGER enforce_role_immutability
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

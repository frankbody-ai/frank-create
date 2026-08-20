CREATE OR REPLACE FUNCTION public.grant_access_for_verified_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  allowed text[] := ARRAY['frankbody.com', 'autosolutions.ai', 'alivebody.com.au'];
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(split_part(NEW.email, '@', 2)) = ANY (allowed) THEN
    INSERT INTO public.user_features (user_id, access_approved, updated_at)
    VALUES (NEW.id, true, now())
    ON CONFLICT (user_id) DO UPDATE
      SET access_approved = true,
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_access ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_access
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_access_for_verified_domain();

DROP TRIGGER IF EXISTS on_auth_user_confirmed_grant_access ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_grant_access
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_access_for_verified_domain();

INSERT INTO public.user_features (user_id, access_approved, updated_at)
SELECT u.id, true, now()
FROM auth.users u
WHERE u.email_confirmed_at IS NOT NULL
  AND lower(split_part(u.email, '@', 2)) IN ('frankbody.com', 'autosolutions.ai', 'alivebody.com.au')
ON CONFLICT (user_id) DO UPDATE SET access_approved = true, updated_at = now();
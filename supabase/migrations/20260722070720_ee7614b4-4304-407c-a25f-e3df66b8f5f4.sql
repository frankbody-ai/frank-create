
-- Auto-assign baseline 'user' role on signup, seed didac admins, and add admin RPCs.

-- 1) Trigger: baseline role on signup + auto-admin for seed emails
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  IF NEW.email IN ('didac@autosolutions.ai', 'didac@frankbody.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- 2) Backfill baseline user role for existing users
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'::app_role
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE r.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 3) Seed initial admins by email (if they've already signed in)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email IN ('didac@autosolutions.ai', 'didac@frankbody.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- 4) Admin-only: list users with their highest role
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  role app_role
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    COALESCE(
      (SELECT r.role FROM public.user_roles r
       WHERE r.user_id = u.id
       ORDER BY CASE r.role WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END
       LIMIT 1),
      'user'::app_role
    ) AS role
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$$;

-- 5) Admin-only: set a user's role (single-role model — replaces existing)
CREATE OR REPLACE FUNCTION public.admin_set_role(_target uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Prevent removing the last admin (or self-demotion when sole admin)
  IF _target = auth.uid() AND _role <> 'admin' THEN
    SELECT count(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
    IF admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last remaining admin';
    END IF;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _target;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target, _role);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM public;
REVOKE ALL ON FUNCTION public.admin_set_role(uuid, app_role) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, app_role) TO authenticated;

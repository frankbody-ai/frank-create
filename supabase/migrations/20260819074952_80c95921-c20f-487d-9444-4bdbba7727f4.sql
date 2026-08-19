ALTER TABLE public.user_features ADD COLUMN IF NOT EXISTS access_approved boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  require_access_approval boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app settings read" ON public.app_settings;
CREATE POLICY "app settings read" ON public.app_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "app settings admin write" ON public.app_settings;
CREATE POLICY "app settings admin write" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_set_access_approved(_target uuid, _approved boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.user_features (user_id, access_approved, updated_by, updated_at)
  VALUES (_target, _approved, auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET access_approved = EXCLUDED.access_approved,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_require_access_approval(_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.app_settings (id, require_access_approval, updated_by, updated_at)
  VALUES (1, _enabled, auth.uid(), now())
  ON CONFLICT (id) DO UPDATE
    SET require_access_approval = EXCLUDED.require_access_approval,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.my_access_state()
RETURNS TABLE(require_approval boolean, approved boolean, is_admin boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT
    COALESCE((SELECT s.require_access_approval FROM public.app_settings s WHERE s.id = 1), false),
    COALESCE((SELECT f.access_approved FROM public.user_features f WHERE f.user_id = auth.uid()), false),
    public.has_role(auth.uid(), 'admin')
$$;

DROP FUNCTION IF EXISTS public.admin_list_users();

CREATE FUNCTION public.admin_list_users()
RETURNS TABLE(id uuid, email text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, role app_role, video_enabled boolean, access_approved boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
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
    ) AS role,
    COALESCE((SELECT f.video_enabled FROM public.user_features f WHERE f.user_id = u.id), false) AS video_enabled,
    COALESCE((SELECT f.access_approved FROM public.user_features f WHERE f.user_id = u.id), false) AS access_approved
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$$;
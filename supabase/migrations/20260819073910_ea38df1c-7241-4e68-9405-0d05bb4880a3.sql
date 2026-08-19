CREATE TABLE public.user_features (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  video_enabled boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_features TO authenticated;
GRANT ALL ON public.user_features TO service_role;

ALTER TABLE public.user_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_features self or staff read" ON public.user_features
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_manager(auth.uid()));

CREATE OR REPLACE FUNCTION public.admin_set_video_access(_target uuid, _enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.user_features (user_id, video_enabled, updated_by, updated_at)
  VALUES (_target, _enabled, auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET video_enabled = EXCLUDED.video_enabled,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_list_users();

CREATE FUNCTION public.admin_list_users()
RETURNS TABLE(id uuid, email text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, role app_role, video_enabled boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    COALESCE((SELECT f.video_enabled FROM public.user_features f WHERE f.user_id = u.id), false) AS video_enabled
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$function$;

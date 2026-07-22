
-- Roles infrastructure (not yet present)
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','manager'))
$$;

CREATE POLICY "user_roles self read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_manager(auth.uid()));

-- Feedback status enum
CREATE TYPE public.feedback_status AS ENUM ('open','in_progress','done','dismissed');

-- Feedback items table
CREATE TABLE public.feedback_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  message text NOT NULL,
  page_path text,
  route_name text,
  viewport text,
  user_agent text,
  screenshot_path text,
  status public.feedback_status NOT NULL DEFAULT 'open',
  task_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback_items TO authenticated;
GRANT ALL ON public.feedback_items TO service_role;

ALTER TABLE public.feedback_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback insert authenticated" ON public.feedback_items
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "feedback select own or staff" ON public.feedback_items
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_manager(auth.uid()));

CREATE POLICY "feedback update staff" ON public.feedback_items
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_manager(auth.uid()))
  WITH CHECK (public.is_admin_or_manager(auth.uid()));

CREATE POLICY "feedback delete admin" ON public.feedback_items
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER feedback_items_set_updated_at
  BEFORE UPDATE ON public.feedback_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage policies for feedback-screenshots bucket
CREATE POLICY "feedback-screenshots upload own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "feedback-screenshots read own or staff" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'feedback-screenshots'
    AND (owner = auth.uid() OR public.is_admin_or_manager(auth.uid()))
  );

CREATE POLICY "feedback-screenshots delete admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'feedback-screenshots'
    AND public.has_role(auth.uid(), 'admin')
  );

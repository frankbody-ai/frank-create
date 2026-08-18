CREATE TABLE public.release_seen (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_release_id text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.release_seen TO authenticated;
GRANT ALL ON public.release_seen TO service_role;

ALTER TABLE public.release_seen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own release_seen" ON public.release_seen FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER release_seen_set_updated_at BEFORE UPDATE ON public.release_seen
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
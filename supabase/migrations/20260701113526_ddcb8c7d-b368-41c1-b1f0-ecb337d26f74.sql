CREATE TABLE public.asset_approval_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  user_id UUID NOT NULL,
  prev_status TEXT,
  new_status TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX asset_approval_events_asset_idx ON public.asset_approval_events(asset_id, created_at DESC);
CREATE INDEX asset_approval_events_session_idx ON public.asset_approval_events(session_id, created_at DESC);

GRANT SELECT, INSERT ON public.asset_approval_events TO authenticated;
GRANT ALL ON public.asset_approval_events TO service_role;

ALTER TABLE public.asset_approval_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own approval events read" ON public.asset_approval_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own approval events insert" ON public.asset_approval_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
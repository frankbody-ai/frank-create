CREATE TABLE public.generation_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  model_id TEXT,
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  retryable BOOLEAN NOT NULL DEFAULT false,
  http_status INTEGER,
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.generation_errors TO authenticated;
GRANT ALL ON public.generation_errors TO service_role;

ALTER TABLE public.generation_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own generation errors"
  ON public.generation_errors FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX generation_errors_user_created_idx
  ON public.generation_errors (user_id, created_at DESC);

CREATE INDEX generation_errors_code_idx
  ON public.generation_errors (code, created_at DESC);

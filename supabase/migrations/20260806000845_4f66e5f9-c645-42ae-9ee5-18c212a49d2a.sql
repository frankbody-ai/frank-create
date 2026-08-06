CREATE TABLE public.prompt_agent_config (
  id integer NOT NULL DEFAULT 1 PRIMARY KEY,
  persona text NOT NULL DEFAULT '',
  craft_method text NOT NULL DEFAULT '',
  blueprint text NOT NULL DEFAULT '',
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT prompt_agent_config_singleton CHECK (id = 1)
);

GRANT SELECT ON public.prompt_agent_config TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.prompt_agent_config TO authenticated;
GRANT ALL ON public.prompt_agent_config TO service_role;

ALTER TABLE public.prompt_agent_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompt agent config read" ON public.prompt_agent_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "prompt agent config admin write" ON public.prompt_agent_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER prompt_agent_config_set_updated_at
  BEFORE UPDATE ON public.prompt_agent_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.prompt_agent_skills (
  key text NOT NULL PRIMARY KEY,
  label text NOT NULL DEFAULT '',
  hint text NOT NULL DEFAULT '',
  instruction text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.prompt_agent_skills TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.prompt_agent_skills TO authenticated;
GRANT ALL ON public.prompt_agent_skills TO service_role;

ALTER TABLE public.prompt_agent_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompt agent skills read" ON public.prompt_agent_skills
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "prompt agent skills admin write" ON public.prompt_agent_skills
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER prompt_agent_skills_set_updated_at
  BEFORE UPDATE ON public.prompt_agent_skills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
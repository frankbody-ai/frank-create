CREATE TABLE public.prompt_chats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New chat',
  skill text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompt_chats TO authenticated;
GRANT ALL ON public.prompt_chats TO service_role;
ALTER TABLE public.prompt_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prompt chats" ON public.prompt_chats FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.prompt_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id uuid NOT NULL REFERENCES public.prompt_chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seq integer NOT NULL DEFAULT 0,
  role text NOT NULL,
  content text NOT NULL DEFAULT '',
  images_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX prompt_chat_messages_chat_idx ON public.prompt_chat_messages (chat_id, seq);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompt_chat_messages TO authenticated;
GRANT ALL ON public.prompt_chat_messages TO service_role;
ALTER TABLE public.prompt_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prompt chat messages" ON public.prompt_chat_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER prompt_chats_set_updated_at BEFORE UPDATE ON public.prompt_chats FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
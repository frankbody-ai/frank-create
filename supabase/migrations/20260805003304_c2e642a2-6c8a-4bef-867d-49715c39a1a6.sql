ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type = ANY (ARRAY['generate'::text,'edit'::text,'video'::text,'enhance'::text,'upscale'::text,'compare'::text,'generation'::text]));
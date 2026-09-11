CREATE TABLE public.talad_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id text NOT NULL,
  external_message_id text,
  driver_id text,
  direction text NOT NULL DEFAULT 'to_marketplace',
  message text,
  image_url text,
  sender_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX talad_chat_messages_ext_id_idx ON public.talad_chat_messages (external_message_id) WHERE external_message_id IS NOT NULL;
CREATE INDEX talad_chat_messages_job_idx ON public.talad_chat_messages (job_id, created_at DESC);

GRANT ALL ON public.talad_chat_messages TO service_role;
ALTER TABLE public.talad_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages talad chat messages"
ON public.talad_chat_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.talad_chat_reads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id text NOT NULL,
  job_id text NOT NULL,
  last_read_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (driver_id, job_id)
);

GRANT ALL ON public.talad_chat_reads TO service_role;
ALTER TABLE public.talad_chat_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages talad chat reads"
ON public.talad_chat_reads FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_talad_chat_reads_updated_at
BEFORE UPDATE ON public.talad_chat_reads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
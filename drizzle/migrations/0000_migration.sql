CREATE TABLE public.qtruck_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  external_ref text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.qtruck_webhook_events TO service_role;
ALTER TABLE public.qtruck_webhook_events ENABLE ROW LEVEL SECURITY;
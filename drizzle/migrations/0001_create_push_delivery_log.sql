CREATE TABLE public.push_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  notification_type text,
  reference_id text,
  title text,
  platform text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  token_removed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.push_delivery_log TO authenticated;
GRANT ALL ON public.push_delivery_log TO service_role;

ALTER TABLE public.push_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own push delivery logs"
ON public.push_delivery_log
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_push_delivery_log_user_created ON public.push_delivery_log (user_id, created_at DESC);
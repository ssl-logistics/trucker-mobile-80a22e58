CREATE TABLE public.driver_push_profiles (
  driver_id text PRIMARY KEY,
  driver_type text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.driver_push_profiles TO service_role;
ALTER TABLE public.driver_push_profiles ENABLE ROW LEVEL SECURITY;
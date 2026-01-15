-- Add unique constraint for push_subscriptions if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_user_id_endpoint_key'
  ) THEN
    ALTER TABLE public.push_subscriptions 
    ADD CONSTRAINT push_subscriptions_user_id_endpoint_key UNIQUE (user_id, endpoint);
  END IF;
END $$;

-- Drop the existing unique constraint on user_id if it exists (since we now need multiple endpoints per user)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_user_id_key'
  ) THEN
    ALTER TABLE public.push_subscriptions 
    DROP CONSTRAINT push_subscriptions_user_id_key;
  END IF;
END $$;
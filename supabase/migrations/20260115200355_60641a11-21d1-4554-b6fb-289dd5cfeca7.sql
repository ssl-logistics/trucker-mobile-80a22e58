-- Remove the foreign key constraint on push_subscriptions.user_id
-- since this app uses external authentication, not Supabase Auth

ALTER TABLE public.push_subscriptions 
DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_fkey;
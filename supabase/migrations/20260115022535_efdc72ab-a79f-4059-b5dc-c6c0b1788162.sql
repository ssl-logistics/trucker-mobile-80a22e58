-- Allow all authenticated and unauthenticated users to manage push subscriptions
-- Since this app uses custom auth (not Supabase auth), we need to allow inserts without auth.uid()

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete their own subscriptions" ON public.push_subscriptions;

-- Create permissive policies for the app's custom auth system
CREATE POLICY "Allow all push subscription operations" 
ON public.push_subscriptions 
FOR ALL 
USING (true)
WITH CHECK (true);
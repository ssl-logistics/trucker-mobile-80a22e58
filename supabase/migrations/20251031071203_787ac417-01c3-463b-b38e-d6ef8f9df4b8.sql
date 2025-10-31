-- Drop the existing policy that allows unauthenticated access
DROP POLICY IF EXISTS "Anyone can view available jobs" ON public.jobs;

-- Create new policy that requires authentication
CREATE POLICY "Authenticated users can view jobs"
ON public.jobs
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
-- Drop the old policy that requires auth.uid()
DROP POLICY IF EXISTS "Users can view jobs assigned to their role" ON public.jobs;

-- Create a new policy that allows anyone to read available jobs
CREATE POLICY "Anyone can view available jobs"
ON public.jobs
FOR SELECT
USING (status = 'available' OR status = 'open_for_bidding');
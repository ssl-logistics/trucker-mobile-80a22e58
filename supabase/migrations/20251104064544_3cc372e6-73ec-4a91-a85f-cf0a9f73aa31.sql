-- Add DELETE policy for job_applications so drivers can delete their own applications
CREATE POLICY "Drivers can delete their own applications"
ON public.job_applications
FOR DELETE
USING (auth.uid() = driver_id);
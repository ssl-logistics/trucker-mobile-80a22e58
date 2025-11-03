-- Drop existing status check constraint
ALTER TABLE public.job_applications
DROP CONSTRAINT IF EXISTS job_applications_status_check;

-- Add new status check constraint with additional values
ALTER TABLE public.job_applications
ADD CONSTRAINT job_applications_status_check
CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'cancelled'::text, 'checked_in'::text, 'sop_completed'::text]));
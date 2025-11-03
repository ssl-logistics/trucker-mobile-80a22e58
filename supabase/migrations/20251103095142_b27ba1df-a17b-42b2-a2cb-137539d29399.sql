-- Drop the existing check constraint
ALTER TABLE public.job_applications 
DROP CONSTRAINT job_applications_status_check;

-- Add the new check constraint with 'job_started' status
ALTER TABLE public.job_applications 
ADD CONSTRAINT job_applications_status_check 
CHECK (status = ANY (ARRAY[
  'pending'::text, 
  'accepted'::text, 
  'rejected'::text, 
  'checked_in'::text, 
  'sop_completed'::text,
  'job_started'::text,
  'delivery_checked_in'::text, 
  'delivery_sop_completed'::text, 
  'completed'::text
]));
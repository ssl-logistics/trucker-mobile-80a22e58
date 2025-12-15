-- Drop the old check constraint and create a new one with additional status values
ALTER TABLE public.job_applications DROP CONSTRAINT job_applications_status_check;

ALTER TABLE public.job_applications ADD CONSTRAINT job_applications_status_check 
CHECK (status = ANY (ARRAY[
  'pending'::text, 
  'accepted'::text, 
  'rejected'::text, 
  'checked_in'::text, 
  'sop_completed'::text, 
  'job_started'::text, 
  'delivery_checked_in'::text, 
  'delivery_sop_completed'::text, 
  'completed'::text, 
  'รอรับตู้เปล่า'::text,
  'waiting_container'::text,
  'container_checked_in'::text,
  'container_sop_completed'::text
]));
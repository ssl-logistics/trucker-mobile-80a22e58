-- Add new status values to job_applications status check constraint
ALTER TABLE job_applications DROP CONSTRAINT IF EXISTS job_applications_status_check;

ALTER TABLE job_applications ADD CONSTRAINT job_applications_status_check 
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
  'รอรับตู้เปล่า'::text
]));
-- Update status check constraint to include delivery statuses
ALTER TABLE job_applications 
DROP CONSTRAINT IF EXISTS job_applications_status_check;

ALTER TABLE job_applications 
ADD CONSTRAINT job_applications_status_check 
CHECK (status IN ('pending', 'accepted', 'rejected', 'checked_in', 'sop_completed', 'delivery_checked_in', 'delivery_sop_completed', 'completed'));
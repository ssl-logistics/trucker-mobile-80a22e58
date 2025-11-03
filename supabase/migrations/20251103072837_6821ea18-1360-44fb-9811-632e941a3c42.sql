-- Add delivery tracking columns to job_applications table
ALTER TABLE job_applications
ADD COLUMN IF NOT EXISTS delivery_checked_in_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS delivery_sop_completed_at timestamp with time zone;
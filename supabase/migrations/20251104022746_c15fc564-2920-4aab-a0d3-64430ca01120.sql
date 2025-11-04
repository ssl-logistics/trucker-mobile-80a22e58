-- Add container checkpoint tracking fields to job_applications
ALTER TABLE public.job_applications
ADD COLUMN container_checked_in_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN container_sop_completed_at TIMESTAMP WITH TIME ZONE;
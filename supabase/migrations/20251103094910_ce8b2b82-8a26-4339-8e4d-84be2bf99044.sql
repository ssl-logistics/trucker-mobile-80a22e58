-- Add job_started_at column to job_applications table
ALTER TABLE public.job_applications 
ADD COLUMN job_started_at timestamp with time zone;
-- Add payment and POD completion columns to job_applications
ALTER TABLE public.job_applications
ADD COLUMN payment_completed_at timestamp with time zone,
ADD COLUMN payment_method text,
ADD COLUMN pod_photo_url text;
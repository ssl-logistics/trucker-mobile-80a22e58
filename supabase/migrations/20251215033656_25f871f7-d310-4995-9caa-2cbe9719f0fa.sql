-- Add columns for return full container location and date
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS return_full_container_location text,
ADD COLUMN IF NOT EXISTS return_full_container_date date;
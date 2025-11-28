-- Add address columns for origin and destination
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS origin_address text,
ADD COLUMN IF NOT EXISTS destination_address text;
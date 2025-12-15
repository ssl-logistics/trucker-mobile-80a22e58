-- Add container_number_2 and seal_number_2 columns for second container
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS container_number_2 text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS seal_number_2 text;
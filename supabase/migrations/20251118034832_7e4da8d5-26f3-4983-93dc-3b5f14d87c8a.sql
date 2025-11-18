-- Add latitude and longitude columns to jobs table for map display
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS origin_latitude numeric,
ADD COLUMN IF NOT EXISTS origin_longitude numeric,
ADD COLUMN IF NOT EXISTS destination_latitude numeric,
ADD COLUMN IF NOT EXISTS destination_longitude numeric,
ADD COLUMN IF NOT EXISTS container_checkpoint_latitude numeric,
ADD COLUMN IF NOT EXISTS container_checkpoint_longitude numeric;

-- Add comments for clarity
COMMENT ON COLUMN public.jobs.origin_latitude IS 'Latitude coordinate for origin/pickup location';
COMMENT ON COLUMN public.jobs.origin_longitude IS 'Longitude coordinate for origin/pickup location';
COMMENT ON COLUMN public.jobs.destination_latitude IS 'Latitude coordinate for destination/delivery location';
COMMENT ON COLUMN public.jobs.destination_longitude IS 'Longitude coordinate for destination/delivery location';
COMMENT ON COLUMN public.jobs.container_checkpoint_latitude IS 'Latitude coordinate for container checkpoint location';
COMMENT ON COLUMN public.jobs.container_checkpoint_longitude IS 'Longitude coordinate for container checkpoint location';
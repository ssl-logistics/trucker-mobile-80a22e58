-- Create table for SOP photos
CREATE TABLE IF NOT EXISTS public.pickup_sop_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  photo_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pickup_sop_photos ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Drivers can insert their own SOP photos" 
ON public.pickup_sop_photos 
FOR INSERT 
WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers can view their own SOP photos" 
ON public.pickup_sop_photos 
FOR SELECT 
USING (auth.uid() = driver_id);

-- Add check-in status and timestamps to job_applications
ALTER TABLE public.job_applications
ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sop_completed_at TIMESTAMP WITH TIME ZONE;
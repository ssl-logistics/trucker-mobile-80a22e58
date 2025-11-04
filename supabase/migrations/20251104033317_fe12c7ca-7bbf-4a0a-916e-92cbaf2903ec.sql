-- Add photo_type column to pickup_sop_photos table
ALTER TABLE public.pickup_sop_photos 
ADD COLUMN IF NOT EXISTS photo_type text NOT NULL DEFAULT 'pickup';
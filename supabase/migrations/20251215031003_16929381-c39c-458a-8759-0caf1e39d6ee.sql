-- Add shipper_load column to jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS shipper_load text;
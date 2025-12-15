-- Add tax_id column to jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS tax_id text;
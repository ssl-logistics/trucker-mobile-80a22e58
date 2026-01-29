-- Change job_id column from UUID to TEXT to support external order codes
ALTER TABLE public.expenses 
ALTER COLUMN job_id TYPE TEXT USING job_id::TEXT;
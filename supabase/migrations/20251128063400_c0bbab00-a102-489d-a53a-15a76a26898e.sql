-- Add company name columns for origin and destination points
ALTER TABLE public.jobs 
ADD COLUMN origin_company_name text,
ADD COLUMN destination_company_name text;
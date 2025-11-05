-- Create expenses table
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  expense_type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  receipt_photo_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Drivers can view their own expenses"
ON public.expenses
FOR SELECT
USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can insert their own expenses"
ON public.expenses
FOR INSERT
WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers can update their own expenses"
ON public.expenses
FOR UPDATE
USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can delete their own expenses"
ON public.expenses
FOR DELETE
USING (auth.uid() = driver_id);

-- Create storage bucket for expense receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', true);

-- Create storage policies for expense receipts
CREATE POLICY "Anyone can view expense receipts"
ON storage.objects
FOR SELECT
USING (bucket_id = 'expense-receipts');

CREATE POLICY "Drivers can upload their own expense receipts"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'expense-receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Drivers can update their own expense receipts"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'expense-receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Drivers can delete their own expense receipts"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'expense-receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
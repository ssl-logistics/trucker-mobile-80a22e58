-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload their own expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own expense receipts" ON storage.objects;

-- Create more permissive policies for expense-receipts bucket
-- Since this app uses custom auth (not Supabase Auth), we allow based on bucket_id

-- Allow anyone to upload to expense-receipts bucket
CREATE POLICY "Allow upload to expense-receipts"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'expense-receipts');

-- Allow anyone to view expense-receipts
CREATE POLICY "Allow view expense-receipts"
ON storage.objects
FOR SELECT
USING (bucket_id = 'expense-receipts');

-- Allow anyone to update expense-receipts
CREATE POLICY "Allow update expense-receipts"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'expense-receipts');

-- Allow anyone to delete expense-receipts
CREATE POLICY "Allow delete expense-receipts"
ON storage.objects
FOR DELETE
USING (bucket_id = 'expense-receipts');
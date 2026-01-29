-- Create storage policies for expense-receipts bucket
-- Allow authenticated users to upload their own expense receipts
CREATE POLICY "Users can upload their own expense receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'expense-receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to view their own expense receipts
CREATE POLICY "Users can view their own expense receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'expense-receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own expense receipts
CREATE POLICY "Users can update their own expense receipts"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'expense-receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to delete their own expense receipts
CREATE POLICY "Users can delete their own expense receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'expense-receipts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
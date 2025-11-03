-- Create storage policies for POD document uploads
CREATE POLICY "Users can upload their POD documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'driver-documents' 
  AND (storage.foldername(name))[1] = 'pod-documents'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

CREATE POLICY "Users can view their POD documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver-documents' 
  AND (storage.foldername(name))[1] = 'pod-documents'
  AND auth.uid()::text = (storage.foldername(name))[2]
);
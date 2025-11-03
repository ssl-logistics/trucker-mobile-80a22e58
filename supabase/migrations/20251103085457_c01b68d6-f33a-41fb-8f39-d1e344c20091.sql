-- Drop old policies
DROP POLICY IF EXISTS "Users can upload their POD documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their POD documents" ON storage.objects;

-- Create corrected storage policies for POD document uploads
-- The file path is: pod-documents/{user_id}-{job_id}-{timestamp}.ext
CREATE POLICY "Users can upload their POD documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'driver-documents' 
  AND (storage.foldername(name))[1] = 'pod-documents'
  AND (storage.filename(name)) LIKE auth.uid()::text || '-%'
);

CREATE POLICY "Users can view their POD documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver-documents' 
  AND (storage.foldername(name))[1] = 'pod-documents'
  AND (storage.filename(name)) LIKE auth.uid()::text || '-%'
);
-- Drop existing POD policies
DROP POLICY IF EXISTS "Users can upload their POD documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their POD documents" ON storage.objects;

-- Create new POD policies that allow any authenticated or anonymous user
CREATE POLICY "Anyone can upload POD documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'driver-documents' 
  AND (storage.foldername(name))[1] = 'pod-documents'
);

CREATE POLICY "Anyone can view POD documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'driver-documents' 
  AND (storage.foldername(name))[1] = 'pod-documents'
);

CREATE POLICY "Anyone can update POD documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'driver-documents' 
  AND (storage.foldername(name))[1] = 'pod-documents'
);
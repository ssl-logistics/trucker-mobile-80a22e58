-- Update driver-documents bucket to be public so POD photos can be displayed
UPDATE storage.buckets 
SET public = true 
WHERE id = 'driver-documents';
-- Create storage bucket for pickup SOP photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('pickup_sop_photos', 'pickup_sop_photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for pickup_sop_photos bucket
CREATE POLICY "Anyone can view pickup SOP photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'pickup_sop_photos');

CREATE POLICY "Authenticated users can upload pickup SOP photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'pickup_sop_photos' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their own pickup SOP photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'pickup_sop_photos' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their own pickup SOP photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'pickup_sop_photos' 
  AND auth.uid() IS NOT NULL
);
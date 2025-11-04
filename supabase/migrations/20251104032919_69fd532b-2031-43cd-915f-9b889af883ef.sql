-- Create storage bucket for pickup SOP photos if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('pickup_sop_photos', 'pickup_sop_photos', true)
ON CONFLICT (id) DO NOTHING;
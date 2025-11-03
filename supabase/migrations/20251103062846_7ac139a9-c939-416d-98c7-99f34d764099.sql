-- Create driver work preferences table
CREATE TABLE public.driver_work_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_areas TEXT[] NOT NULL DEFAULT '{}',
  price_range_min NUMERIC,
  price_range_max NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(driver_id)
);

-- Create vehicles table
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plate_number TEXT NOT NULL,
  plate_province TEXT NOT NULL,
  vehicle_brand TEXT NOT NULL,
  vehicle_color TEXT NOT NULL,
  vin TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  fuel_type TEXT NOT NULL,
  load_capacity NUMERIC NOT NULL,
  width NUMERIC,
  length NUMERIC,
  height NUMERIC,
  container_types TEXT[] DEFAULT '{}',
  has_trailer BOOLEAN DEFAULT false,
  trailer_plate_number TEXT,
  trailer_plate_province TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vehicle photos table
CREATE TABLE public.vehicle_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  photo_type TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create driver documents table
CREATE TABLE public.driver_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_url TEXT NOT NULL,
  insurance_value NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.driver_work_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for driver_work_preferences
CREATE POLICY "Users can view their own work preferences"
ON public.driver_work_preferences FOR SELECT
USING (auth.uid() = driver_id);

CREATE POLICY "Users can insert their own work preferences"
ON public.driver_work_preferences FOR INSERT
WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Users can update their own work preferences"
ON public.driver_work_preferences FOR UPDATE
USING (auth.uid() = driver_id);

-- RLS Policies for vehicles
CREATE POLICY "Users can view their own vehicles"
ON public.vehicles FOR SELECT
USING (auth.uid() = driver_id);

CREATE POLICY "Users can insert their own vehicles"
ON public.vehicles FOR INSERT
WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Users can update their own vehicles"
ON public.vehicles FOR UPDATE
USING (auth.uid() = driver_id);

-- RLS Policies for vehicle_photos
CREATE POLICY "Users can view their vehicle photos"
ON public.vehicle_photos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.vehicles
    WHERE vehicles.id = vehicle_photos.vehicle_id
    AND vehicles.driver_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their vehicle photos"
ON public.vehicle_photos FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vehicles
    WHERE vehicles.id = vehicle_photos.vehicle_id
    AND vehicles.driver_id = auth.uid()
  )
);

-- RLS Policies for driver_documents
CREATE POLICY "Users can view their own documents"
ON public.driver_documents FOR SELECT
USING (auth.uid() = driver_id);

CREATE POLICY "Users can insert their own documents"
ON public.driver_documents FOR INSERT
WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Users can update their own documents"
ON public.driver_documents FOR UPDATE
USING (auth.uid() = driver_id);

-- Add update triggers
CREATE TRIGGER update_driver_work_preferences_updated_at
BEFORE UPDATE ON public.driver_work_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at
BEFORE UPDATE ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_driver_documents_updated_at
BEFORE UPDATE ON public.driver_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-photos', 'vehicle-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-documents', 'driver-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for vehicle-photos
CREATE POLICY "Vehicle photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'vehicle-photos');

CREATE POLICY "Users can upload their vehicle photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'vehicle-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their vehicle photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'vehicle-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their vehicle photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'vehicle-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policies for driver-documents (private)
CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'driver-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'driver-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'driver-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'driver-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
-- Create profiles table for storing driver information
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Create jobs table
CREATE TABLE public.jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_code TEXT NOT NULL UNIQUE,
  job_type TEXT NOT NULL CHECK (job_type IN ('งานด่วน', 'งานรายวัน', 'งานสัญญาจ้าง')),
  employer_name TEXT NOT NULL,
  transport_type TEXT NOT NULL CHECK (transport_type IN ('ขนส่งเที่ยวเดียว', 'ขนส่งหลายที่', 'ขนส่งขาเข้า', 'ขนส่งขาออก')),
  origin_location TEXT NOT NULL,
  destination_location TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  start_date DATE NOT NULL,
  start_time TIME NOT NULL,
  equipment_list TEXT,
  safety_equipment TEXT,
  province TEXT,
  district TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Policies for jobs (drivers can view all available jobs)
CREATE POLICY "Anyone can view available jobs" 
ON public.jobs 
FOR SELECT 
USING (status = 'available' OR auth.uid() IS NOT NULL);

-- Create job_applications table
CREATE TABLE public.job_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_id, driver_id)
);

-- Enable RLS
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Policies for job_applications
CREATE POLICY "Drivers can view their own applications" 
ON public.job_applications 
FOR SELECT 
USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can create their own applications" 
ON public.job_applications 
FOR INSERT 
WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers can update their own applications" 
ON public.job_applications 
FOR UPDATE 
USING (auth.uid() = driver_id);

-- Create trigger for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at
BEFORE UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample jobs for testing
INSERT INTO public.jobs (order_code, job_type, employer_name, transport_type, origin_location, destination_location, price, start_date, start_time, equipment_list, safety_equipment, province, district)
VALUES 
  ('ORO0001', 'งานด่วน', 'ไอเดียพลัส จำกัดมหาชน', 'ขนส่งเที่ยวเดียว', 'ท่าเรือกรุงเทพ', 'คลังสินค้าท่าเรือแหลมฉบัง', 5000, '2025-11-29', '10:00', 'อุปกรณ์ติดรถ : น้ำมัน, รถเข็น, กล่องบรรจุ', '-', 'กรุงเทพมหานคร', 'บางรัก'),
  ('ORO0002', 'งานรายวัน', 'ไทยพีเอ็ม มาร์เตอร์ จำกัด', 'ขนส่งหลายที่', 'ท่าเรือกรุงเทพ', 'คลังสินค้าหลายแห่ง', 8000, '2025-11-29', '12:00', 'อุปกรณ์ติดรถ : น้ำมัน, รถเข็น', 'ถุงมือ, รองเท้านิรภัย', 'กรุงเทพมหานคร', 'บางรัก');
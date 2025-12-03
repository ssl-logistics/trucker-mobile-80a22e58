-- Create job_destinations table for multiple delivery points
CREATE TABLE public.job_destinations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL DEFAULT 1,
  company_name TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  address TEXT,
  province TEXT,
  district TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  delivery_date DATE,
  delivery_time TIME,
  notes TEXT,
  checked_in_at TIMESTAMP WITH TIME ZONE,
  sop_completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_id, sequence_number)
);

-- Enable Row Level Security
ALTER TABLE public.job_destinations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can view destinations for jobs they can see
CREATE POLICY "Users can view job destinations"
ON public.job_destinations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.jobs 
    WHERE jobs.id = job_destinations.job_id 
    AND (jobs.assigned_role IS NULL OR jobs.assigned_role = get_user_role(auth.uid()))
  )
);

-- Service role can manage destinations (for edge functions)
CREATE POLICY "Service can manage job destinations"
ON public.job_destinations
FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_job_destinations_updated_at
BEFORE UPDATE ON public.job_destinations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster queries
CREATE INDEX idx_job_destinations_job_id ON public.job_destinations(job_id);

-- Enable realtime for job_destinations
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_destinations;
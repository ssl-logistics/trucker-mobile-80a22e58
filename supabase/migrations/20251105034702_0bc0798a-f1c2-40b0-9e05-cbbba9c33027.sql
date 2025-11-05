-- Create job_bids table for bidding functionality
CREATE TABLE IF NOT EXISTS public.job_bids (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bid_amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.job_bids ENABLE ROW LEVEL SECURITY;

-- Create policies for job_bids
CREATE POLICY "Drivers can view their own bids"
  ON public.job_bids
  FOR SELECT
  USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can create their own bids"
  ON public.job_bids
  FOR INSERT
  WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers can update their own bids"
  ON public.job_bids
  FOR UPDATE
  USING (auth.uid() = driver_id);

-- Create index for better query performance
CREATE INDEX idx_job_bids_driver_id ON public.job_bids(driver_id);
CREATE INDEX idx_job_bids_job_id ON public.job_bids(job_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_job_bids_updated_at
  BEFORE UPDATE ON public.job_bids
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

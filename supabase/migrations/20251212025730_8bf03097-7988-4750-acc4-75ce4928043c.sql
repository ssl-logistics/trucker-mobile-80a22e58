-- Drop old check constraint and add new one with open_for_bidding status
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;

-- Add new check constraint that includes open_for_bidding
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check 
CHECK (status IN ('available', 'assigned', 'in_progress', 'completed', 'cancelled', 'open_for_bidding'));
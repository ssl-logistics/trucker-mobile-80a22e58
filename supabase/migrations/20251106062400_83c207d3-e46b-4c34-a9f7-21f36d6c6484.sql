-- Add file_url, file_name, and file_size columns to messages table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'file_url') THEN
    ALTER TABLE messages ADD COLUMN file_url TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'file_name') THEN
    ALTER TABLE messages ADD COLUMN file_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'file_size') THEN
    ALTER TABLE messages ADD COLUMN file_size INTEGER;
  END IF;
END $$;
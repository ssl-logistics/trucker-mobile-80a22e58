-- Add file-related columns to external_chat_messages table
ALTER TABLE external_chat_messages 
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';

-- Add index for better performance when querying by message type
CREATE INDEX IF NOT EXISTS idx_external_chat_messages_type ON external_chat_messages(message_type);
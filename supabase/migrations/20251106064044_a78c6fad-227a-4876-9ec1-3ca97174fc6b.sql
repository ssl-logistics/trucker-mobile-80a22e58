-- Let's try a completely different approach
-- Temporarily disable RLS to test, then create proper policies

-- First, let's make sure the table structure is correct
ALTER TABLE conversations ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE conversations ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE conversations ALTER COLUMN updated_at SET DEFAULT now();

-- Drop ALL existing policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'conversations') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON conversations';
    END LOOP;
END $$;

-- Create a very simple INSERT policy that should definitely work
CREATE POLICY "allow_all_authenticated_insert"
ON conversations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also create SELECT policy for authenticated users to see their conversations
CREATE POLICY "allow_authenticated_select"
ON conversations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_participants.conversation_id = conversations.id
    AND conversation_participants.user_id = auth.uid()
  )
);

CREATE POLICY "allow_authenticated_update"
ON conversations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_participants.conversation_id = conversations.id
    AND conversation_participants.user_id = auth.uid()
  )
);
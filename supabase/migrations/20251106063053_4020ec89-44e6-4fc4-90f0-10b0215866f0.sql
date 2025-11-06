-- First, let's see what policies exist and recreate them properly
-- Drop all existing policies for conversations
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'conversations') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON conversations';
    END LOOP;
END $$;

-- Drop all existing policies for conversation_participants  
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'conversation_participants') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON conversation_participants';
    END LOOP;
END $$;

-- Create simple and clear policies for conversations
CREATE POLICY "allow_authenticated_insert_conversations"
ON conversations
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "allow_participants_select_conversations"
ON conversations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_participants.conversation_id = conversations.id
    AND conversation_participants.user_id = auth.uid()
  )
);

CREATE POLICY "allow_participants_update_conversations"
ON conversations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_participants.conversation_id = conversations.id
    AND conversation_participants.user_id = auth.uid()
  )
);

-- Create simple policies for conversation_participants
CREATE POLICY "allow_authenticated_insert_participants"
ON conversation_participants
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "allow_users_select_own_participants"
ON conversation_participants
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "allow_users_update_own_participants"
ON conversation_participants
FOR UPDATE
USING (user_id = auth.uid());
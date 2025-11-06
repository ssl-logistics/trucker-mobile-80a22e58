-- Drop existing create conversation policy
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;

-- Create new policy that allows authenticated users to create conversations
CREATE POLICY "Authenticated users can create conversations"
ON conversations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Ensure conversation_participants policies are correct
DROP POLICY IF EXISTS "Users can join conversations" ON conversation_participants;

CREATE POLICY "Authenticated users can join conversations" 
ON conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (true);
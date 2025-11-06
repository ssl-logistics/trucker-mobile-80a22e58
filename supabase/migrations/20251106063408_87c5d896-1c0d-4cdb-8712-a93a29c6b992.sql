-- Check if RLS is enabled and fix the INSERT policy
-- First, ensure RLS is enabled
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;

-- Drop and recreate the INSERT policy with a simpler approach
DROP POLICY IF EXISTS "allow_authenticated_insert_conversations" ON conversations;

-- Create a more permissive policy for INSERT that explicitly allows authenticated users
CREATE POLICY "authenticated_users_can_insert_conversations"
ON conversations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also ensure the participants policy is correct
DROP POLICY IF EXISTS "allow_authenticated_insert_participants" ON conversation_participants;

CREATE POLICY "authenticated_users_can_insert_participants"
ON conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (true);
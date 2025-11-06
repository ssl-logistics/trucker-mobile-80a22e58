-- Fix the policy syntax properly
-- The issue is we need PERMISSIVE policy without TO clause for it to work correctly

-- Drop existing policies
DROP POLICY IF EXISTS "authenticated_users_can_insert_conversations" ON conversations;
DROP POLICY IF EXISTS "authenticated_users_can_insert_participants" ON conversation_participants;

-- Create proper INSERT policies
CREATE POLICY "authenticated_users_can_insert_conversations"
ON conversations
AS PERMISSIVE
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_users_can_insert_participants"
ON conversation_participants
AS PERMISSIVE
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Verify policies are working by granting proper permissions
GRANT INSERT ON conversations TO authenticated;
GRANT INSERT ON conversation_participants TO authenticated;
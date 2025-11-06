-- Fix infinite recursion in conversation_participants RLS policy
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON conversation_participants;

CREATE POLICY "Users can view participants in their conversations"
ON conversation_participants
FOR SELECT
USING (user_id = auth.uid());

-- Add policy to allow users to see other participants in the same conversation
CREATE POLICY "Users can view other participants in their conversations"
ON conversation_participants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = conversation_participants.conversation_id
    AND cp.user_id = auth.uid()
  )
);

-- Update profiles RLS to allow users to see other users for chat
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

CREATE POLICY "Users can view all profiles"
ON profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);
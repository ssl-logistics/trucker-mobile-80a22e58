-- Add DELETE policy for conversation_participants
-- Allow users to remove themselves from conversations (leave conversation)
CREATE POLICY "allow_users_delete_own_participants"
ON conversation_participants
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
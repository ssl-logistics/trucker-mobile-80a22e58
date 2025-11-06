-- Drop all existing policies on conversation_participants
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON conversation_participants;
DROP POLICY IF EXISTS "Users can view other participants in their conversations" ON conversation_participants;
DROP POLICY IF EXISTS "Users can join conversations" ON conversation_participants;
DROP POLICY IF EXISTS "Users can update their own participant record" ON conversation_participants;

-- Create simple policies without recursion
CREATE POLICY "Users can view their own participant records"
ON conversation_participants
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can join conversations" 
ON conversation_participants
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their own participant record"
ON conversation_participants
FOR UPDATE
USING (user_id = auth.uid());
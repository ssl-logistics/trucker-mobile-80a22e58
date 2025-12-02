-- Allow authenticated users to read external user mappings for chat functionality
DROP POLICY IF EXISTS "Users can view their own external mappings" ON external_user_mapping;

CREATE POLICY "Authenticated users can view external mappings"
ON external_user_mapping
FOR SELECT
TO authenticated
USING (true);
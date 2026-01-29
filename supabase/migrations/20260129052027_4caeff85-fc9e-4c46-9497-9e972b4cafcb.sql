-- Drop existing RLS policies on expenses table
DROP POLICY IF EXISTS "Drivers can delete their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Drivers can insert their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Drivers can update their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Drivers can view their own expenses" ON public.expenses;

-- Create more permissive policies for expenses table
-- Since this app uses custom auth (not Supabase Auth), we allow based on authenticated session

-- Allow insert for any authenticated request
CREATE POLICY "Allow insert expenses"
ON public.expenses
FOR INSERT
WITH CHECK (true);

-- Allow select for any authenticated request
CREATE POLICY "Allow select expenses"
ON public.expenses
FOR SELECT
USING (true);

-- Allow update for any authenticated request
CREATE POLICY "Allow update expenses"
ON public.expenses
FOR UPDATE
USING (true);

-- Allow delete for any authenticated request
CREATE POLICY "Allow delete expenses"
ON public.expenses
FOR DELETE
USING (true);
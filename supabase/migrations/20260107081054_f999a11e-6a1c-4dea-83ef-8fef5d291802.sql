-- Create function to check if username exists (public access for registration)
CREATE OR REPLACE FUNCTION public.check_username_exists(check_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE username = check_username
  );
$$;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION public.check_username_exists(text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_username_exists(text) TO authenticated;
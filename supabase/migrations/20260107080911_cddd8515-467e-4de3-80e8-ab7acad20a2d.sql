-- Add username column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN username text UNIQUE;

-- Create index for faster username lookup
CREATE INDEX idx_profiles_username ON public.profiles(username);

-- Update handle_new_user function to save username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone_number, username, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'firstName', '') || ' ' || COALESCE(NEW.raw_user_meta_data->>'lastName', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    NEW.raw_user_meta_data->>'username',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    username = COALESCE(EXCLUDED.username, profiles.username);
  RETURN NEW;
END;
$$;

-- Create function to lookup email by username (public access for login)
CREATE OR REPLACE FUNCTION public.get_email_by_username(lookup_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT au.email
  FROM auth.users au
  INNER JOIN public.profiles p ON p.id = au.id
  WHERE p.username = lookup_username
  LIMIT 1;
$$;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO authenticated;
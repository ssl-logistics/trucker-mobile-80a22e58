-- Update handle_new_user_role trigger to use the new unique constraint
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Assign freelance role by default for app registrations
  -- Each user can only have 1 role, so use ON CONFLICT (user_id)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'freelance'::app_role)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;
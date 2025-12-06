-- Update the trigger function to handle additional school fields from signup
CREATE OR REPLACE FUNCTION public.handle_new_admin_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_school_id UUID;
BEGIN
  -- Create a new school for this admin with all provided details
  INSERT INTO public.schools (school_name, school_email, school_address, school_phone)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'school_name', 'My School'),
    NEW.email,
    NEW.raw_user_meta_data->>'school_address',
    NEW.raw_user_meta_data->>'school_phone'
  )
  RETURNING id INTO new_school_id;

  -- Create admin profile with school_id
  INSERT INTO public.admin_profiles (id, email, full_name, school_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    new_school_id
  );

  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');

  RETURN NEW;
END;
$$;
-- Create admin profiles table
CREATE TABLE public.admin_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on admin_profiles
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

-- Admin can view their own profile
CREATE POLICY "Admins can view own profile"
  ON public.admin_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Admin can update their own profile
CREATE POLICY "Admins can update own profile"
  ON public.admin_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Create trigger to auto-create admin profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_admin_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_admin_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_admin_user();

-- Create school settings table
CREATE TABLE public.school_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name TEXT NOT NULL DEFAULT 'School Name',
  school_address TEXT,
  school_phone TEXT,
  school_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on school_settings
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

-- Admins can view school settings
CREATE POLICY "Admins can view school settings"
  ON public.school_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Admins can update school settings
CREATE POLICY "Admins can update school settings"
  ON public.school_settings
  FOR UPDATE
  TO authenticated
  USING (true);

-- Insert default school settings
INSERT INTO public.school_settings (school_name, school_address, school_phone, school_email)
VALUES ('My School', '123 School Street', '+1234567890', 'info@myschool.com');

-- Create fee_structures table (classes with fee amounts)
CREATE TABLE public.fee_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_name TEXT NOT NULL UNIQUE,
  fee_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on fee_structures
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;

-- Admins can do everything with fee structures
CREATE POLICY "Admins can view fee structures"
  ON public.fee_structures
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert fee structures"
  ON public.fee_structures
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update fee structures"
  ON public.fee_structures
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Admins can delete fee structures"
  ON public.fee_structures
  FOR DELETE
  TO authenticated
  USING (true);

-- Create students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_no TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  class_id UUID REFERENCES public.fee_structures(id) ON DELETE SET NULL,
  parent_contact TEXT,
  total_fee DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on students
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Admins can do everything with students
CREATE POLICY "Admins can view students"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert students"
  ON public.students
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update students"
  ON public.students
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Admins can delete students"
  ON public.students
  FOR DELETE
  TO authenticated
  USING (true);

-- Create function to auto-assign fee amount when student is assigned a class
CREATE OR REPLACE FUNCTION public.update_student_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.class_id IS NOT NULL THEN
    SELECT fee_amount INTO NEW.total_fee
    FROM public.fee_structures
    WHERE id = NEW.class_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_student_class_assigned
  BEFORE INSERT OR UPDATE OF class_id ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.update_student_fee();

-- Create payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  payment_method TEXT DEFAULT 'Cash',
  receipt_number TEXT UNIQUE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Admins can do everything with payments
CREATE POLICY "Admins can view payments"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert payments"
  ON public.payments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update payments"
  ON public.payments
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Admins can delete payments"
  ON public.payments
  FOR DELETE
  TO authenticated
  USING (true);

-- Create function to generate receipt numbers
CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.receipt_number IS NULL THEN
    NEW.receipt_number := 'RCP-' || EXTRACT(YEAR FROM NOW()) || '-' || LPAD(NEXTVAL('receipt_sequence')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Create sequence for receipt numbers
CREATE SEQUENCE IF NOT EXISTS receipt_sequence START 1;

CREATE TRIGGER on_payment_created
  BEFORE INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_receipt_number();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Add triggers for updated_at columns
CREATE TRIGGER update_admin_profiles_updated_at
  BEFORE UPDATE ON public.admin_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_school_settings_updated_at
  BEFORE UPDATE ON public.school_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fee_structures_updated_at
  BEFORE UPDATE ON public.fee_structures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- Create schools table for multi-tenancy
CREATE TABLE public.schools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_name TEXT NOT NULL,
  school_email TEXT,
  school_phone TEXT,
  school_address TEXT,
  school_logo_url TEXT,
  trial_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  trial_end TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'expired')),
  plan_type TEXT DEFAULT 'small' CHECK (plan_type IN ('small', 'medium', 'large')),
  max_students INTEGER DEFAULT 200,
  next_payment_date TIMESTAMP WITH TIME ZONE,
  last_payment_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- Add school_id to admin_profiles
ALTER TABLE public.admin_profiles ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- Add school_id to students
ALTER TABLE public.students ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.students ADD COLUMN parent_name TEXT;

-- Add school_id to fee_structures
ALTER TABLE public.fee_structures ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- Add school_id to payments
ALTER TABLE public.payments ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- Add school_id to school_settings
ALTER TABLE public.school_settings ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- Create billing table
CREATE TABLE public.billing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('monthly', 'yearly')),
  payment_method TEXT DEFAULT 'mpesa',
  transaction_id TEXT,
  expiry_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.billing ENABLE ROW LEVEL SECURITY;

-- Create user_roles enum and table for security
CREATE TYPE public.app_role AS ENUM ('admin', 'super_admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's school_id
CREATE OR REPLACE FUNCTION public.get_user_school_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id
  FROM public.admin_profiles
  WHERE id = _user_id
$$;

-- Update handle_new_admin_user function to create school
CREATE OR REPLACE FUNCTION public.handle_new_admin_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_school_id UUID;
BEGIN
  -- Create a new school for this admin
  INSERT INTO public.schools (school_name, school_email)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'school_name', 'My School'),
    NEW.email
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

-- RLS Policies for schools
CREATE POLICY "Admins can view own school"
ON public.schools FOR SELECT
USING (id = public.get_user_school_id(auth.uid()));

CREATE POLICY "Admins can update own school"
ON public.schools FOR UPDATE
USING (id = public.get_user_school_id(auth.uid()));

-- RLS Policies for students (update existing)
DROP POLICY IF EXISTS "Admins can view students" ON public.students;
DROP POLICY IF EXISTS "Admins can insert students" ON public.students;
DROP POLICY IF EXISTS "Admins can update students" ON public.students;
DROP POLICY IF EXISTS "Admins can delete students" ON public.students;

CREATE POLICY "Admins can view own school students"
ON public.students FOR SELECT
USING (school_id = public.get_user_school_id(auth.uid()));

CREATE POLICY "Admins can insert own school students"
ON public.students FOR INSERT
WITH CHECK (school_id = public.get_user_school_id(auth.uid()));

CREATE POLICY "Admins can update own school students"
ON public.students FOR UPDATE
USING (school_id = public.get_user_school_id(auth.uid()));

CREATE POLICY "Admins can delete own school students"
ON public.students FOR DELETE
USING (school_id = public.get_user_school_id(auth.uid()));

-- RLS Policies for fee_structures (update existing)
DROP POLICY IF EXISTS "Admins can view fee structures" ON public.fee_structures;
DROP POLICY IF EXISTS "Admins can insert fee structures" ON public.fee_structures;
DROP POLICY IF EXISTS "Admins can update fee structures" ON public.fee_structures;
DROP POLICY IF EXISTS "Admins can delete fee structures" ON public.fee_structures;

CREATE POLICY "Admins can view own school fee structures"
ON public.fee_structures FOR SELECT
USING (school_id = public.get_user_school_id(auth.uid()));

CREATE POLICY "Admins can insert own school fee structures"
ON public.fee_structures FOR INSERT
WITH CHECK (school_id = public.get_user_school_id(auth.uid()));

CREATE POLICY "Admins can update own school fee structures"
ON public.fee_structures FOR UPDATE
USING (school_id = public.get_user_school_id(auth.uid()));

CREATE POLICY "Admins can delete own school fee structures"
ON public.fee_structures FOR DELETE
USING (school_id = public.get_user_school_id(auth.uid()));

-- RLS Policies for payments (update existing)
DROP POLICY IF EXISTS "Admins can view payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can update payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can delete payments" ON public.payments;

CREATE POLICY "Admins can view own school payments"
ON public.payments FOR SELECT
USING (school_id = public.get_user_school_id(auth.uid()));

CREATE POLICY "Admins can insert own school payments"
ON public.payments FOR INSERT
WITH CHECK (school_id = public.get_user_school_id(auth.uid()));

CREATE POLICY "Admins can update own school payments"
ON public.payments FOR UPDATE
USING (school_id = public.get_user_school_id(auth.uid()));

CREATE POLICY "Admins can delete own school payments"
ON public.payments FOR DELETE
USING (school_id = public.get_user_school_id(auth.uid()));

-- RLS Policies for school_settings (update existing)
DROP POLICY IF EXISTS "Admins can view school settings" ON public.school_settings;
DROP POLICY IF EXISTS "Admins can update school settings" ON public.school_settings;

CREATE POLICY "Admins can view own school settings"
ON public.school_settings FOR SELECT
USING (school_id = public.get_user_school_id(auth.uid()));

CREATE POLICY "Admins can update own school settings"
ON public.school_settings FOR UPDATE
USING (school_id = public.get_user_school_id(auth.uid()));

-- RLS Policies for billing
CREATE POLICY "Admins can view own school billing"
ON public.billing FOR SELECT
USING (school_id = public.get_user_school_id(auth.uid()));

CREATE POLICY "System can insert billing"
ON public.billing FOR INSERT
WITH CHECK (true);

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX idx_students_school_id ON public.students(school_id);
CREATE INDEX idx_payments_school_id ON public.payments(school_id);
CREATE INDEX idx_payments_payment_date ON public.payments(payment_date);
CREATE INDEX idx_fee_structures_school_id ON public.fee_structures(school_id);
CREATE INDEX idx_billing_school_id ON public.billing(school_id);

-- Trigger for updating schools.updated_at
CREATE TRIGGER update_schools_updated_at
BEFORE UPDATE ON public.schools
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
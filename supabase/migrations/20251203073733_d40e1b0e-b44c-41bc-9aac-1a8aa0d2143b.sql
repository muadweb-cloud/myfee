-- Fix billing INSERT policy (critical security fix)
DROP POLICY IF EXISTS "System can insert billing" ON public.billing;
CREATE POLICY "Admins can insert own school billing"
ON public.billing FOR INSERT
WITH CHECK (school_id = get_user_school_id(auth.uid()));

-- Allow super_admins to view all schools
DROP POLICY IF EXISTS "Admins can view own school" ON public.schools;
CREATE POLICY "Admins can view own school or super_admin all"
ON public.schools FOR SELECT
USING (
  id = get_user_school_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
);

-- Allow super_admins to update all schools
DROP POLICY IF EXISTS "Admins can update own school" ON public.schools;
CREATE POLICY "Admins can update own school or super_admin all"
ON public.schools FOR UPDATE
USING (
  id = get_user_school_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
);

-- Allow super_admins to view all billing records
DROP POLICY IF EXISTS "Admins can view own school billing" ON public.billing;
CREATE POLICY "Admins can view own school billing or super_admin all"
ON public.billing FOR SELECT
USING (
  school_id = get_user_school_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
);

-- Allow super_admins to update billing records (for approving/rejecting requests)
CREATE POLICY "Super admins can update billing"
ON public.billing FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin'));

-- Allow super_admins to view all admin profiles (to see school owners)
DROP POLICY IF EXISTS "Admins can view own profile" ON public.admin_profiles;
CREATE POLICY "Admins can view own profile or super_admin all"
ON public.admin_profiles FOR SELECT
USING (
  auth.uid() = id
  OR public.has_role(auth.uid(), 'super_admin')
);
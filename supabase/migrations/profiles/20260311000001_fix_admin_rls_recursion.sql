-- Fix infinite recursion in admin RLS policies.
-- A SECURITY DEFINER function runs as the DB owner, bypassing RLS
-- on the profiles table so it doesn't trigger the same policies again.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Recreate admin policies using the helper function
DROP POLICY IF EXISTS "admins can read all profiles" ON public.profiles;
CREATE POLICY "admins can read all profiles"
  ON public.profiles
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "admins can update all profiles" ON public.profiles;
CREATE POLICY "admins can update all profiles"
  ON public.profiles
  FOR UPDATE
  USING (public.is_admin());

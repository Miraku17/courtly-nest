-- RLS Policies for profiles table

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read their own profile
CREATE POLICY "users can read own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can only update their own profile, and cannot set their role to ADMIN
CREATE POLICY "users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND role <> 'ADMIN'
  );

-- Helper: check admin status without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Admins can read all profiles
CREATE POLICY "admins can read all profiles"
  ON public.profiles
  FOR SELECT
  USING (public.is_admin());

-- Admins can update any profile (e.g. change a user's role)
CREATE POLICY "admins can update all profiles"
  ON public.profiles
  FOR UPDATE
  USING (public.is_admin());

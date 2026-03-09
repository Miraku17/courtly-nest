-- Drop the old policy and recreate it with the ADMIN role restriction
DROP POLICY IF EXISTS "users can update own profile" ON public.profiles;

CREATE POLICY "users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND role <> 'ADMIN'
  );

-- Profiles table
-- Mirrors auth.users and extends it with app-specific data.
-- The id is the same UUID as auth.users.id.
CREATE TABLE public.profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role             user_role,
  first_name       TEXT,
  last_name        TEXT,
  phone            TEXT,
  avatar_url       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create a profile row whenever a new user signs up in Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

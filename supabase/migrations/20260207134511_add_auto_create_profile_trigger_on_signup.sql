/*
  # Auto-create profile on user signup

  When email confirmation is enabled, the user has no session at signup time,
  so client-side profile inserts fail due to RLS. This trigger runs as SECURITY DEFINER
  and automatically creates a profile row from auth.users metadata.

  1. New Functions
    - `handle_new_user_profile()` - trigger function on auth.users INSERT
      - Reads `role` from `raw_user_meta_data`
      - Creates a profile row with id, email, and role
      - Uses ON CONFLICT DO NOTHING for safety

  2. New Triggers
    - `on_auth_user_created` on `auth.users` AFTER INSERT

  3. Important Notes
    - The role is passed via `options.data.role` during signUp
    - Defaults to 'customer' if no role is provided
    - Does not overwrite existing profiles (ON CONFLICT DO NOTHING)
*/

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user_profile();
  END IF;
END $$;

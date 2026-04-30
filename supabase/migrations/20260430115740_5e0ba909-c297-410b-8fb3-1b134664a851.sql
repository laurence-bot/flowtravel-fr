-- 1) Recréer handle_new_user avec le nouvel email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_count int;
  assigned_role public.app_role;
  is_first boolean;
BEGIN
  SELECT count(*) INTO user_count FROM public.user_profiles;
  is_first := (user_count = 0);

  IF lower(NEW.email) = 'bonjour@flowtravel.fr' OR is_first THEN
    assigned_role := 'administrateur';
  ELSE
    assigned_role := 'agent';
  END IF;

  INSERT INTO public.user_profiles (user_id, email, full_name, actif, is_super_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    true,
    is_first OR lower(NEW.email) = 'bonjour@flowtravel.fr'
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 2) Recréer le trigger de protection avec le nouvel email
CREATE OR REPLACE FUNCTION public.protect_laurence_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  protected_id uuid;
BEGIN
  SELECT id INTO protected_id FROM auth.users WHERE lower(email) = 'bonjour@flowtravel.fr' LIMIT 1;
  IF protected_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'user_roles' THEN
    IF TG_OP = 'DELETE' AND OLD.user_id = protected_id AND OLD.role = 'administrateur' THEN
      RAISE EXCEPTION 'Le rôle administrateur de bonjour@flowtravel.fr est protégé.';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.user_id = protected_id AND OLD.role = 'administrateur' AND NEW.role <> 'administrateur' THEN
      RAISE EXCEPTION 'Le rôle administrateur de bonjour@flowtravel.fr ne peut pas être modifié.';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'user_profiles' AND TG_OP = 'UPDATE' AND OLD.user_id = protected_id THEN
    IF NEW.actif = false THEN
      RAISE EXCEPTION 'Le compte bonjour@flowtravel.fr ne peut pas être désactivé.';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 3) Reset complet des données utilisateurs et agences
TRUNCATE public.user_roles CASCADE;
TRUNCATE public.user_profiles CASCADE;
TRUNCATE public.agences CASCADE;
DELETE FROM auth.users;
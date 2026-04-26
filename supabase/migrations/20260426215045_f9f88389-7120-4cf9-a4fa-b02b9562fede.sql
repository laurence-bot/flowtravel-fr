-- 1) Mettre à jour le trigger handle_new_user pour forcer admin pour laurence@lavoyagerie.fr
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_count int;
  assigned_role public.app_role;
BEGIN
  SELECT count(*) INTO user_count FROM public.user_profiles;

  IF lower(NEW.email) = 'laurence@lavoyagerie.fr' THEN
    assigned_role := 'administrateur';
  ELSIF user_count = 0 THEN
    assigned_role := 'administrateur';
  ELSE
    assigned_role := 'lecture_seule';
  END IF;

  INSERT INTO public.user_profiles (user_id, email, full_name, actif)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    true
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 2) Trigger de protection : laurence@lavoyagerie.fr ne peut jamais perdre son admin ni être désactivée
CREATE OR REPLACE FUNCTION public.protect_laurence_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  laurence_id uuid;
BEGIN
  SELECT id INTO laurence_id FROM auth.users WHERE lower(email) = 'laurence@lavoyagerie.fr' LIMIT 1;
  IF laurence_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- user_roles : empêcher suppression du rôle admin de Laurence
  IF TG_TABLE_NAME = 'user_roles' THEN
    IF TG_OP = 'DELETE' AND OLD.user_id = laurence_id AND OLD.role = 'administrateur' THEN
      RAISE EXCEPTION 'Le rôle administrateur de laurence@lavoyagerie.fr est protégé.';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.user_id = laurence_id AND OLD.role = 'administrateur' AND NEW.role <> 'administrateur' THEN
      RAISE EXCEPTION 'Le rôle administrateur de laurence@lavoyagerie.fr ne peut pas être modifié.';
    END IF;
  END IF;

  -- user_profiles : empêcher désactivation de Laurence
  IF TG_TABLE_NAME = 'user_profiles' AND TG_OP = 'UPDATE' AND OLD.user_id = laurence_id THEN
    IF NEW.actif = false THEN
      RAISE EXCEPTION 'Le compte laurence@lavoyagerie.fr ne peut pas être désactivé.';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS protect_laurence_roles ON public.user_roles;
CREATE TRIGGER protect_laurence_roles
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_laurence_admin();

DROP TRIGGER IF EXISTS protect_laurence_profile ON public.user_profiles;
CREATE TRIGGER protect_laurence_profile
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_laurence_admin();

-- 3) Réparer maintenant l'utilisateur existant : créer profil + rôle admin si manquants,
--    forcer admin si un autre rôle est en place, et garantir actif = true
INSERT INTO public.user_profiles (user_id, email, full_name, actif)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)), true
FROM auth.users u
WHERE lower(u.email) = 'laurence@lavoyagerie.fr'
ON CONFLICT (user_id) DO UPDATE SET actif = true;

DELETE FROM public.user_roles
WHERE user_id = (SELECT id FROM auth.users WHERE lower(email) = 'laurence@lavoyagerie.fr')
  AND role <> 'administrateur';

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'administrateur'::public.app_role
FROM auth.users u
WHERE lower(u.email) = 'laurence@lavoyagerie.fr'
ON CONFLICT (user_id, role) DO NOTHING;
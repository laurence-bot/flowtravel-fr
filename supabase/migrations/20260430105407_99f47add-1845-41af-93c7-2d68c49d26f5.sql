-- 2) Migrer tous les rôles non-admin existants vers 'agent'
-- On supprime d'abord les doublons potentiels puis on convertit
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT user_id, 'agent'::public.app_role
FROM public.user_roles
WHERE role IN ('gestion', 'comptable', 'lecture_seule')
ON CONFLICT (user_id, role) DO NOTHING;

-- Supprimer les anciens rôles non-admin
DELETE FROM public.user_roles
WHERE role IN ('gestion', 'comptable', 'lecture_seule');

-- 3) Mettre à jour le trigger handle_new_user pour utiliser 'agent' par défaut
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
    assigned_role := 'agent';
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
-- Fonction trigger qui empêche un non-admin de modifier actif/email/user_id sur son propre profil
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si admin, tout est permis
  IF public.has_role(auth.uid(), 'administrateur') THEN
    RETURN NEW;
  END IF;

  -- Sinon : doit être propriétaire et ne peut changer que full_name
  IF NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'user_id ne peut pas être modifié';
  END IF;
  IF NEW.actif IS DISTINCT FROM OLD.actif THEN
    RAISE EXCEPTION 'Seul un administrateur peut modifier le statut actif';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'L''email ne peut pas être modifié manuellement';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_profile_fields_trg
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();
-- Empêcher un admin de retirer son propre rôle administrateur (anti-lockout)
-- et empêcher la suppression du dernier admin
CREATE OR REPLACE FUNCTION public.protect_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining_admins int;
BEGIN
  -- Cas DELETE : on supprime un rôle admin
  IF TG_OP = 'DELETE' AND OLD.role = 'administrateur' THEN
    SELECT count(*) INTO remaining_admins
    FROM public.user_roles
    WHERE role = 'administrateur' AND user_id <> OLD.user_id;
    IF remaining_admins = 0 THEN
      RAISE EXCEPTION 'Impossible de supprimer le dernier administrateur';
    END IF;
    RETURN OLD;
  END IF;

  -- Cas UPDATE : on change un rôle admin vers autre chose
  IF TG_OP = 'UPDATE' AND OLD.role = 'administrateur' AND NEW.role <> 'administrateur' THEN
    SELECT count(*) INTO remaining_admins
    FROM public.user_roles
    WHERE role = 'administrateur' AND user_id <> OLD.user_id;
    IF remaining_admins = 0 THEN
      RAISE EXCEPTION 'Impossible de retirer le dernier administrateur';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER protect_admin_role_trg
  BEFORE UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_admin_role();

-- Verrou explicite : aucun INSERT direct sur user_profiles (création gérée par trigger SECURITY DEFINER)
CREATE POLICY "profiles_no_direct_insert"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Verrou explicite : aucun DELETE sur user_profiles (suppression via cascade auth.users)
CREATE POLICY "profiles_no_delete"
  ON public.user_profiles FOR DELETE
  TO authenticated
  USING (false);
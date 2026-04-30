-- Désactiver les triggers de protection (vrais noms)
DROP TRIGGER IF EXISTS protect_admin_role_trg ON public.user_roles;
DROP TRIGGER IF EXISTS protect_laurence_roles ON public.user_roles;
DROP TRIGGER IF EXISTS protect_laurence_profile ON public.user_profiles;

-- Vider les données métier
TRUNCATE TABLE
  public.rapprochements,
  public.demo_video_views,
  public.demo_rdv_bookings,
  public.demo_rdv_slots,
  public.demo_requests,
  public.facture_echeances,
  public.factures_fournisseurs,
  public.fx_coverage_reservations,
  public.fx_coverages,
  public.flight_segments,
  public.flight_options,
  public.fournisseur_options,
  public.fournisseur_conditions,
  public.cotation_lignes_fournisseurs,
  public.cotation_jours,
  public.quote_public_links,
  public.cotations,
  public.dossier_tasks,
  public.dossiers,
  public.demandes,
  public.paiements,
  public.transferts,
  public.bank_transactions,
  public.comptes,
  public.contacts,
  public.pdf_imports,
  public.audit_logs,
  public.agency_settings
CASCADE;

-- Détacher profils des agences puis vider
UPDATE public.user_profiles SET agence_id = NULL;
DELETE FROM public.agences;

-- Supprimer rôles, profils, comptes auth
DELETE FROM public.user_roles;
DELETE FROM public.user_profiles;
DELETE FROM auth.users;

-- Mettre à jour handle_new_user : 1er compte = admin + super-admin
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

  IF lower(NEW.email) = 'laurence@lavoyagerie.fr' OR is_first THEN
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
    is_first OR lower(NEW.email) = 'laurence@lavoyagerie.fr'
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Recréer les triggers de protection
CREATE TRIGGER protect_admin_role_trg
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_admin_role();

CREATE TRIGGER protect_laurence_roles
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_laurence_admin();

CREATE TRIGGER protect_laurence_profile
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_laurence_admin();
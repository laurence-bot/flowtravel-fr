
-- 1. Enums
CREATE TYPE public.agence_statut AS ENUM ('en_attente', 'validee', 'refusee', 'suspendue');
CREATE TYPE public.agence_forfait AS ENUM ('solo', 'equipe', 'agence');

-- 2. Table agences
CREATE TABLE public.agences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_commercial TEXT NOT NULL,
  raison_sociale TEXT,
  immat_atout_france TEXT NOT NULL UNIQUE,
  siret TEXT NOT NULL,
  email_contact TEXT NOT NULL,
  telephone TEXT,
  adresse TEXT,
  ville TEXT,
  code_postal TEXT,
  pays TEXT DEFAULT 'France',

  statut public.agence_statut NOT NULL DEFAULT 'en_attente',
  validee_at TIMESTAMPTZ,
  validee_par UUID,
  motif_refus TEXT,

  pappers_nom TEXT,
  pappers_statut_actif BOOLEAN,
  pappers_verified_at TIMESTAMPTZ,
  pappers_raw JSONB,

  doc_atout_france_url TEXT,
  doc_kbis_url TEXT,
  doc_piece_identite_url TEXT,

  forfait public.agence_forfait NOT NULL DEFAULT 'solo',
  max_agents INTEGER NOT NULL DEFAULT 1,

  admin_user_id UUID,
  admin_full_name TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agences_admin_user_id ON public.agences(admin_user_id);
CREATE INDEX idx_agences_statut ON public.agences(statut);

CREATE TRIGGER set_agences_updated_at
BEFORE UPDATE ON public.agences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Modif user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN agence_id UUID REFERENCES public.agences(id) ON DELETE SET NULL,
  ADD COLUMN is_super_admin BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_user_profiles_agence_id ON public.user_profiles(agence_id);

-- 4. Helpers SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_super_admin FROM public.user_profiles WHERE user_id = _user_id LIMIT 1), false)
$$;

CREATE OR REPLACE FUNCTION public.get_my_agence_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT agence_id FROM public.user_profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- 5. RLS agences
ALTER TABLE public.agences ENABLE ROW LEVEL SECURITY;

-- Insertion publique (formulaire d'inscription) : autorisée pour anon + auth, statut forcé en_attente
CREATE POLICY agences_public_insert ON public.agences
  FOR INSERT TO anon, authenticated
  WITH CHECK (statut = 'en_attente' AND admin_user_id IS NULL AND validee_at IS NULL);

-- Lecture : super-admin voit tout, sinon utilisateur voit son agence
CREATE POLICY agences_select ON public.agences
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR id = public.get_my_agence_id()
  );

-- Update : super-admin uniquement (validation, refus, changement de forfait)
CREATE POLICY agences_update_super_admin ON public.agences
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Delete : super-admin uniquement
CREATE POLICY agences_delete_super_admin ON public.agences
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 6. Bucket agence-documents (privé)
INSERT INTO storage.buckets (id, name, public)
VALUES ('agence-documents', 'agence-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Upload public (formulaire d'inscription) — chemin /pending/<random>/<filename>
CREATE POLICY agence_docs_public_upload ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'agence-documents'
    AND (storage.foldername(name))[1] = 'pending'
  );

-- Lecture super-admin : tout
CREATE POLICY agence_docs_super_admin_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'agence-documents'
    AND public.is_super_admin(auth.uid())
  );

-- Lecture par membre de l'agence (chemin /agence/<agence_id>/...)
CREATE POLICY agence_docs_member_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'agence-documents'
    AND (storage.foldername(name))[1] = 'agence'
    AND (storage.foldername(name))[2]::uuid = public.get_my_agence_id()
  );

-- 7. Trigger : empêcher dépassement de quota d'agents
CREATE OR REPLACE FUNCTION public.check_agence_quota()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_count INT;
  max_allowed INT;
BEGIN
  IF NEW.agence_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.agence_id IS NOT DISTINCT FROM NEW.agence_id THEN
    RETURN NEW;
  END IF;

  SELECT max_agents INTO max_allowed FROM public.agences WHERE id = NEW.agence_id;
  IF max_allowed IS NULL THEN
    RETURN NEW;
  END IF;

  -- forfait agence (illimité) : max_agents = 9999, on laisse passer
  IF max_allowed >= 9999 THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO current_count FROM public.user_profiles WHERE agence_id = NEW.agence_id;
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Quota d''agents atteint pour cette agence (% max)', max_allowed;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_agence_quota
BEFORE INSERT OR UPDATE OF agence_id ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.check_agence_quota();

-- 8. Grandfather : créer l'agence "La Voyagerie" et marquer Laurence super-admin
DO $$
DECLARE
  laurence_id UUID;
  voyagerie_id UUID;
BEGIN
  SELECT id INTO laurence_id FROM auth.users WHERE lower(email) = 'laurence@lavoyagerie.fr' LIMIT 1;

  IF laurence_id IS NOT NULL THEN
    -- Marquer Laurence super-admin
    UPDATE public.user_profiles SET is_super_admin = true WHERE user_id = laurence_id;

    -- Créer l'agence La Voyagerie si elle n'existe pas
    INSERT INTO public.agences (
      nom_commercial, raison_sociale, immat_atout_france, siret,
      email_contact, statut, validee_at, validee_par,
      forfait, max_agents, admin_user_id, admin_full_name
    )
    SELECT
      'La Voyagerie', 'La Voyagerie', 'IM000000000', '00000000000000',
      'laurence@lavoyagerie.fr', 'validee', now(), laurence_id,
      'agence', 9999, laurence_id, 'Laurence'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.agences WHERE admin_user_id = laurence_id
    )
    RETURNING id INTO voyagerie_id;

    IF voyagerie_id IS NULL THEN
      SELECT id INTO voyagerie_id FROM public.agences WHERE admin_user_id = laurence_id LIMIT 1;
    END IF;

    -- Rattacher tous les profils existants à La Voyagerie (grandfather)
    UPDATE public.user_profiles
    SET agence_id = voyagerie_id
    WHERE agence_id IS NULL;
  END IF;
END $$;

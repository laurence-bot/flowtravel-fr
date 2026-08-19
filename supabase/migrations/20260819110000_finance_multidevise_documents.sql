-- FlowTravel - comptes multidevises, soldes Ebury réels, dates métier et coffre documentaire.
-- Les montants contractuels FX existants restent inchangés.

ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS date_ouverture date,
  ADD COLUMN IF NOT EXISTS date_depart date,
  ADD COLUMN IF NOT EXISTS date_retour date;

ALTER TABLE public.dossiers
  DROP CONSTRAINT IF EXISTS dossiers_dates_coherentes;
ALTER TABLE public.dossiers
  ADD CONSTRAINT dossiers_dates_coherentes
  CHECK (date_depart IS NULL OR date_retour IS NULL OR date_retour >= date_depart);

ALTER TABLE public.comptes
  ADD COLUMN IF NOT EXISTS devise text NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS solde_initial_devise numeric,
  ADD COLUMN IF NOT EXISTS taux_solde_eur numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS date_solde_initial date;

UPDATE public.comptes
SET solde_initial_devise = solde_initial
WHERE solde_initial_devise IS NULL;

ALTER TABLE public.comptes
  ALTER COLUMN solde_initial_devise SET NOT NULL,
  DROP CONSTRAINT IF EXISTS comptes_devise_check,
  DROP CONSTRAINT IF EXISTS comptes_taux_solde_eur_check;
ALTER TABLE public.comptes
  ADD CONSTRAINT comptes_devise_check
    CHECK (devise IN ('EUR','USD','GBP','ZAR','CHF','CAD','AUD','JPY','AED','MAD','TND')),
  ADD CONSTRAINT comptes_taux_solde_eur_check CHECK (taux_solde_eur > 0);

ALTER TABLE public.fx_coverages
  ADD COLUMN IF NOT EXISTS solde_reel_devise numeric,
  ADD COLUMN IF NOT EXISTS solde_reel_eur numeric,
  ADD COLUMN IF NOT EXISTS date_solde_reel date;

ALTER TABLE public.fx_coverages
  DROP CONSTRAINT IF EXISTS fx_coverages_solde_reel_devise_check,
  DROP CONSTRAINT IF EXISTS fx_coverages_solde_reel_eur_check;
ALTER TABLE public.fx_coverages
  ADD CONSTRAINT fx_coverages_solde_reel_devise_check
    CHECK (solde_reel_devise IS NULL OR solde_reel_devise >= 0),
  ADD CONSTRAINT fx_coverages_solde_reel_eur_check
    CHECK (solde_reel_eur IS NULL OR solde_reel_eur >= 0);

CREATE TABLE IF NOT EXISTS public.documents_securises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agence_id uuid,
  dossier_id uuid REFERENCES public.dossiers(id) ON DELETE SET NULL,
  entite text NOT NULL DEFAULT 'la_voyagerie'
    CHECK (entite IN ('la_voyagerie', 'bespoke', 'personnel')),
  categorie text NOT NULL
    CHECK (categorie IN (
      'dossier_voyage', 'facture_fournisseur', 'facture_client',
      'comptabilite', 'fiscalite', 'banque', 'credit_assurance',
      'juridique', 'social_rh', 'correspondance', 'autre'
    )),
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  file_size bigint,
  content_hash text,
  date_document date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documents_securises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS documents_securises_select_own ON public.documents_securises;
CREATE POLICY documents_securises_select_own
ON public.documents_securises FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS documents_securises_insert_own ON public.documents_securises;
CREATE POLICY documents_securises_insert_own
ON public.documents_securises FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS documents_securises_update_own ON public.documents_securises;
CREATE POLICY documents_securises_update_own
ON public.documents_securises FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS documents_securises_delete_own ON public.documents_securises;
CREATE POLICY documents_securises_delete_own
ON public.documents_securises FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_documents_securises_user
  ON public.documents_securises(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_securises_dossier
  ON public.documents_securises(dossier_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_securises_dedup
  ON public.documents_securises(
    user_id,
    content_hash,
    COALESCE(dossier_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE content_hash IS NOT NULL;

DROP TRIGGER IF EXISTS set_documents_securises_updated_at ON public.documents_securises;
CREATE TRIGGER set_documents_securises_updated_at
BEFORE UPDATE ON public.documents_securises
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents-securises',
  'documents-securises',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'image/png',
    'image/jpeg'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS documents_securises_storage_select_own ON storage.objects;
CREATE POLICY documents_securises_storage_select_own
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents-securises'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS documents_securises_storage_insert_own ON storage.objects;
CREATE POLICY documents_securises_storage_insert_own
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents-securises'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS documents_securises_storage_update_own ON storage.objects;
CREATE POLICY documents_securises_storage_update_own
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents-securises'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'documents-securises'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS documents_securises_storage_delete_own ON storage.objects;
CREATE POLICY documents_securises_storage_delete_own
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents-securises'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

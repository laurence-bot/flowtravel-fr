-- =========================
-- ENUMS
-- =========================
DO $$ BEGIN
  CREATE TYPE public.devise_code AS ENUM ('EUR','USD','GBP','ZAR','CHF','CAD','AUD','JPY','AED','MAD','TND');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fx_source AS ENUM ('taux_du_jour','couverture','manuel');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fx_coverage_statut AS ENUM ('ouverte','reservee','utilisee','expiree','anomalie');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fx_reservation_statut AS ENUM ('active','utilisee','annulee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.echeance_type AS ENUM ('acompte_1','acompte_2','acompte_3','solde','autre');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.echeance_statut AS ENUM ('a_payer','paye','en_retard','annule');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Étendre audit_entity pour FX
ALTER TYPE public.audit_entity ADD VALUE IF NOT EXISTS 'fx_coverage';
ALTER TYPE public.audit_entity ADD VALUE IF NOT EXISTS 'fx_reservation';
ALTER TYPE public.audit_entity ADD VALUE IF NOT EXISTS 'facture_echeance';

-- =========================
-- COMPTES : devise
-- =========================
ALTER TABLE public.comptes
  ADD COLUMN IF NOT EXISTS devise public.devise_code NOT NULL DEFAULT 'EUR';

-- =========================
-- BANK TRANSACTIONS : FX
-- =========================
ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS devise public.devise_code NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS montant_devise numeric,
  ADD COLUMN IF NOT EXISTS taux_change numeric,
  ADD COLUMN IF NOT EXISTS libelle_fx text,
  ADD COLUMN IF NOT EXISTS reference_ebury text,
  ADD COLUMN IF NOT EXISTS contrepartie text;

-- =========================
-- FACTURES FOURNISSEURS : FX
-- =========================
ALTER TABLE public.factures_fournisseurs
  ADD COLUMN IF NOT EXISTS devise public.devise_code NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS montant_devise numeric,
  ADD COLUMN IF NOT EXISTS taux_change numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS montant_eur numeric,
  ADD COLUMN IF NOT EXISTS fx_source public.fx_source NOT NULL DEFAULT 'taux_du_jour',
  ADD COLUMN IF NOT EXISTS coverage_id uuid;

-- Initialiser montant_devise / montant_eur pour les lignes existantes (EUR)
UPDATE public.factures_fournisseurs
SET montant_devise = COALESCE(montant_devise, montant),
    montant_eur = COALESCE(montant_eur, montant)
WHERE montant_devise IS NULL OR montant_eur IS NULL;

-- =========================
-- PAIEMENTS : FX
-- =========================
ALTER TABLE public.paiements
  ADD COLUMN IF NOT EXISTS devise public.devise_code NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS montant_devise numeric,
  ADD COLUMN IF NOT EXISTS taux_change numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS montant_eur numeric,
  ADD COLUMN IF NOT EXISTS fx_source public.fx_source NOT NULL DEFAULT 'taux_du_jour',
  ADD COLUMN IF NOT EXISTS coverage_id uuid;

UPDATE public.paiements
SET montant_devise = COALESCE(montant_devise, montant),
    montant_eur = COALESCE(montant_eur, montant)
WHERE montant_devise IS NULL OR montant_eur IS NULL;

-- =========================
-- TABLE fx_coverages
-- =========================
CREATE TABLE IF NOT EXISTS public.fx_coverages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reference text,
  devise public.devise_code NOT NULL,
  montant_devise numeric NOT NULL CHECK (montant_devise > 0),
  taux_change numeric NOT NULL CHECK (taux_change > 0),
  date_ouverture date NOT NULL DEFAULT CURRENT_DATE,
  date_echeance date NOT NULL,
  statut public.fx_coverage_statut NOT NULL DEFAULT 'ouverte',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fx_coverages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS own_fx_coverages_all ON public.fx_coverages;
CREATE POLICY own_fx_coverages_all ON public.fx_coverages
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_fx_coverages_updated ON public.fx_coverages;
CREATE TRIGGER trg_fx_coverages_updated
  BEFORE UPDATE ON public.fx_coverages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_fx_coverages_user ON public.fx_coverages(user_id);
CREATE INDEX IF NOT EXISTS idx_fx_coverages_devise ON public.fx_coverages(devise);
CREATE INDEX IF NOT EXISTS idx_fx_coverages_statut ON public.fx_coverages(statut);

-- =========================
-- TABLE fx_coverage_reservations
-- =========================
CREATE TABLE IF NOT EXISTS public.fx_coverage_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  coverage_id uuid NOT NULL REFERENCES public.fx_coverages(id) ON DELETE CASCADE,
  facture_fournisseur_id uuid REFERENCES public.factures_fournisseurs(id) ON DELETE SET NULL,
  echeance_id uuid,
  paiement_id uuid REFERENCES public.paiements(id) ON DELETE SET NULL,
  montant_devise numeric NOT NULL CHECK (montant_devise > 0),
  taux_change numeric NOT NULL CHECK (taux_change > 0),
  statut public.fx_reservation_statut NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fx_coverage_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS own_fx_reservations_all ON public.fx_coverage_reservations;
CREATE POLICY own_fx_reservations_all ON public.fx_coverage_reservations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_fx_res_coverage ON public.fx_coverage_reservations(coverage_id);
CREATE INDEX IF NOT EXISTS idx_fx_res_facture ON public.fx_coverage_reservations(facture_fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_fx_res_paiement ON public.fx_coverage_reservations(paiement_id);

-- =========================
-- TABLE facture_echeances
-- =========================
CREATE TABLE IF NOT EXISTS public.facture_echeances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  facture_id uuid NOT NULL REFERENCES public.factures_fournisseurs(id) ON DELETE CASCADE,
  type public.echeance_type NOT NULL DEFAULT 'autre',
  ordre int NOT NULL DEFAULT 1,
  date_echeance date,
  devise public.devise_code NOT NULL DEFAULT 'EUR',
  montant_devise numeric NOT NULL CHECK (montant_devise >= 0),
  taux_change numeric NOT NULL DEFAULT 1 CHECK (taux_change > 0),
  montant_eur numeric NOT NULL DEFAULT 0,
  fx_source public.fx_source NOT NULL DEFAULT 'taux_du_jour',
  coverage_id uuid REFERENCES public.fx_coverages(id) ON DELETE SET NULL,
  statut public.echeance_statut NOT NULL DEFAULT 'a_payer',
  paiement_id uuid REFERENCES public.paiements(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facture_echeances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS own_facture_echeances_all ON public.facture_echeances;
CREATE POLICY own_facture_echeances_all ON public.facture_echeances
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_facture_echeances_updated ON public.facture_echeances;
CREATE TRIGGER trg_facture_echeances_updated
  BEFORE UPDATE ON public.facture_echeances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_facture_echeances_facture ON public.facture_echeances(facture_id);
CREATE INDEX IF NOT EXISTS idx_facture_echeances_user ON public.facture_echeances(user_id);
CREATE INDEX IF NOT EXISTS idx_facture_echeances_coverage ON public.facture_echeances(coverage_id);

-- FK pour fx_coverage_reservations.echeance_id (après création de facture_echeances)
ALTER TABLE public.fx_coverage_reservations
  DROP CONSTRAINT IF EXISTS fx_res_echeance_fkey;
ALTER TABLE public.fx_coverage_reservations
  ADD CONSTRAINT fx_res_echeance_fkey
  FOREIGN KEY (echeance_id) REFERENCES public.facture_echeances(id) ON DELETE SET NULL;

-- FK pour factures_fournisseurs.coverage_id et paiements.coverage_id
ALTER TABLE public.factures_fournisseurs
  DROP CONSTRAINT IF EXISTS factures_coverage_fkey;
ALTER TABLE public.factures_fournisseurs
  ADD CONSTRAINT factures_coverage_fkey
  FOREIGN KEY (coverage_id) REFERENCES public.fx_coverages(id) ON DELETE SET NULL;

ALTER TABLE public.paiements
  DROP CONSTRAINT IF EXISTS paiements_coverage_fkey;
ALTER TABLE public.paiements
  ADD CONSTRAINT paiements_coverage_fkey
  FOREIGN KEY (coverage_id) REFERENCES public.fx_coverages(id) ON DELETE SET NULL;
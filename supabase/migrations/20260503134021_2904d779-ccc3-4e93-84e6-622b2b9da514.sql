-- Lot 1 : Paramètres agence pour le bulletin d'inscription
ALTER TABLE public.agency_settings
  ADD COLUMN IF NOT EXISTS signature_url TEXT,
  ADD COLUMN IF NOT EXISTS signature_nom TEXT,
  ADD COLUMN IF NOT EXISTS payment_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS iban TEXT,
  ADD COLUMN IF NOT EXISTS bic TEXT,
  ADD COLUMN IF NOT EXISTS titulaire_compte TEXT,
  ADD COLUMN IF NOT EXISTS lien_paiement_cb TEXT,
  ADD COLUMN IF NOT EXISTS lien_paiement_cb_libelle TEXT,
  ADD COLUMN IF NOT EXISTS instructions_paiement_autres TEXT,
  ADD COLUMN IF NOT EXISTS pct_acompte_client_1 NUMERIC NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS pct_acompte_client_2 NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pct_solde_client NUMERIC NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS delai_acompte_2_jours INTEGER,
  ADD COLUMN IF NOT EXISTS delai_solde_jours INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS conditions_annulation_agence JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS garant_insolvabilite TEXT,
  ADD COLUMN IF NOT EXISTS assureur_rc_pro TEXT,
  ADD COLUMN IF NOT EXISTS numero_police_rc TEXT,
  ADD COLUMN IF NOT EXISTS immat_atout_france TEXT,
  ADD COLUMN IF NOT EXISTS numero_iata TEXT;

-- Bucket pour les signatures agence (réutilise agency-logos qui est déjà public)
-- Pas besoin de nouveau bucket.
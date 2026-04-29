-- ============================================================
-- Module 1 : Édition contact étendue
-- ============================================================
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS adresse text,
  ADD COLUMN IF NOT EXISTS code_postal text,
  ADD COLUMN IF NOT EXISTS ville text,
  ADD COLUMN IF NOT EXISTS pays text,
  ADD COLUMN IF NOT EXISTS site_web text,
  ADD COLUMN IF NOT EXISTS contact_principal text,
  ADD COLUMN IF NOT EXISTS notes text;

-- ============================================================
-- Module 2 : Conditions commerciales fournisseur (multi-profils)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fournisseur_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fournisseur_id uuid NOT NULL,
  nom_profil text NOT NULL,
  est_defaut boolean NOT NULL DEFAULT false,
  devises_acceptees text[] NOT NULL DEFAULT ARRAY['EUR']::text[],
  pct_acompte_1 numeric NOT NULL DEFAULT 30,
  pct_acompte_2 numeric NOT NULL DEFAULT 0,
  pct_acompte_3 numeric NOT NULL DEFAULT 0,
  pct_solde numeric NOT NULL DEFAULT 70,
  delai_acompte_1_jours integer,
  delai_acompte_2_jours integer,
  delai_acompte_3_jours integer,
  delai_solde_jours integer DEFAULT 30,
  conditions_annulation jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fournisseur_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY own_fournisseur_conditions_all
  ON public.fournisseur_conditions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_fourn_cond_fournisseur ON public.fournisseur_conditions(fournisseur_id);

CREATE TRIGGER trg_fournisseur_conditions_updated_at
  BEFORE UPDATE ON public.fournisseur_conditions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Lien profil sur ligne cotation
ALTER TABLE public.cotation_lignes_fournisseurs
  ADD COLUMN IF NOT EXISTS condition_profil_id uuid;

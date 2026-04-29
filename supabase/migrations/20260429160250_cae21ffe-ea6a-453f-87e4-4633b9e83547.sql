-- Recréer la table fournisseur_conditions
CREATE TABLE IF NOT EXISTS public.fournisseur_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fournisseur_id uuid NOT NULL,
  nom text NOT NULL DEFAULT 'Standard',
  est_principale boolean NOT NULL DEFAULT false,
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

DROP POLICY IF EXISTS own_fournisseur_conditions_all ON public.fournisseur_conditions;
CREATE POLICY own_fournisseur_conditions_all
  ON public.fournisseur_conditions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_fournisseur_conditions_updated_at ON public.fournisseur_conditions;
CREATE TRIGGER set_fournisseur_conditions_updated_at
  BEFORE UPDATE ON public.fournisseur_conditions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_fc_fournisseur ON public.fournisseur_conditions(fournisseur_id);

-- Migration : pour chaque fournisseur ayant des conditions sur sa fiche, créer une condition "Standard"
INSERT INTO public.fournisseur_conditions (
  user_id, fournisseur_id, nom, est_principale, devises_acceptees,
  pct_acompte_1, pct_acompte_2, pct_acompte_3, pct_solde,
  delai_acompte_1_jours, delai_acompte_2_jours, delai_acompte_3_jours, delai_solde_jours,
  conditions_annulation, notes
)
SELECT
  c.user_id, c.id, 'Standard', true, COALESCE(c.devises_acceptees, ARRAY['EUR']::text[]),
  COALESCE(c.pct_acompte_1, 30), COALESCE(c.pct_acompte_2, 0),
  COALESCE(c.pct_acompte_3, 0), COALESCE(c.pct_solde, 70),
  c.delai_acompte_1_jours, c.delai_acompte_2_jours, c.delai_acompte_3_jours,
  COALESCE(c.delai_solde_jours, 30),
  COALESCE(c.conditions_annulation, '[]'::jsonb), c.conditions_notes
FROM public.contacts c
WHERE c.type = 'fournisseur'
  AND NOT EXISTS (
    SELECT 1 FROM public.fournisseur_conditions fc WHERE fc.fournisseur_id = c.id
  );

-- Nettoyage : enlever les colonnes de conditions de contacts
ALTER TABLE public.contacts
  DROP COLUMN IF EXISTS devises_acceptees,
  DROP COLUMN IF EXISTS pct_acompte_1,
  DROP COLUMN IF EXISTS pct_acompte_2,
  DROP COLUMN IF EXISTS pct_acompte_3,
  DROP COLUMN IF EXISTS pct_solde,
  DROP COLUMN IF EXISTS delai_acompte_1_jours,
  DROP COLUMN IF EXISTS delai_acompte_2_jours,
  DROP COLUMN IF EXISTS delai_acompte_3_jours,
  DROP COLUMN IF EXISTS delai_solde_jours,
  DROP COLUMN IF EXISTS conditions_annulation,
  DROP COLUMN IF EXISTS conditions_notes;

-- Ré-ajouter la colonne sur les lignes cotation pour pouvoir lier une condition spécifique
ALTER TABLE public.cotation_lignes_fournisseurs
  ADD COLUMN IF NOT EXISTS condition_id uuid;
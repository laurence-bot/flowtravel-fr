-- Ajout des conditions fournisseur directement sur contacts
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS devises_acceptees text[] NOT NULL DEFAULT ARRAY['EUR']::text[],
  ADD COLUMN IF NOT EXISTS pct_acompte_1 numeric NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS pct_acompte_2 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pct_acompte_3 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pct_solde numeric NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS delai_acompte_1_jours integer,
  ADD COLUMN IF NOT EXISTS delai_acompte_2_jours integer,
  ADD COLUMN IF NOT EXISTS delai_acompte_3_jours integer,
  ADD COLUMN IF NOT EXISTS delai_solde_jours integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS conditions_annulation jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS conditions_notes text;

-- Migration des données existantes : reprendre le profil par défaut s'il existe
UPDATE public.contacts c
SET
  devises_acceptees = fc.devises_acceptees,
  pct_acompte_1 = fc.pct_acompte_1,
  pct_acompte_2 = fc.pct_acompte_2,
  pct_acompte_3 = fc.pct_acompte_3,
  pct_solde = fc.pct_solde,
  delai_acompte_1_jours = fc.delai_acompte_1_jours,
  delai_acompte_2_jours = fc.delai_acompte_2_jours,
  delai_acompte_3_jours = fc.delai_acompte_3_jours,
  delai_solde_jours = fc.delai_solde_jours,
  conditions_annulation = fc.conditions_annulation,
  conditions_notes = fc.notes
FROM public.fournisseur_conditions fc
WHERE fc.fournisseur_id = c.id AND fc.est_defaut = true;

-- Supprimer la référence + la table
ALTER TABLE public.cotation_lignes_fournisseurs
  DROP COLUMN IF EXISTS condition_profil_id;

DROP TABLE IF EXISTS public.fournisseur_conditions;
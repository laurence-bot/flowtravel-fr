ALTER TABLE public.fournisseur_conditions
  ADD COLUMN IF NOT EXISTS acompte_1_a_reservation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS acompte_2_a_reservation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acompte_3_a_reservation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS solde_a_reservation boolean NOT NULL DEFAULT false;
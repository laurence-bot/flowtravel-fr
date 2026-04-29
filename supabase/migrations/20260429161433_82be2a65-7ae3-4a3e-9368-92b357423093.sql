-- Étendre l'enum fx_reservation_statut pour distinguer réservé (devis) vs engagé (dossier confirmé)
ALTER TYPE public.fx_reservation_statut ADD VALUE IF NOT EXISTS 'reservee';
ALTER TYPE public.fx_reservation_statut ADD VALUE IF NOT EXISTS 'engagee';
ALTER TYPE public.fx_reservation_statut ADD VALUE IF NOT EXISTS 'liberee';

-- Ajouter une référence optionnelle vers la cotation pour pouvoir libérer/engager en masse
ALTER TABLE public.fx_coverage_reservations
  ADD COLUMN IF NOT EXISTS cotation_id uuid;

ALTER TABLE public.fx_coverage_reservations
  ADD COLUMN IF NOT EXISTS ligne_fournisseur_id uuid;

CREATE INDEX IF NOT EXISTS idx_fx_res_cotation ON public.fx_coverage_reservations(cotation_id);
CREATE INDEX IF NOT EXISTS idx_fx_res_ligne ON public.fx_coverage_reservations(ligne_fournisseur_id);
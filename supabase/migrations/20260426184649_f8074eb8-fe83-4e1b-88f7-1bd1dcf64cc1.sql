ALTER TABLE public.dossiers
ADD COLUMN IF NOT EXISTS taux_tva_marge numeric NOT NULL DEFAULT 20;
ALTER TABLE public.cotations ADD COLUMN IF NOT EXISTS pays_destination text;
ALTER TABLE public.dossiers ADD COLUMN IF NOT EXISTS pays_destination text;
ALTER TABLE public.demandes ADD COLUMN IF NOT EXISTS pays_destination text;
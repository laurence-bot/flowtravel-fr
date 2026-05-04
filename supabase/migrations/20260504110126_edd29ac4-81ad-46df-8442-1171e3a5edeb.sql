ALTER TABLE public.cotations
  ADD COLUMN IF NOT EXISTS version_label text,
  ADD COLUMN IF NOT EXISTS programme_pdf_url text,
  ADD COLUMN IF NOT EXISTS programme_pdf_name text;

ALTER TABLE public.cotation_jours
  ADD COLUMN IF NOT EXISTS hotel_nom text,
  ADD COLUMN IF NOT EXISTS hotel_url text,
  ADD COLUMN IF NOT EXISTS hotel_photo_url text;
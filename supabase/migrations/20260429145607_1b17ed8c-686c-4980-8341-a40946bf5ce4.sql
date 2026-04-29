ALTER TABLE public.cotation_jours
  ADD COLUMN IF NOT EXISTS gallery_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS image_credit text,
  ADD COLUMN IF NOT EXISTS gallery_credits jsonb NOT NULL DEFAULT '[]'::jsonb;
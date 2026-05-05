ALTER TABLE public.cotation_jours
  ADD COLUMN IF NOT EXISTS inclusions jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.cotation_jours.inclusions IS
  'Objet JSON { vol_international, vol_domestique, hebergement, petit_dejeuner, dejeuner, diner, guide, transfert, location_voiture, excursion, entrees } — true=inclus, false=non inclus, null=non détecté/non applicable';
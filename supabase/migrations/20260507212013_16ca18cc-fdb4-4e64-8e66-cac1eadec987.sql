ALTER TABLE public.cotations
ADD COLUMN IF NOT EXISTS taux_marge_cible numeric(5,2) DEFAULT NULL;

COMMENT ON COLUMN public.cotations.taux_marge_cible IS
'Taux de marge nette cible saisi par l''agent (%). NULL = non défini.';
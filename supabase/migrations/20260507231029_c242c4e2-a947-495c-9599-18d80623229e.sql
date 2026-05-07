ALTER TABLE public.hr_employees
ADD COLUMN IF NOT EXISTS heures_par_jour numeric(4,2) DEFAULT 7.5,
ADD COLUMN IF NOT EXISTS pause_minutes integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS rythme_semaine text DEFAULT 'fixe' CHECK (rythme_semaine IN ('fixe','ab')),
ADD COLUMN IF NOT EXISTS semaine_a_jours integer[] DEFAULT '{1,2,3,4,5}'::integer[],
ADD COLUMN IF NOT EXISTS semaine_b_jours integer[] DEFAULT '{1,2,4,5}'::integer[],
ADD COLUMN IF NOT EXISTS semaine_ref_iso integer DEFAULT NULL;

COMMENT ON COLUMN public.hr_employees.heures_par_jour IS 'Heures contractuelles nettes par jour (pause déduite)';
COMMENT ON COLUMN public.hr_employees.pause_minutes IS 'Durée de pause repas en minutes (déduite du temps brut)';
COMMENT ON COLUMN public.hr_employees.rythme_semaine IS 'fixe = même jours chaque semaine ; ab = alternance semaine A / semaine B';
COMMENT ON COLUMN public.hr_employees.semaine_a_jours IS 'Jours travaillés en semaine A (1=lun,2=mar,3=mer,4=jeu,5=ven,6=sam)';
COMMENT ON COLUMN public.hr_employees.semaine_b_jours IS 'Jours travaillés en semaine B';
COMMENT ON COLUMN public.hr_employees.semaine_ref_iso IS 'Numéro de semaine ISO qui correspond à la semaine A (pour caler le cycle)';
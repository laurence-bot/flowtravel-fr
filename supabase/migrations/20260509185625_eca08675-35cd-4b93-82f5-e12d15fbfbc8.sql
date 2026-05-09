-- Invalide tous les compteurs mensuels antérieurs : la prochaine ouverture
-- du planning d'un mois donné les recalculera et les ré-écrira.
TRUNCATE TABLE public.hr_compteur_heures;
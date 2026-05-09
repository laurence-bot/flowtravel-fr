-- Nettoyage ciblé des anciennes données RH de Lisa Bagard pour mai 2026
DO $$
DECLARE
  v_employee_id uuid;
  v_agence_id uuid;
BEGIN
  SELECT id, agence_id
    INTO v_employee_id, v_agence_id
  FROM public.hr_employees
  WHERE lower(prenom) = 'lisa'
    AND lower(nom) = 'bagard'
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RETURN;
  END IF;

  -- Lisa est à 7h/jour dans le compteur attendu.
  UPDATE public.hr_employees
  SET heures_par_jour = 7,
      pause_minutes = 30
  WHERE id = v_employee_id;

  -- Les samedis historiques avaient été saisis en travail avant l'existence du type remplacement.
  UPDATE public.hr_planning_entries
  SET type = 'remplacement',
      note = COALESCE(note, 'Remplacement historique reclassé'),
      updated_at = now()
  WHERE employee_id = v_employee_id
    AND date_start IN ('2026-05-02', '2026-05-30')
    AND date_end IN ('2026-05-02', '2026-05-30')
    AND type = 'travail';

  -- Comme ces lignes sont reclassées par UPDATE, le trigger INSERT ne se déclenche pas : on crée les rendus manquants.
  INSERT INTO public.hr_jours_dus (employee_id, agence_id, sens, date_origine, motif, planning_entry_id, statut)
  SELECT p.employee_id,
         COALESCE(p.agence_id, v_agence_id),
         'rendu',
         p.date_start,
         COALESCE(p.note, 'Remplacement historique'),
         p.id,
         'ouvert'
  FROM public.hr_planning_entries p
  WHERE p.employee_id = v_employee_id
    AND p.date_start IN ('2026-05-02', '2026-05-30')
    AND p.type = 'remplacement'
    AND NOT EXISTS (
      SELECT 1
      FROM public.hr_jours_dus jd
      WHERE jd.planning_entry_id = p.id
        AND jd.sens = 'rendu'
    );

  -- Invalidation du compteur stale : il sera recalculé à l'ouverture du planning.
  DELETE FROM public.hr_compteur_heures
  WHERE employee_id = v_employee_id
    AND mois = '2026-05';
END $$;
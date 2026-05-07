-- Group id pour planning multi-jours
ALTER TABLE public.hr_planning_entries ADD COLUMN IF NOT EXISTS group_id uuid;
CREATE INDEX IF NOT EXISTS idx_hr_planning_group ON public.hr_planning_entries(group_id);

-- Lecture du planning de toute l'agence pour tous les agents
DROP POLICY IF EXISTS hr_planning_agence_read ON public.hr_planning_entries;
CREATE POLICY hr_planning_agence_read ON public.hr_planning_entries
  FOR SELECT TO authenticated
  USING (agence_id IS NOT NULL AND agence_id = public.get_my_agence_id());

-- L'employé peut lire ses propres demandes de récupération
DROP POLICY IF EXISTS hr_recup_self_read ON public.hr_recup_demandes;
CREATE POLICY hr_recup_self_read ON public.hr_recup_demandes
  FOR SELECT TO authenticated
  USING (employee_id IN (SELECT id FROM public.hr_employees WHERE user_id = auth.uid()));
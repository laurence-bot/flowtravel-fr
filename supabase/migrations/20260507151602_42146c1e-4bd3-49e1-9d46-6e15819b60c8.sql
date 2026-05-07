
ALTER TABLE public.hr_recup_demandes
  ADD COLUMN IF NOT EXISTS heure_debut time,
  ADD COLUMN IF NOT EXISTS heure_fin time,
  ADD COLUMN IF NOT EXISTS planning_entry_id uuid;

ALTER TABLE public.hr_recup_demandes
  DROP CONSTRAINT IF EXISTS hr_recup_demandes_statut_check;
ALTER TABLE public.hr_recup_demandes
  ADD CONSTRAINT hr_recup_demandes_statut_check
  CHECK (statut = ANY (ARRAY['demande','approuvee','refusee','annulee']));

ALTER TYPE hr_planning_type ADD VALUE IF NOT EXISTS 'recuperation';

DROP POLICY IF EXISTS "Employes annulent leurs recup" ON public.hr_recup_demandes;
CREATE POLICY "Employes annulent leurs recup"
  ON public.hr_recup_demandes FOR UPDATE
  TO authenticated
  USING (
    statut = 'demande'
    AND employee_id IN (SELECT id FROM hr_employees WHERE user_id = auth.uid())
  )
  WITH CHECK (
    statut IN ('demande','annulee')
    AND employee_id IN (SELECT id FROM hr_employees WHERE user_id = auth.uid())
  );

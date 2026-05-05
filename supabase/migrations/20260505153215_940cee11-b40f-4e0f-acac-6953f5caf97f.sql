-- Pause sur les entrées planning
ALTER TABLE public.hr_planning_entries 
ADD COLUMN IF NOT EXISTS pause_minutes integer DEFAULT 30;

-- Compteur d'heures par employé par mois
CREATE TABLE IF NOT EXISTS public.hr_compteur_heures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  agence_id uuid,
  mois text NOT NULL,
  heures_contractuelles numeric(6,2) NOT NULL DEFAULT 0,
  heures_realisees numeric(6,2) NOT NULL DEFAULT 0,
  heures_report numeric(6,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, mois)
);

ALTER TABLE public.hr_compteur_heures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins agence gerent compteurs"
ON public.hr_compteur_heures FOR ALL
USING (public.is_agence_admin(agence_id))
WITH CHECK (public.is_agence_admin(agence_id));

CREATE POLICY "Employes voient leurs compteurs"
ON public.hr_compteur_heures FOR SELECT
USING (employee_id IN (SELECT id FROM public.hr_employees WHERE user_id = auth.uid()));

CREATE TRIGGER trg_compteur_heures_updated
BEFORE UPDATE ON public.hr_compteur_heures
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Demandes de récupération d'heures
CREATE TABLE IF NOT EXISTS public.hr_recup_demandes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  agence_id uuid,
  mois text NOT NULL,
  type text NOT NULL CHECK (type IN ('journee', 'heures', 'report_exceptionnel')),
  heures_demandees numeric(5,2) NOT NULL,
  date_souhaitee date,
  motif text,
  statut text NOT NULL DEFAULT 'demande' CHECK (statut IN ('demande', 'approuvee', 'refusee')),
  traite_par uuid,
  traite_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.hr_recup_demandes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins agence gerent recup"
ON public.hr_recup_demandes FOR ALL
USING (public.is_agence_admin(agence_id))
WITH CHECK (public.is_agence_admin(agence_id));

CREATE POLICY "Employes voient leurs recup"
ON public.hr_recup_demandes FOR SELECT
USING (employee_id IN (SELECT id FROM public.hr_employees WHERE user_id = auth.uid()));

CREATE POLICY "Employes creent leurs recup"
ON public.hr_recup_demandes FOR INSERT
WITH CHECK (employee_id IN (SELECT id FROM public.hr_employees WHERE user_id = auth.uid()));
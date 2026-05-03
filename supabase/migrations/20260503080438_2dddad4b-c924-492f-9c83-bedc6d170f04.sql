
-- ============================================================
-- MODULE RH (Ressources Humaines) — Schema complet
-- ============================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.hr_contract_type AS ENUM ('cdi','cdd','stage','alternance','freelance','interim','autre');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.hr_contract_statut AS ENUM ('brouillon','a_signer','signe','archive','rompu');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.hr_absence_type AS ENUM ('conge_paye','rtt','maladie','sans_solde','formation','recup','parental','autre');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.hr_absence_statut AS ENUM ('demande','approuvee','refusee','signee','annulee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.hr_planning_type AS ENUM ('travail','teletravail','reunion','deplacement','formation','autre');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.hr_time_event AS ENUM ('arrivee','pause_debut','pause_fin','sortie');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.hr_evaluation_statut AS ENUM ('a_completer','auto_eval_faite','entretien_fait','signee','cloturee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- HELPER : has_agence_admin (admin de la même agence)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_agence_admin(_agence_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_super_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'administrateur') AND public.get_my_agence_id() = _agence_id);
$$;

-- ============================================================
-- TABLE : hr_employees
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hr_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agence_id uuid,
  user_id uuid,                      -- compte FlowTravel lié (optionnel)
  civilite text,
  prenom text NOT NULL,
  nom text NOT NULL,
  email text,
  telephone text,
  date_naissance date,
  adresse text,
  ville text,
  code_postal text,
  pays text DEFAULT 'France',
  poste text,
  manager_id uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  date_embauche date,
  date_sortie date,
  type_contrat hr_contract_type DEFAULT 'cdi',
  salaire_brut_mensuel numeric(10,2),
  jours_conges_par_an numeric(5,2) DEFAULT 25,
  jours_rtt_par_an numeric(5,2) DEFAULT 0,
  numero_secu text,
  iban text,
  notes text,
  actif boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hr_employees_agence ON public.hr_employees(agence_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_user ON public.hr_employees(user_id);

CREATE POLICY "hr_employees_admin_all" ON public.hr_employees
  FOR ALL TO authenticated
  USING (public.is_agence_admin(agence_id))
  WITH CHECK (public.is_agence_admin(agence_id));

CREATE POLICY "hr_employees_self_read" ON public.hr_employees
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_hr_employees_updated_at BEFORE UPDATE ON public.hr_employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TABLE : hr_contracts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hr_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  agence_id uuid,
  parent_contract_id uuid REFERENCES public.hr_contracts(id) ON DELETE SET NULL,  -- avenant
  titre text NOT NULL,
  type_contrat hr_contract_type DEFAULT 'cdi',
  date_debut date,
  date_fin date,
  pdf_url text,
  contenu_html text,
  statut hr_contract_statut NOT NULL DEFAULT 'brouillon',
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 days'),
  signature_data text,
  signataire_nom text,
  signed_at timestamptz,
  signed_ip text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hr_contracts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hr_contracts_employee ON public.hr_contracts(employee_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_contracts_token ON public.hr_contracts(token);

CREATE POLICY "hr_contracts_admin_all" ON public.hr_contracts
  FOR ALL TO authenticated
  USING (public.is_agence_admin(agence_id))
  WITH CHECK (public.is_agence_admin(agence_id));

CREATE POLICY "hr_contracts_self_read" ON public.hr_contracts
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hr_employees e WHERE e.id = employee_id AND e.user_id = auth.uid()));

CREATE POLICY "hr_contracts_public_sign" ON public.hr_contracts
  FOR SELECT TO anon, authenticated
  USING (expires_at > now());

CREATE POLICY "hr_contracts_public_update_sign" ON public.hr_contracts
  FOR UPDATE TO anon, authenticated
  USING (expires_at > now() AND statut = 'a_signer')
  WITH CHECK (expires_at > now());

CREATE TRIGGER trg_hr_contracts_updated_at BEFORE UPDATE ON public.hr_contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TABLE : hr_absences
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hr_absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  agence_id uuid,
  type hr_absence_type NOT NULL DEFAULT 'conge_paye',
  date_debut date NOT NULL,
  date_fin date NOT NULL,
  demi_journee_debut boolean NOT NULL DEFAULT false,  -- aprem
  demi_journee_fin boolean NOT NULL DEFAULT false,    -- matin
  nb_jours numeric(5,2),
  motif text,
  justificatif_url text,
  statut hr_absence_statut NOT NULL DEFAULT 'demande',
  approuve_par uuid,
  approuve_at timestamptz,
  motif_refus text,
  -- Signature électronique de la demande approuvée
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 days'),
  signature_data text,
  signed_at timestamptz,
  signed_ip text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hr_absences ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hr_absences_employee ON public.hr_absences(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_absences_dates ON public.hr_absences(date_debut, date_fin);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_absences_token ON public.hr_absences(token);

CREATE POLICY "hr_absences_admin_all" ON public.hr_absences
  FOR ALL TO authenticated
  USING (public.is_agence_admin(agence_id))
  WITH CHECK (public.is_agence_admin(agence_id));

CREATE POLICY "hr_absences_self_read" ON public.hr_absences
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hr_employees e WHERE e.id = employee_id AND e.user_id = auth.uid()));

CREATE POLICY "hr_absences_self_create" ON public.hr_absences
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.hr_employees e WHERE e.id = employee_id AND e.user_id = auth.uid()));

CREATE POLICY "hr_absences_public_sign" ON public.hr_absences
  FOR SELECT TO anon, authenticated
  USING (expires_at > now());

CREATE POLICY "hr_absences_public_update_sign" ON public.hr_absences
  FOR UPDATE TO anon, authenticated
  USING (expires_at > now() AND statut = 'approuvee')
  WITH CHECK (expires_at > now());

CREATE TRIGGER trg_hr_absences_updated_at BEFORE UPDATE ON public.hr_absences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TABLE : hr_planning_entries
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hr_planning_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  agence_id uuid,
  date_jour date NOT NULL,
  heure_debut time,
  heure_fin time,
  type hr_planning_type NOT NULL DEFAULT 'travail',
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hr_planning_entries ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hr_planning_employee_date ON public.hr_planning_entries(employee_id, date_jour);
CREATE INDEX IF NOT EXISTS idx_hr_planning_agence_date ON public.hr_planning_entries(agence_id, date_jour);

CREATE POLICY "hr_planning_admin_all" ON public.hr_planning_entries
  FOR ALL TO authenticated
  USING (public.is_agence_admin(agence_id))
  WITH CHECK (public.is_agence_admin(agence_id));

CREATE POLICY "hr_planning_self_read" ON public.hr_planning_entries
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hr_employees e WHERE e.id = employee_id AND e.user_id = auth.uid()));

CREATE TRIGGER trg_hr_planning_updated_at BEFORE UPDATE ON public.hr_planning_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TABLE : hr_time_entries (pointage temps réel)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hr_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  agence_id uuid,
  event_type hr_time_event NOT NULL,
  event_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hr_time_entries ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hr_time_entries_employee ON public.hr_time_entries(employee_id, event_at);

CREATE POLICY "hr_time_admin_all" ON public.hr_time_entries
  FOR ALL TO authenticated
  USING (public.is_agence_admin(agence_id))
  WITH CHECK (public.is_agence_admin(agence_id));

CREATE POLICY "hr_time_self_read" ON public.hr_time_entries
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hr_employees e WHERE e.id = employee_id AND e.user_id = auth.uid()));

CREATE POLICY "hr_time_self_create" ON public.hr_time_entries
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.hr_employees e WHERE e.id = employee_id AND e.user_id = auth.uid()));

-- ============================================================
-- TABLE : hr_job_descriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hr_job_descriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  agence_id uuid,
  version integer NOT NULL DEFAULT 1,
  intitule text NOT NULL,
  missions text,
  competences_attendues text,
  objectifs text,
  kpi text,
  date_application date,
  est_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hr_job_descriptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hr_jobdesc_employee ON public.hr_job_descriptions(employee_id);

CREATE POLICY "hr_jobdesc_admin_all" ON public.hr_job_descriptions
  FOR ALL TO authenticated
  USING (public.is_agence_admin(agence_id))
  WITH CHECK (public.is_agence_admin(agence_id));

CREATE POLICY "hr_jobdesc_self_read" ON public.hr_job_descriptions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hr_employees e WHERE e.id = employee_id AND e.user_id = auth.uid()));

CREATE TRIGGER trg_hr_jobdesc_updated_at BEFORE UPDATE ON public.hr_job_descriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TABLE : hr_evaluations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hr_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  agence_id uuid,
  annee integer NOT NULL,
  date_entretien date,
  -- Sections
  bilan_n_moins_1 text,
  atteinte_objectifs text,
  points_forts text,
  axes_progres text,
  formations_souhaitees text,
  objectifs_n_plus_1 text,
  evolution_souhaitee text,
  note_globale numeric(3,1),
  -- Auto-évaluation employé
  auto_evaluation jsonb DEFAULT '{}'::jsonb,
  -- Manager
  evaluation_manager jsonb DEFAULT '{}'::jsonb,
  evaluateur_id uuid,
  statut hr_evaluation_statut NOT NULL DEFAULT 'a_completer',
  -- Signature
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  signature_employee text,
  signed_employee_at timestamptz,
  signature_manager text,
  signed_manager_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hr_evaluations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hr_eval_employee_annee ON public.hr_evaluations(employee_id, annee);

CREATE POLICY "hr_eval_admin_all" ON public.hr_evaluations
  FOR ALL TO authenticated
  USING (public.is_agence_admin(agence_id))
  WITH CHECK (public.is_agence_admin(agence_id));

CREATE POLICY "hr_eval_self_read" ON public.hr_evaluations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hr_employees e WHERE e.id = employee_id AND e.user_id = auth.uid()));

CREATE POLICY "hr_eval_self_update" ON public.hr_evaluations
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hr_employees e WHERE e.id = employee_id AND e.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hr_employees e WHERE e.id = employee_id AND e.user_id = auth.uid()));

CREATE TRIGGER trg_hr_eval_updated_at BEFORE UPDATE ON public.hr_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TABLE : hr_settings (1 ligne par agence)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hr_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agence_id uuid UNIQUE,
  email_comptable text,
  email_comptable_cc text,
  jour_envoi_recap integer NOT NULL DEFAULT 1,  -- jour du mois
  derniere_execution_at timestamptz,
  jours_feries jsonb DEFAULT '[]'::jsonb,
  notifications_push_actives boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hr_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_settings_admin_all" ON public.hr_settings
  FOR ALL TO authenticated
  USING (public.is_agence_admin(agence_id))
  WITH CHECK (public.is_agence_admin(agence_id));

CREATE TRIGGER trg_hr_settings_updated_at BEFORE UPDATE ON public.hr_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TABLE : hr_push_subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hr_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hr_push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_push_endpoint ON public.hr_push_subscriptions(endpoint);

CREATE POLICY "hr_push_self_all" ON public.hr_push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- STORAGE : bucket privé pour documents RH
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
  VALUES ('hr-documents', 'hr-documents', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "hr_docs_admin_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'hr-documents'
    AND (
      public.is_super_admin(auth.uid())
      OR public.has_role(auth.uid(), 'administrateur')
    )
  );

CREATE POLICY "hr_docs_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'hr-documents'
    AND (
      public.is_super_admin(auth.uid())
      OR public.has_role(auth.uid(), 'administrateur')
    )
  );

CREATE POLICY "hr_docs_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'hr-documents'
    AND (
      public.is_super_admin(auth.uid())
      OR public.has_role(auth.uid(), 'administrateur')
    )
  );

CREATE POLICY "hr_docs_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'hr-documents'
    AND (
      public.is_super_admin(auth.uid())
      OR public.has_role(auth.uid(), 'administrateur')
    )
  );

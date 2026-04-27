-- Enums
DO $$ BEGIN
  CREATE TYPE public.dossier_task_statut AS ENUM ('a_faire','en_cours','termine');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.dossier_task_priorite AS ENUM ('normale','importante','critique');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.dossier_task_phase AS ENUM ('avant','pre_depart','pendant','apres','autre');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE IF NOT EXISTS public.dossier_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dossier_id uuid NOT NULL,
  phase public.dossier_task_phase NOT NULL DEFAULT 'autre',
  type text,
  titre text NOT NULL,
  description text,
  statut public.dossier_task_statut NOT NULL DEFAULT 'a_faire',
  priorite public.dossier_task_priorite NOT NULL DEFAULT 'normale',
  date_echeance date,
  ordre integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dossier_tasks_dossier ON public.dossier_tasks(dossier_id);
CREATE INDEX IF NOT EXISTS idx_dossier_tasks_user ON public.dossier_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_dossier_tasks_statut ON public.dossier_tasks(statut);

ALTER TABLE public.dossier_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY own_dossier_tasks_all ON public.dossier_tasks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_dossier_tasks_updated_at
  BEFORE UPDATE ON public.dossier_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Étendre l'enum d'audit pour les tâches dossier
ALTER TYPE public.audit_entity ADD VALUE IF NOT EXISTS 'dossier_task';
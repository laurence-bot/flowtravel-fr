ALTER TABLE public.hr_recup_demandes
DROP CONSTRAINT IF EXISTS fk_recup_planning_entry;

ALTER TABLE public.hr_recup_demandes
ADD CONSTRAINT fk_recup_planning_entry
FOREIGN KEY (planning_entry_id)
REFERENCES public.hr_planning_entries(id)
ON DELETE SET NULL
DEFERRABLE INITIALLY DEFERRED;

CREATE OR REPLACE FUNCTION public.trg_recup_planning_unlinked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.planning_entry_id IS NOT NULL
     AND NEW.planning_entry_id IS NULL
     AND OLD.statut = 'approuvee' THEN
    NEW.statut := 'demande';
    NEW.traite_par := NULL;
    NEW.traite_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recup_planning_unlinked ON public.hr_recup_demandes;
CREATE TRIGGER trg_recup_planning_unlinked
BEFORE UPDATE OF planning_entry_id ON public.hr_recup_demandes
FOR EACH ROW
EXECUTE FUNCTION public.trg_recup_planning_unlinked();

DO $$ BEGIN
  ALTER TYPE public.hr_absence_type ADD VALUE IF NOT EXISTS 'recup';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.trg_absence_recup_to_planning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agence_id uuid;
  v_date date;
BEGIN
  IF NEW.type = 'recup'
     AND NEW.statut = 'approuvee'
     AND (OLD.statut IS DISTINCT FROM 'approuvee') THEN

    SELECT agence_id INTO v_agence_id
    FROM public.hr_employees WHERE id = NEW.employee_id;

    v_date := NEW.date_debut;
    WHILE v_date <= NEW.date_fin LOOP
      IF EXTRACT(DOW FROM v_date) NOT IN (0, 6) THEN
        DELETE FROM public.hr_planning_entries
        WHERE employee_id = NEW.employee_id
          AND date_start = v_date
          AND type IN ('travail', 'teletravail');

        INSERT INTO public.hr_planning_entries
          (employee_id, agence_id, date_start, date_end, type, note, created_by)
        VALUES
          (NEW.employee_id, v_agence_id, v_date, v_date,
           'recuperation',
           COALESCE('Récup : ' || NEW.motif, 'Récupération'),
           NEW.approuve_par)
        ON CONFLICT DO NOTHING;
      END IF;
      v_date := v_date + 1;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_absence_recup_to_planning ON public.hr_absences;
CREATE TRIGGER trg_absence_recup_to_planning
AFTER UPDATE OF statut ON public.hr_absences
FOR EACH ROW
EXECUTE FUNCTION public.trg_absence_recup_to_planning();

CREATE INDEX IF NOT EXISTS idx_hr_recup_planning_entry
ON public.hr_recup_demandes(planning_entry_id)
WHERE planning_entry_id IS NOT NULL;
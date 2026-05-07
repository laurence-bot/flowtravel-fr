-- Migrer hr_planning_entries vers date_start / date_end (chevauchement de plages)
ALTER TABLE public.hr_planning_entries RENAME COLUMN date_jour TO date_start;
ALTER TABLE public.hr_planning_entries ADD COLUMN date_end date;
UPDATE public.hr_planning_entries SET date_end = date_start WHERE date_end IS NULL;
ALTER TABLE public.hr_planning_entries ALTER COLUMN date_end SET NOT NULL;

-- Contrainte de cohérence
ALTER TABLE public.hr_planning_entries
  ADD CONSTRAINT hr_planning_entries_date_range_chk CHECK (date_end >= date_start);

-- Indexes pour requêtes de chevauchement
DROP INDEX IF EXISTS public.idx_hr_planning_employee_date;
DROP INDEX IF EXISTS public.idx_hr_planning_agence_date;
CREATE INDEX idx_hr_planning_employee_range ON public.hr_planning_entries (employee_id, date_start, date_end);
CREATE INDEX idx_hr_planning_agence_range ON public.hr_planning_entries (agence_id, date_start, date_end);

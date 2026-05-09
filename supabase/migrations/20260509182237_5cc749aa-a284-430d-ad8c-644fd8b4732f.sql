-- 1. Ajout du type 'remplacement' à l'enum
ALTER TYPE public.hr_planning_type ADD VALUE IF NOT EXISTS 'remplacement';

-- 2. Correction des pauses manquantes pour Lisa (04/05 et 12/05)
UPDATE public.hr_planning_entries
SET pause_minutes = 30
WHERE employee_id = '9a7c4bcf-b29a-415e-b5e0-56f61bfee4ee'
  AND date_start IN ('2026-05-04','2026-05-12')
  AND type = 'travail'
  AND COALESCE(pause_minutes, 0) = 0;

-- 3. Table hr_jours_dus
CREATE TABLE IF NOT EXISTS public.hr_jours_dus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  agence_id uuid,
  sens text NOT NULL CHECK (sens IN ('du','rendu')),
  date_origine date NOT NULL,
  motif text,
  planning_entry_id uuid REFERENCES public.hr_planning_entries(id) ON DELETE SET NULL,
  date_extinction date,
  extinction_entry_id uuid REFERENCES public.hr_planning_entries(id) ON DELETE SET NULL,
  statut text NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert','solde','annule')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hr_jours_dus_employee_idx ON public.hr_jours_dus(employee_id, statut);

ALTER TABLE public.hr_jours_dus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hr_jours_dus_agence_all ON public.hr_jours_dus;
CREATE POLICY hr_jours_dus_agence_all ON public.hr_jours_dus
  FOR ALL TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (agence_id IS NOT NULL AND agence_id = get_my_agence_id())
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR (agence_id IS NOT NULL AND agence_id = get_my_agence_id())
  );

CREATE TRIGGER trg_hr_jours_dus_updated_at
  BEFORE UPDATE ON public.hr_jours_dus
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Trigger : à l'insert d'un planning 'remplacement', créer un 'rendu' et tenter d'éteindre le plus ancien 'du'
CREATE OR REPLACE FUNCTION public.trg_planning_remplacement_to_jours_dus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_du_id uuid;
  v_rendu_id uuid;
BEGIN
  IF NEW.type <> 'remplacement' THEN
    RETURN NEW;
  END IF;

  -- Crée l'entrée 'rendu'
  INSERT INTO public.hr_jours_dus (employee_id, agence_id, sens, date_origine, motif, planning_entry_id, statut)
  VALUES (NEW.employee_id, NEW.agence_id, 'rendu', NEW.date_start, COALESCE(NEW.note, 'Remplacement'), NEW.id, 'ouvert')
  RETURNING id INTO v_rendu_id;

  -- Cherche le plus ancien 'du' ouvert
  SELECT id INTO v_du_id
  FROM public.hr_jours_dus
  WHERE employee_id = NEW.employee_id AND sens = 'du' AND statut = 'ouvert'
  ORDER BY date_origine ASC
  LIMIT 1;

  IF v_du_id IS NOT NULL THEN
    UPDATE public.hr_jours_dus
    SET statut = 'solde', date_extinction = NEW.date_start, extinction_entry_id = NEW.id
    WHERE id = v_du_id;
    UPDATE public.hr_jours_dus
    SET statut = 'solde', date_extinction = NEW.date_start
    WHERE id = v_rendu_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_planning_remplacement ON public.hr_planning_entries;
CREATE TRIGGER trg_planning_remplacement
  AFTER INSERT ON public.hr_planning_entries
  FOR EACH ROW EXECUTE FUNCTION public.trg_planning_remplacement_to_jours_dus();
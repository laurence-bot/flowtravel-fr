CREATE OR REPLACE FUNCTION public.set_agence_id_from_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_data jsonb;
BEGIN
  row_data := to_jsonb(NEW);

  IF NEW.agence_id IS NULL THEN
    IF row_data ? 'user_id' AND NULLIF(row_data ->> 'user_id', '') IS NOT NULL THEN
      SELECT agence_id INTO NEW.agence_id
      FROM public.user_profiles
      WHERE user_id = (row_data ->> 'user_id')::uuid
      LIMIT 1;
    ELSIF TG_TABLE_NAME = 'hr_documents'
      AND row_data ? 'employee_id'
      AND NULLIF(row_data ->> 'employee_id', '') IS NOT NULL THEN
      SELECT agence_id INTO NEW.agence_id
      FROM public.hr_employees
      WHERE id = (row_data ->> 'employee_id')::uuid
      LIMIT 1;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
-- 1) Ajouter la valeur 'agent' à l'enum app_role si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'agent'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'agent';
  END IF;
END$$;

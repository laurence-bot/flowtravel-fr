
DO $$ BEGIN
  CREATE TYPE public.facture_client_type AS ENUM ('acompte_1','acompte_2','solde','globale');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.factures_clients
  ADD COLUMN IF NOT EXISTS type_facture public.facture_client_type NOT NULL DEFAULT 'globale',
  ADD COLUMN IF NOT EXISTS pct_applique numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS ordre integer NOT NULL DEFAULT 1;

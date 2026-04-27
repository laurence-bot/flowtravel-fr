-- 1. Extend cotation_statut enum
ALTER TYPE public.cotation_statut ADD VALUE IF NOT EXISTS 'en_cours';
ALTER TYPE public.cotation_statut ADD VALUE IF NOT EXISTS 'en_option';
ALTER TYPE public.cotation_statut ADD VALUE IF NOT EXISTS 'confirmee';
ALTER TYPE public.cotation_statut ADD VALUE IF NOT EXISTS 'annulee';

-- 2. Enums pour les options
DO $$ BEGIN
  CREATE TYPE public.fournisseur_option_statut AS ENUM (
    'a_demander', 'demandee', 'option_confirmee', 'option_refusee',
    'option_expiree', 'annulee', 'confirmee'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.flight_option_statut AS ENUM (
    'en_option', 'confirmee', 'expiree', 'annulee'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Table fournisseur_options
CREATE TABLE IF NOT EXISTS public.fournisseur_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cotation_id uuid NOT NULL,
  ligne_fournisseur_id uuid,
  fournisseur_id uuid,
  nom_fournisseur text NOT NULL,
  email_fournisseur text,
  prestation text,
  statut public.fournisseur_option_statut NOT NULL DEFAULT 'a_demander',
  deadline_option_date date,
  deadline_option_time time,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fournisseur_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_fournisseur_options_all" ON public.fournisseur_options
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER fournisseur_options_set_updated_at
  BEFORE UPDATE ON public.fournisseur_options
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_fournisseur_options_cotation ON public.fournisseur_options(cotation_id);
CREATE INDEX IF NOT EXISTS idx_fournisseur_options_user ON public.fournisseur_options(user_id);

-- 4. Table flight_options
CREATE TABLE IF NOT EXISTS public.flight_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cotation_id uuid NOT NULL,
  compagnie text NOT NULL,
  routing text NOT NULL,
  numero_vol text,
  date_depart date,
  heure_depart time,
  date_retour date,
  heure_retour time,
  prix numeric NOT NULL DEFAULT 0,
  devise public.devise_code NOT NULL DEFAULT 'EUR',
  deadline_option_date date,
  deadline_option_time time,
  statut public.flight_option_statut NOT NULL DEFAULT 'en_option',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flight_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_flight_options_all" ON public.flight_options
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER flight_options_set_updated_at
  BEFORE UPDATE ON public.flight_options
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_flight_options_cotation ON public.flight_options(cotation_id);
CREATE INDEX IF NOT EXISTS idx_flight_options_user ON public.flight_options(user_id);

-- 5. Étendre l'audit
ALTER TYPE public.audit_entity ADD VALUE IF NOT EXISTS 'fournisseur_option';
ALTER TYPE public.audit_entity ADD VALUE IF NOT EXISTS 'flight_option';
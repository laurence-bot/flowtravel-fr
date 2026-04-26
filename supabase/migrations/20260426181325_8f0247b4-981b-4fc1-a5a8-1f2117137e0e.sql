-- Enum for bank
CREATE TYPE public.compte_banque AS ENUM ('sg', 'cic', 'ebury', 'autre');
CREATE TYPE public.compte_categorie AS ENUM ('gestion', 'anticipation', 'clients', 'fournisseurs', 'plateforme');

-- Comptes table
CREATE TABLE public.comptes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nom TEXT NOT NULL,
  banque public.compte_banque NOT NULL,
  categorie public.compte_categorie NOT NULL,
  solde_initial NUMERIC NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comptes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_comptes_all" ON public.comptes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_comptes_updated_at
  BEFORE UPDATE ON public.comptes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Transferts internes
CREATE TABLE public.transferts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  compte_source_id UUID NOT NULL,
  compte_destination_id UUID NOT NULL,
  montant NUMERIC NOT NULL CHECK (montant > 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  libelle TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (compte_source_id <> compte_destination_id)
);

ALTER TABLE public.transferts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_transferts_all" ON public.transferts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add compte_id to paiements
ALTER TABLE public.paiements ADD COLUMN compte_id UUID;
CREATE INDEX idx_paiements_compte_id ON public.paiements(compte_id);
CREATE INDEX idx_transferts_user_id ON public.transferts(user_id);
CREATE INDEX idx_comptes_user_id ON public.comptes(user_id);

-- Enums
CREATE TYPE public.contact_type AS ENUM ('client', 'fournisseur');
CREATE TYPE public.dossier_statut AS ENUM ('brouillon', 'confirme', 'cloture');
CREATE TYPE public.paiement_type AS ENUM ('paiement_client', 'paiement_fournisseur');
CREATE TYPE public.paiement_source AS ENUM ('banque', 'manuel');
CREATE TYPE public.paiement_methode AS ENUM ('virement', 'carte', 'especes');

-- Contacts (clients & fournisseurs)
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  type contact_type NOT NULL,
  email TEXT,
  telephone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dossiers
CREATE TABLE public.dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  titre TEXT NOT NULL,
  statut dossier_statut NOT NULL DEFAULT 'brouillon',
  prix_vente NUMERIC(12,2) NOT NULL DEFAULT 0,
  cout_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Paiements
CREATE TABLE public.paiements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dossier_id UUID REFERENCES public.dossiers(id) ON DELETE SET NULL,
  personne_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  montant NUMERIC(12,2) NOT NULL,
  type paiement_type NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  source paiement_source NOT NULL DEFAULT 'manuel',
  methode paiement_methode NOT NULL DEFAULT 'virement',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Factures fournisseurs
CREATE TABLE public.factures_fournisseurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fournisseur_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  dossier_id UUID REFERENCES public.dossiers(id) ON DELETE SET NULL,
  montant NUMERIC(12,2) NOT NULL,
  date_echeance DATE,
  paye BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_contacts_user ON public.contacts(user_id);
CREATE INDEX idx_dossiers_user ON public.dossiers(user_id);
CREATE INDEX idx_dossiers_client ON public.dossiers(client_id);
CREATE INDEX idx_paiements_user ON public.paiements(user_id);
CREATE INDEX idx_paiements_dossier ON public.paiements(dossier_id);
CREATE INDEX idx_factures_user ON public.factures_fournisseurs(user_id);
CREATE INDEX idx_factures_dossier ON public.factures_fournisseurs(dossier_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_dossiers_updated BEFORE UPDATE ON public.dossiers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_factures_updated BEFORE UPDATE ON public.factures_fournisseurs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paiements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factures_fournisseurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_contacts_all" ON public.contacts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_dossiers_all" ON public.dossiers FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_paiements_all" ON public.paiements FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_factures_all" ON public.factures_fournisseurs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

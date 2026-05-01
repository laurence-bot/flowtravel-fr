-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE bulletin_statut AS ENUM ('a_signer','signe','annule');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE facture_client_statut AS ENUM ('brouillon','emise','payee','annulee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE carnet_statut AS ENUM ('brouillon','publie');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE mariage_contribution_statut AS ENUM ('en_attente','paye','annule');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ BULLETINS ============
CREATE TABLE IF NOT EXISTS public.bulletins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agent_id uuid,
  cotation_id uuid,
  dossier_id uuid,
  client_id uuid,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24),'hex'),
  statut bulletin_statut NOT NULL DEFAULT 'a_signer',
  voyageurs jsonb NOT NULL DEFAULT '[]'::jsonb,
  conditions_text text,
  conditions_acceptees boolean NOT NULL DEFAULT false,
  signature_data text,         -- dataURL PNG de la signature
  signataire_nom text,
  signataire_email text,
  signed_at timestamptz,
  signed_ip text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bulletins_user ON public.bulletins(user_id);
CREATE INDEX IF NOT EXISTS idx_bulletins_token ON public.bulletins(token);

ALTER TABLE public.bulletins ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_bulletins_all ON public.bulletins FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY public_bulletins_read_via_token ON public.bulletins FOR SELECT TO anon, authenticated
  USING (expires_at > now());
CREATE POLICY public_bulletins_sign_via_token ON public.bulletins FOR UPDATE TO anon, authenticated
  USING (expires_at > now() AND statut = 'a_signer')
  WITH CHECK (expires_at > now());

CREATE TRIGGER trg_bulletins_updated BEFORE UPDATE ON public.bulletins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ FACTURES CLIENTS ============
CREATE TABLE IF NOT EXISTS public.factures_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agent_id uuid,
  numero text NOT NULL,
  client_id uuid,
  cotation_id uuid,
  dossier_id uuid,
  bulletin_id uuid REFERENCES public.bulletins(id) ON DELETE SET NULL,
  date_emission date NOT NULL DEFAULT CURRENT_DATE,
  date_echeance date,
  montant_ht numeric NOT NULL DEFAULT 0,
  montant_tva numeric NOT NULL DEFAULT 0,
  montant_ttc numeric NOT NULL DEFAULT 0,
  taux_tva numeric NOT NULL DEFAULT 20,
  regime_tva text,
  statut facture_client_statut NOT NULL DEFAULT 'brouillon',
  notes text,
  pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, numero)
);
CREATE INDEX IF NOT EXISTS idx_factures_clients_user ON public.factures_clients(user_id);
CREATE INDEX IF NOT EXISTS idx_factures_clients_dossier ON public.factures_clients(dossier_id);

ALTER TABLE public.factures_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_factures_clients_all ON public.factures_clients FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_factures_clients_updated BEFORE UPDATE ON public.factures_clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ CARNETS DE VOYAGE ============
CREATE TABLE IF NOT EXISTS public.carnets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agent_id uuid,
  dossier_id uuid,
  cotation_id uuid,
  client_id uuid,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24),'hex'),
  titre text NOT NULL,
  destination text,
  date_debut date,
  date_fin date,
  hero_image_url text,
  intro_text text,
  jours jsonb NOT NULL DEFAULT '[]'::jsonb,    -- [{date,titre,lieu,description,images:[],contacts:[]}]
  infos_pratiques jsonb NOT NULL DEFAULT '{}'::jsonb,
  contacts_urgence jsonb NOT NULL DEFAULT '[]'::jsonb,
  theme text DEFAULT 'classic',
  statut carnet_statut NOT NULL DEFAULT 'brouillon',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '365 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_carnets_user ON public.carnets(user_id);
CREATE INDEX IF NOT EXISTS idx_carnets_token ON public.carnets(token);

ALTER TABLE public.carnets ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_carnets_all ON public.carnets FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY public_carnets_read_via_token ON public.carnets FOR SELECT TO anon, authenticated
  USING (statut = 'publie' AND expires_at > now());

CREATE TRIGGER trg_carnets_updated BEFORE UPDATE ON public.carnets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ LISTE DE MARIAGE ============
ALTER TABLE public.cotations ADD COLUMN IF NOT EXISTS est_liste_mariage boolean NOT NULL DEFAULT false;
ALTER TABLE public.cotations ADD COLUMN IF NOT EXISTS mariage_titre text;
ALTER TABLE public.cotations ADD COLUMN IF NOT EXISTS mariage_message text;
ALTER TABLE public.cotations ADD COLUMN IF NOT EXISTS mariage_objectif numeric;

CREATE TABLE IF NOT EXISTS public.mariage_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cotation_id uuid NOT NULL,
  invite_prenom text NOT NULL,
  invite_nom text NOT NULL,
  invite_email text,
  invite_telephone text,
  montant numeric NOT NULL,
  devise text NOT NULL DEFAULT 'EUR',
  message text,
  statut mariage_contribution_statut NOT NULL DEFAULT 'en_attente',
  date_paiement timestamptz,
  email_couple_envoye_at timestamptz,
  email_invite_envoye_at timestamptz,
  payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mariage_contrib_cotation ON public.mariage_contributions(cotation_id);
CREATE INDEX IF NOT EXISTS idx_mariage_contrib_user ON public.mariage_contributions(user_id);

ALTER TABLE public.mariage_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_mariage_contrib_all ON public.mariage_contributions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Lecture publique via le token public du devis (pour afficher la jauge)
CREATE POLICY public_mariage_contrib_read_via_token ON public.mariage_contributions FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.quote_public_links qpl
                 WHERE qpl.cotation_id = mariage_contributions.cotation_id
                   AND qpl.expires_at > now()));
-- Insertion publique via le token public du devis (un invité peut contribuer)
CREATE POLICY public_mariage_contrib_insert_via_token ON public.mariage_contributions FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.quote_public_links qpl
                      WHERE qpl.cotation_id = mariage_contributions.cotation_id
                        AND qpl.expires_at > now()));

CREATE TRIGGER trg_mariage_contrib_updated BEFORE UPDATE ON public.mariage_contributions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
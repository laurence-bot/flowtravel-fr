-- Enums
CREATE TYPE public.cotation_statut AS ENUM (
  'brouillon', 'envoyee', 'validee', 'perdue', 'transformee_en_dossier', 'archivee'
);

CREATE TYPE public.cotation_regime_tva AS ENUM ('marge_ue', 'hors_ue');

CREATE TYPE public.cotation_ligne_mode_tarifaire AS ENUM ('global', 'par_personne');

-- Étendre l'enum d'audit existant
ALTER TYPE public.audit_entity ADD VALUE IF NOT EXISTS 'cotation';
ALTER TYPE public.audit_entity ADD VALUE IF NOT EXISTS 'cotation_ligne';

-- Table cotations
CREATE TABLE public.cotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid,
  group_id uuid NOT NULL DEFAULT gen_random_uuid(),
  version_number int NOT NULL DEFAULT 1,
  titre text NOT NULL,
  destination text,
  tags_destination text[] NOT NULL DEFAULT '{}',
  langue text,
  date_depart date,
  date_retour date,
  nombre_pax int NOT NULL DEFAULT 1,
  nombre_chambres int NOT NULL DEFAULT 1,
  prix_vente_ht numeric NOT NULL DEFAULT 0,
  prix_vente_ttc numeric NOT NULL DEFAULT 0,
  prix_vente_usd numeric,
  regime_tva public.cotation_regime_tva NOT NULL DEFAULT 'hors_ue',
  taux_tva_marge numeric NOT NULL DEFAULT 20,
  statut public.cotation_statut NOT NULL DEFAULT 'brouillon',
  raison_perte text,
  dossier_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY own_cotations_all ON public.cotations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_cotations_user ON public.cotations(user_id);
CREATE INDEX idx_cotations_client ON public.cotations(client_id);
CREATE INDEX idx_cotations_group ON public.cotations(group_id);
CREATE INDEX idx_cotations_statut ON public.cotations(statut);

CREATE TRIGGER trg_cotations_updated_at
  BEFORE UPDATE ON public.cotations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Table lignes fournisseurs
CREATE TABLE public.cotation_lignes_fournisseurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cotation_id uuid NOT NULL REFERENCES public.cotations(id) ON DELETE CASCADE,
  fournisseur_id uuid,
  nom_fournisseur text NOT NULL,
  payeur text,
  prestation text,
  date_prestation date,
  mode_tarifaire public.cotation_ligne_mode_tarifaire NOT NULL DEFAULT 'global',
  quantite numeric NOT NULL DEFAULT 1,
  devise public.devise_code NOT NULL DEFAULT 'EUR',
  montant_devise numeric NOT NULL DEFAULT 0,
  taux_change_vers_eur numeric NOT NULL DEFAULT 1,
  montant_eur numeric NOT NULL DEFAULT 0,
  source_fx public.fx_source NOT NULL DEFAULT 'taux_du_jour',
  couverture_id uuid,
  pct_acompte_1 numeric NOT NULL DEFAULT 30,
  pct_acompte_2 numeric NOT NULL DEFAULT 0,
  pct_acompte_3 numeric NOT NULL DEFAULT 0,
  pct_solde numeric NOT NULL DEFAULT 70,
  date_acompte_1 date,
  date_acompte_2 date,
  date_acompte_3 date,
  date_solde date,
  notes text,
  ordre int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cotation_lignes_fournisseurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY own_cotation_lignes_all ON public.cotation_lignes_fournisseurs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_cot_lignes_cotation ON public.cotation_lignes_fournisseurs(cotation_id);
CREATE INDEX idx_cot_lignes_user ON public.cotation_lignes_fournisseurs(user_id);

CREATE TRIGGER trg_cot_lignes_updated_at
  BEFORE UPDATE ON public.cotation_lignes_fournisseurs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
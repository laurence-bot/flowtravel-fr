-- Remises carte bancaire : le paiement client brut reste distinct du net bancaire.
CREATE TABLE public.remises_cb (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agence_id uuid,
  compte_id uuid REFERENCES public.comptes(id) ON DELETE SET NULL,
  bank_transaction_id uuid REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  reference_remise text NOT NULL,
  date_remise date NOT NULL,
  date_credit_banque date,
  acquereur text NOT NULL DEFAULT 'Transactis SG',
  code_banque text,
  devise public.devise_code NOT NULL DEFAULT 'EUR',
  nombre_transactions integer NOT NULL DEFAULT 1 CHECK (nombre_transactions > 0),
  montant_brut numeric(14,2) NOT NULL,
  montant_net_recu numeric(14,2),
  commission_bancaire numeric(14,2) GENERATED ALWAYS AS (
    CASE
      WHEN montant_net_recu IS NULL THEN NULL
      ELSE round(montant_brut - montant_net_recu, 2)
    END
  ) STORED,
  statut text NOT NULL DEFAULT 'a_rapprocher'
    CHECK (statut IN ('a_rapprocher', 'rapproche', 'partiel')),
  source_fichier text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, reference_remise, date_remise),
  CHECK (montant_net_recu IS NULL OR montant_brut - montant_net_recu >= 0)
);

CREATE TABLE public.remise_cb_paiements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agence_id uuid,
  remise_cb_id uuid NOT NULL REFERENCES public.remises_cb(id) ON DELETE CASCADE,
  paiement_id uuid NOT NULL REFERENCES public.paiements(id) ON DELETE CASCADE,
  montant_brut_affecte numeric(14,2) NOT NULL CHECK (montant_brut_affecte > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (remise_cb_id, paiement_id)
);

CREATE INDEX idx_remises_cb_user_date ON public.remises_cb(user_id, date_remise DESC);
CREATE INDEX idx_remises_cb_agence_date ON public.remises_cb(agence_id, date_remise DESC);
CREATE INDEX idx_remise_cb_paiements_remise ON public.remise_cb_paiements(remise_cb_id);
CREATE INDEX idx_remise_cb_paiements_paiement ON public.remise_cb_paiements(paiement_id);

ALTER TABLE public.remises_cb ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remise_cb_paiements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_remises_cb_all"
ON public.remises_cb
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own_remise_cb_paiements_all"
ON public.remise_cb_paiements
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_remises_cb_updated_at
  BEFORE UPDATE ON public.remises_cb
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

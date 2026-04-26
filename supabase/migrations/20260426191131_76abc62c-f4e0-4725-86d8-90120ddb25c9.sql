-- Enum statut rapprochement
CREATE TYPE public.rapprochement_statut AS ENUM ('suggere', 'valide', 'rejete');
CREATE TYPE public.paiement_statut_rapprochement AS ENUM ('non_rapproche', 'rapproche');

-- Ajout sur paiements
ALTER TABLE public.paiements
  ADD COLUMN statut_rapprochement public.paiement_statut_rapprochement NOT NULL DEFAULT 'non_rapproche',
  ADD COLUMN bank_transaction_id uuid;

CREATE INDEX idx_paiements_bank_transaction ON public.paiements(bank_transaction_id);
CREATE UNIQUE INDEX uniq_paiement_bank_transaction
  ON public.paiements(bank_transaction_id)
  WHERE bank_transaction_id IS NOT NULL;

-- Table rapprochements
CREATE TABLE public.rapprochements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bank_transaction_id uuid NOT NULL,
  paiement_id uuid NOT NULL,
  score numeric NOT NULL DEFAULT 0,
  statut public.rapprochement_statut NOT NULL DEFAULT 'suggere',
  raison text,
  created_at timestamptz NOT NULL DEFAULT now(),
  validated_at timestamptz
);

CREATE INDEX idx_rapprochements_user ON public.rapprochements(user_id);
CREATE INDEX idx_rapprochements_bank_tx ON public.rapprochements(bank_transaction_id);
CREATE INDEX idx_rapprochements_paiement ON public.rapprochements(paiement_id);

-- Une transaction ne peut être validée qu'avec un seul paiement
CREATE UNIQUE INDEX uniq_rapprochement_bank_tx_valide
  ON public.rapprochements(bank_transaction_id)
  WHERE statut = 'valide';

-- Un paiement ne peut être validé qu'avec une seule transaction
CREATE UNIQUE INDEX uniq_rapprochement_paiement_valide
  ON public.rapprochements(paiement_id)
  WHERE statut = 'valide';

ALTER TABLE public.rapprochements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_rapprochements_all"
ON public.rapprochements
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
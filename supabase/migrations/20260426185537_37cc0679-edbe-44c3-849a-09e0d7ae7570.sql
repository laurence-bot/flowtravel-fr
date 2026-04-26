-- Enums
CREATE TYPE public.bank_sens AS ENUM ('credit', 'debit');
CREATE TYPE public.bank_source AS ENUM ('sg', 'cic', 'ebury');
CREATE TYPE public.bank_statut AS ENUM ('nouveau', 'rapproche', 'ignore');

-- Table
CREATE TABLE public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  compte_id uuid NOT NULL,
  date date NOT NULL,
  libelle_original text NOT NULL,
  libelle_normalise text NOT NULL,
  montant numeric NOT NULL,
  sens public.bank_sens NOT NULL,
  source_banque public.bank_source NOT NULL,
  hash_unique text NOT NULL,
  statut public.bank_statut NOT NULL DEFAULT 'nouveau',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, hash_unique)
);

CREATE INDEX idx_bank_tx_user_compte ON public.bank_transactions(user_id, compte_id);
CREATE INDEX idx_bank_tx_date ON public.bank_transactions(date DESC);

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_bank_tx_all"
ON public.bank_transactions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
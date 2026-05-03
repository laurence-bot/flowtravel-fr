-- Lot 7 : suivi devis-paiement + page notifs

-- 1) Colonnes pour distinguer "validation devis" et "déclaration de paiement"
ALTER TABLE public.quote_public_links
  ADD COLUMN IF NOT EXISTS payment_declared_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_relance_acompte_at timestamptz;

-- 2) Index utile pour le cron de relance
CREATE INDEX IF NOT EXISTS idx_quote_links_relance_acompte
  ON public.quote_public_links (accepted_at)
  WHERE payment_declared_at IS NULL;

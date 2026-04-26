-- Enums
CREATE TYPE public.audit_action AS ENUM (
  'create', 'update', 'delete', 'validate', 'reject', 'import', 'export'
);

CREATE TYPE public.audit_entity AS ENUM (
  'dossier', 'paiement', 'facture_fournisseur', 'compte',
  'transfert', 'bank_transaction', 'rapprochement', 'export_comptable'
);

-- Table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity_type public.audit_entity NOT NULL,
  entity_id uuid,
  action public.audit_action NOT NULL,
  description text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_user_created ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);

-- RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_audit_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "own_audit_insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Pas de policy UPDATE ni DELETE => logs immuables
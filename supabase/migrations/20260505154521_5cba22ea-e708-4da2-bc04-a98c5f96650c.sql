CREATE TABLE IF NOT EXISTS public.hr_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  agence_id uuid,
  categorie text NOT NULL CHECK (categorie IN (
    'contrat', 'avenant', 'deplacement', 'formation',
    'evaluation', 'disciplinaire', 'medical', 'administratif', 'autre'
  )),
  titre text NOT NULL,
  description text,
  pdf_url text,
  date_document date,
  necessite_signature boolean DEFAULT false,
  statut text NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'a_signer', 'signe', 'archive')),
  token uuid DEFAULT gen_random_uuid(),
  signed_at timestamptz,
  signataire_nom text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.hr_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins agence gèrent les documents RH"
  ON public.hr_documents
  FOR ALL
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_agence_admin(agence_id)
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.is_agence_admin(agence_id)
  );

CREATE POLICY "Employés voient leurs propres documents"
  ON public.hr_documents
  FOR SELECT
  USING (
    employee_id IN (
      SELECT id FROM public.hr_employees WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_hr_documents_employee ON public.hr_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_documents_token ON public.hr_documents(token);

CREATE TRIGGER hr_documents_set_updated_at
  BEFORE UPDATE ON public.hr_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER hr_documents_set_agence_id
  BEFORE INSERT ON public.hr_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_agence_id_from_user();
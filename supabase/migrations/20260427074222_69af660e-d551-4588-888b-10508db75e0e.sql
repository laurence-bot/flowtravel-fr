
-- Bucket de stockage privé pour les PDFs importés
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('pdf-imports', 'pdf-imports', false, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- RLS policies storage.objects pour pdf-imports : path = {user_id}/...
CREATE POLICY "pdf_imports_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'pdf-imports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "pdf_imports_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'pdf-imports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "pdf_imports_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'pdf-imports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "pdf_imports_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'pdf-imports' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Type d'import
CREATE TYPE public.pdf_import_type AS ENUM ('contrat_fournisseur', 'couverture_fx');
CREATE TYPE public.pdf_import_statut AS ENUM ('extrait', 'valide', 'annule', 'erreur');
CREATE TYPE public.pdf_import_confiance AS ENUM ('faible', 'moyenne', 'elevee');

-- Table de journal des imports PDF
CREATE TABLE public.pdf_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type public.pdf_import_type NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  raw_text text,
  extracted_data jsonb,
  confiance public.pdf_import_confiance NOT NULL DEFAULT 'moyenne',
  statut public.pdf_import_statut NOT NULL DEFAULT 'extrait',
  facture_fournisseur_id uuid,
  fx_coverage_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pdf_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_pdf_imports_all"
ON public.pdf_imports FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_pdf_imports_updated_at
BEFORE UPDATE ON public.pdf_imports
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Étendre l'enum audit_entity pour inclure pdf_import
ALTER TYPE public.audit_entity ADD VALUE IF NOT EXISTS 'pdf_import';

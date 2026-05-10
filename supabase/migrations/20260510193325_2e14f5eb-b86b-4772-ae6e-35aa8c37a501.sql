ALTER TABLE public.hr_documents DROP CONSTRAINT IF EXISTS hr_documents_categorie_check;
ALTER TABLE public.hr_documents ADD CONSTRAINT hr_documents_categorie_check
  CHECK (categorie = ANY (ARRAY['contrat','avenant','bulletin_paie','deplacement','formation','evaluation','disciplinaire','medical','administratif','autre']::text[]));
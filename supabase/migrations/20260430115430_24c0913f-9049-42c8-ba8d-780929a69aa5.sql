-- Élargir aux rôles public pour couvrir tous les cas (anon + non authentifié)
DROP POLICY IF EXISTS "agence_docs_pending_insert_public" ON storage.objects;
DROP POLICY IF EXISTS "agence_docs_pending_update_public" ON storage.objects;
DROP POLICY IF EXISTS "agence_docs_public_upload" ON storage.objects;

CREATE POLICY "agence_docs_pending_insert_all"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'agence-documents'
  AND (storage.foldername(name))[1] = 'pending'
);

CREATE POLICY "agence_docs_pending_update_all"
ON storage.objects
FOR UPDATE
TO public
USING (
  bucket_id = 'agence-documents'
  AND (storage.foldername(name))[1] = 'pending'
)
WITH CHECK (
  bucket_id = 'agence-documents'
  AND (storage.foldername(name))[1] = 'pending'
);

CREATE POLICY "agence_docs_pending_select_all"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'agence-documents'
  AND (storage.foldername(name))[1] = 'pending'
);
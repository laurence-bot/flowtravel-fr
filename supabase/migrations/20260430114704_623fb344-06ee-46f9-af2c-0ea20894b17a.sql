-- Permettre aux visiteurs anonymes (et authentifiés) d'uploader leurs justificatifs
-- dans le sous-dossier "pending/" du bucket agence-documents lors de l'inscription.
-- La lecture reste réservée au super-admin (via signed URLs côté serveur).

CREATE POLICY "agence_docs_pending_insert_public"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'agence-documents'
  AND (storage.foldername(name))[1] = 'pending'
);

-- Autoriser aussi l'update (upsert: true dans le code) sur les fichiers en pending
CREATE POLICY "agence_docs_pending_update_public"
ON storage.objects
FOR UPDATE
TO anon, authenticated
USING (
  bucket_id = 'agence-documents'
  AND (storage.foldername(name))[1] = 'pending'
)
WITH CHECK (
  bucket_id = 'agence-documents'
  AND (storage.foldername(name))[1] = 'pending'
);

-- Le super-admin peut tout lire/gérer dans agence-documents
CREATE POLICY "agence_docs_super_admin_all"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'agence-documents'
  AND public.is_super_admin(auth.uid())
)
WITH CHECK (
  bucket_id = 'agence-documents'
  AND public.is_super_admin(auth.uid())
);
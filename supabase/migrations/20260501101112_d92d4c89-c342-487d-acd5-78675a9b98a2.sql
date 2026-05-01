-- Rendre le bucket demo-videos public en lecture pour permettre l'affichage de la vidéo de présentation sur la home
UPDATE storage.buckets SET public = true WHERE id = 'demo-videos';

-- Politique de lecture publique
DROP POLICY IF EXISTS "demo_videos_public_read" ON storage.objects;
CREATE POLICY "demo_videos_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'demo-videos');
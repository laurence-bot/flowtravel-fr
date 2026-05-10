ALTER TABLE public.hr_documents ADD COLUMN IF NOT EXISTS sent_at timestamptz;

UPDATE public.hr_documents
SET statut = 'signe', necessite_signature = false
WHERE categorie = 'bulletin_paie' AND statut = 'brouillon';
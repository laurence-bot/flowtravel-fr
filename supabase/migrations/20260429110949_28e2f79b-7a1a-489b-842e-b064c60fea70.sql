
-- 1. Étendre agency_settings avec la charte graphique complète
ALTER TABLE public.agency_settings
  ADD COLUMN IF NOT EXISTS brand_baseline text,
  ADD COLUMN IF NOT EXISTS brand_signature_quote text,
  ADD COLUMN IF NOT EXISTS pdf_footer_text text,
  ADD COLUMN IF NOT EXISTS cgv_text text,
  ADD COLUMN IF NOT EXISTS logo_dark_url text,
  ADD COLUMN IF NOT EXISTS logo_symbol_url text,
  ADD COLUMN IF NOT EXISTS favicon_url text,
  ADD COLUMN IF NOT EXISTS color_primary text DEFAULT '#0B0B0B',
  ADD COLUMN IF NOT EXISTS color_signature text DEFAULT '#A14E2C',
  ADD COLUMN IF NOT EXISTS color_ornament text DEFAULT '#C9A96E',
  ADD COLUMN IF NOT EXISTS color_background text DEFAULT '#F5F1E8',
  ADD COLUMN IF NOT EXISTS color_muted text DEFAULT '#EAE3D6',
  ADD COLUMN IF NOT EXISTS color_secondary text DEFAULT '#6A6F4C',
  ADD COLUMN IF NOT EXISTS font_heading text DEFAULT 'Cormorant Garamond',
  ADD COLUMN IF NOT EXISTS font_body text DEFAULT 'Inter',
  ADD COLUMN IF NOT EXISTS public_subdomain_slug text;

-- 2. Étendre cotations avec hero, storytelling, inclus/non inclus
ALTER TABLE public.cotations
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS storytelling_intro text,
  ADD COLUMN IF NOT EXISTS inclus_text text,
  ADD COLUMN IF NOT EXISTS non_inclus_text text;

-- 3. Table cotation_jours (timeline itinéraire)
CREATE TABLE IF NOT EXISTS public.cotation_jours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cotation_id uuid NOT NULL,
  ordre integer NOT NULL DEFAULT 1,
  titre text NOT NULL,
  description text,
  lieu text,
  date_jour date,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cotation_jours_cotation ON public.cotation_jours(cotation_id, ordre);

ALTER TABLE public.cotation_jours ENABLE ROW LEVEL SECURITY;

CREATE POLICY own_cotation_jours_all
  ON public.cotation_jours
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_cotation_jours_updated_at
  BEFORE UPDATE ON public.cotation_jours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Table quote_public_links (liens partageables sécurisés)
CREATE TABLE IF NOT EXISTS public.quote_public_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cotation_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  viewed_at timestamptz,
  accepted_at timestamptz,
  callback_requested_at timestamptz,
  modification_requested_at timestamptz,
  modification_request_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_public_links_token ON public.quote_public_links(token);
CREATE INDEX IF NOT EXISTS idx_quote_public_links_cotation ON public.quote_public_links(cotation_id);

ALTER TABLE public.quote_public_links ENABLE ROW LEVEL SECURITY;

-- L'agence propriétaire gère ses liens
CREATE POLICY own_quote_links_all
  ON public.quote_public_links
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Lecture publique anonyme par token non expiré (page client /p/$token)
CREATE POLICY public_quote_links_read
  ON public.quote_public_links
  FOR SELECT
  TO anon, authenticated
  USING (expires_at > now());

-- Mise à jour publique des champs d'interaction client (vue, acceptation, rappel)
CREATE POLICY public_quote_links_interact
  ON public.quote_public_links
  FOR UPDATE
  TO anon, authenticated
  USING (expires_at > now())
  WITH CHECK (expires_at > now());

CREATE TRIGGER trg_quote_public_links_updated_at
  BEFORE UPDATE ON public.quote_public_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Lecture publique cotations + jours via token actif
-- Politique : si un token actif existe pour la cotation, lecture autorisée
CREATE POLICY public_cotations_read_via_token
  ON public.cotations
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quote_public_links qpl
      WHERE qpl.cotation_id = cotations.id
        AND qpl.expires_at > now()
    )
  );

CREATE POLICY public_cotation_jours_read_via_token
  ON public.cotation_jours
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quote_public_links qpl
      WHERE qpl.cotation_id = cotation_jours.cotation_id
        AND qpl.expires_at > now()
    )
  );

CREATE POLICY public_cotation_lignes_read_via_token
  ON public.cotation_lignes_fournisseurs
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quote_public_links qpl
      WHERE qpl.cotation_id = cotation_lignes_fournisseurs.cotation_id
        AND qpl.expires_at > now()
    )
  );

-- Lecture publique de l'agence (pour appliquer la charte sur la page client)
CREATE POLICY public_agency_settings_read_via_token
  ON public.agency_settings
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quote_public_links qpl
      JOIN public.cotations c ON c.id = qpl.cotation_id
      WHERE c.user_id = agency_settings.user_id
        AND qpl.expires_at > now()
    )
  );

-- Lecture publique du contact client (nom uniquement)
CREATE POLICY public_contacts_read_via_token
  ON public.contacts
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quote_public_links qpl
      JOIN public.cotations c ON c.id = qpl.cotation_id
      WHERE c.client_id = contacts.id
        AND qpl.expires_at > now()
    )
  );

-- 6. Bucket public quote-images
INSERT INTO storage.buckets (id, name, public)
VALUES ('quote-images', 'quote-images', true)
ON CONFLICT (id) DO NOTHING;

-- Lecture publique
CREATE POLICY "quote_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'quote-images');

-- Upload limité à l'agence propriétaire (premier segment du path = user_id)
CREATE POLICY "quote_images_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'quote-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "quote_images_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'quote-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "quote_images_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'quote-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

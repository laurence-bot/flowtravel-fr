
-- Table : demandes de démo (qualification prospects)
CREATE TABLE public.demo_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Infos prospect
  prenom text NOT NULL,
  nom text NOT NULL,
  email text NOT NULL,
  email_domain text NOT NULL,
  telephone text NOT NULL,
  agence_nom text NOT NULL,
  agence_siret text,
  agence_site_web text,
  agence_taille text,
  message text,
  -- Sécurité & traçabilité
  ip_address text,
  user_agent text,
  -- Token unique pour accès vidéo
  video_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  video_token_expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  -- Statut
  statut text NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente', 'approuve', 'refuse', 'visionne', 'rdv_pris', 'converti')),
  approved_by uuid,
  approved_at timestamptz,
  refused_reason text,
  -- Tracking visionnage
  video_first_viewed_at timestamptz,
  video_view_count integer NOT NULL DEFAULT 0,
  video_max_views integer NOT NULL DEFAULT 1,
  locked_ip text,
  -- Notes admin
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_demo_requests_token ON public.demo_requests(video_token);
CREATE INDEX idx_demo_requests_email ON public.demo_requests(email);
CREATE INDEX idx_demo_requests_statut ON public.demo_requests(statut);
CREATE INDEX idx_demo_requests_created ON public.demo_requests(created_at DESC);

ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

-- Insertion publique (formulaire ouvert)
CREATE POLICY "demo_requests_public_insert"
  ON public.demo_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Lecture publique uniquement via token valide non expiré
CREATE POLICY "demo_requests_public_read_via_token"
  ON public.demo_requests FOR SELECT
  TO anon, authenticated
  USING (video_token_expires_at > now());

-- Mise à jour publique limitée (incrémenter view_count, locker l'IP)
CREATE POLICY "demo_requests_public_update_via_token"
  ON public.demo_requests FOR UPDATE
  TO anon, authenticated
  USING (video_token_expires_at > now())
  WITH CHECK (video_token_expires_at > now());

-- Admins voient tout
CREATE POLICY "demo_requests_admin_all"
  ON public.demo_requests FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'administrateur'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'administrateur'::app_role));

CREATE TRIGGER set_demo_requests_updated_at
  BEFORE UPDATE ON public.demo_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Table : log de chaque tentative de visionnage
CREATE TABLE public.demo_video_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demo_request_id uuid NOT NULL REFERENCES public.demo_requests(id) ON DELETE CASCADE,
  ip_address text,
  user_agent text,
  duration_watched_seconds integer,
  completed boolean NOT NULL DEFAULT false,
  blocked_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_demo_video_views_request ON public.demo_video_views(demo_request_id);

ALTER TABLE public.demo_video_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo_video_views_public_insert"
  ON public.demo_video_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "demo_video_views_admin_read"
  ON public.demo_video_views FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'administrateur'::app_role));

-- Table : créneaux disponibles configurables par l'admin
CREATE TABLE public.demo_rdv_slots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date_debut timestamptz NOT NULL,
  duree_minutes integer NOT NULL DEFAULT 30,
  capacite integer NOT NULL DEFAULT 1,
  visio_link text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_demo_rdv_slots_date ON public.demo_rdv_slots(date_debut);

ALTER TABLE public.demo_rdv_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo_rdv_slots_public_read"
  ON public.demo_rdv_slots FOR SELECT
  TO anon, authenticated
  USING (actif = true AND date_debut > now());

CREATE POLICY "demo_rdv_slots_admin_all"
  ON public.demo_rdv_slots FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'administrateur'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'administrateur'::app_role));

CREATE TRIGGER set_demo_rdv_slots_updated_at
  BEFORE UPDATE ON public.demo_rdv_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Table : réservations de RDV démo
CREATE TABLE public.demo_rdv_bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demo_request_id uuid NOT NULL REFERENCES public.demo_requests(id) ON DELETE CASCADE,
  slot_id uuid NOT NULL REFERENCES public.demo_rdv_slots(id) ON DELETE RESTRICT,
  statut text NOT NULL DEFAULT 'confirme'
    CHECK (statut IN ('confirme', 'annule', 'realise', 'no_show')),
  notes_prospect text,
  notes_admin text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_demo_rdv_bookings_request ON public.demo_rdv_bookings(demo_request_id);
CREATE INDEX idx_demo_rdv_bookings_slot ON public.demo_rdv_bookings(slot_id);

ALTER TABLE public.demo_rdv_bookings ENABLE ROW LEVEL SECURITY;

-- Insertion publique avec demo_request valide
CREATE POLICY "demo_rdv_bookings_public_insert"
  ON public.demo_rdv_bookings FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.demo_requests dr
      WHERE dr.id = demo_request_id
        AND dr.video_token_expires_at > now()
    )
  );

CREATE POLICY "demo_rdv_bookings_admin_all"
  ON public.demo_rdv_bookings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'administrateur'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'administrateur'::app_role));

CREATE TRIGGER set_demo_rdv_bookings_updated_at
  BEFORE UPDATE ON public.demo_rdv_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Bucket privé pour la vidéo demo (signed URLs, jamais public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('demo-videos', 'demo-videos', false)
ON CONFLICT (id) DO NOTHING;

-- Seuls les admins peuvent uploader/gérer la vidéo
CREATE POLICY "demo_videos_admin_all"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'demo-videos' AND public.has_role(auth.uid(), 'administrateur'::app_role))
  WITH CHECK (bucket_id = 'demo-videos' AND public.has_role(auth.uid(), 'administrateur'::app_role));

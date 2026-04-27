-- Enums
CREATE TYPE public.demande_canal AS ENUM ('email', 'telephone', 'site_web', 'whatsapp', 'recommandation', 'autre');
CREATE TYPE public.demande_statut AS ENUM ('nouvelle', 'en_cours', 'a_relancer', 'transformee_en_cotation', 'perdue');

-- Table demandes
CREATE TABLE public.demandes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID,
  nom_client TEXT NOT NULL,
  email TEXT,
  telephone TEXT,
  canal public.demande_canal NOT NULL DEFAULT 'email',
  destination TEXT,
  date_depart_souhaitee DATE,
  date_retour_souhaitee DATE,
  budget NUMERIC,
  nombre_pax INTEGER NOT NULL DEFAULT 1,
  message_client TEXT,
  statut public.demande_statut NOT NULL DEFAULT 'nouvelle',
  raison_perte TEXT,
  notes TEXT,
  dernier_contact_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_demandes_user ON public.demandes(user_id);
CREATE INDEX idx_demandes_client ON public.demandes(client_id);
CREATE INDEX idx_demandes_statut ON public.demandes(statut);

ALTER TABLE public.demandes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_demandes_all"
ON public.demandes
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER demandes_set_updated_at
BEFORE UPDATE ON public.demandes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Lien cotation -> demande
ALTER TABLE public.cotations ADD COLUMN demande_id UUID;
CREATE INDEX idx_cotations_demande ON public.cotations(demande_id);
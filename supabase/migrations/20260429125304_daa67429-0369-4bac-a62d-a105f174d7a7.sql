CREATE TABLE public.flight_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  flight_option_id uuid NOT NULL REFERENCES public.flight_options(id) ON DELETE CASCADE,
  ordre integer NOT NULL DEFAULT 1,
  compagnie text,
  numero_vol text,
  aeroport_depart text NOT NULL,
  date_depart date,
  heure_depart time,
  aeroport_arrivee text NOT NULL,
  date_arrivee date,
  heure_arrivee time,
  duree_escale_minutes integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flight_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_flight_segments_all"
  ON public.flight_segments
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "public_flight_segments_read_via_token"
  ON public.flight_segments
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.flight_options fo
      JOIN public.quote_public_links qpl ON qpl.cotation_id = fo.cotation_id
      WHERE fo.id = flight_segments.flight_option_id
        AND qpl.expires_at > now()
    )
  );

CREATE TRIGGER set_updated_at_flight_segments
  BEFORE UPDATE ON public.flight_segments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_flight_segments_flight_option_id ON public.flight_segments(flight_option_id);
CREATE INDEX idx_flight_segments_user_id ON public.flight_segments(user_id);
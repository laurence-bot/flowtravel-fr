-- Lot 5 : permettre au client de choisir une option de vol depuis le lien public
ALTER TABLE public.quote_public_links
  ADD COLUMN IF NOT EXISTS chosen_flight_option_id uuid,
  ADD COLUMN IF NOT EXISTS flight_chosen_at timestamp with time zone;

-- Lecture publique des options de vol via token
DROP POLICY IF EXISTS public_flight_options_read_via_token ON public.flight_options;
CREATE POLICY public_flight_options_read_via_token
ON public.flight_options
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quote_public_links qpl
    WHERE qpl.cotation_id = flight_options.cotation_id
      AND qpl.expires_at > now()
  )
);

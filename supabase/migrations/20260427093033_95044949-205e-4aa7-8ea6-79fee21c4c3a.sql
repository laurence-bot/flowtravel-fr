ALTER TYPE public.audit_entity ADD VALUE IF NOT EXISTS 'agency_settings';

CREATE TABLE public.agency_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  agency_name text,
  legal_name text,
  logo_url text,
  email text,
  phone text,
  website text,
  address text,
  city text,
  country text,
  siret text,
  vat_number text,
  primary_contact_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.agency_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_agency_settings_all"
  ON public.agency_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_agency_settings_updated_at
  BEFORE UPDATE ON public.agency_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO storage.buckets (id, name, public)
VALUES ('agency-logos', 'agency-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "agency_logos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'agency-logos');

CREATE POLICY "agency_logos_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'agency-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "agency_logos_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'agency-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "agency_logos_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'agency-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
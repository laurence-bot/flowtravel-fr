ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS pending_agence_id uuid REFERENCES public.agences(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_pending_agence
  ON public.user_profiles(pending_agence_id) WHERE pending_agence_id IS NOT NULL;
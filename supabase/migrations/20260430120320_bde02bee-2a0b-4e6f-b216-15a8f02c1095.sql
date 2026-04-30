-- ============================================
-- 1) Création du compte super-admin
-- ============================================
DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = 'bonjour@flowtravel.fr') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, recovery_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated',
      'bonjour@flowtravel.fr',
      crypt('FlowTravel2026!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}', '{"full_name":"Super Admin FlowTravel"}',
      now(), now(), '', '', '', ''
    );
    -- handle_new_user trigger se déclenchera automatiquement
  END IF;
END $$;

-- ============================================
-- 2) Table support_messages (messagerie)
-- ============================================
CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id uuid NOT NULL DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL,
  agence_id uuid,
  sujet text NOT NULL,
  contenu text NOT NULL,
  is_from_admin boolean NOT NULL DEFAULT false,
  lu_par_admin boolean NOT NULL DEFAULT false,
  lu_par_user boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_thread ON public.support_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_unread_admin ON public.support_messages(lu_par_admin) WHERE lu_par_admin = false;

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_select_super_admin"
  ON public.support_messages FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE POLICY "support_select_own"
  ON public.support_messages FOR SELECT TO authenticated
  USING (
    from_user_id = auth.uid()
    OR (agence_id IS NOT NULL AND agence_id = get_my_agence_id())
  );

CREATE POLICY "support_insert_authenticated"
  ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (
    from_user_id = auth.uid()
    AND (
      (is_from_admin = false AND is_super_admin(auth.uid()) = false)
      OR (is_from_admin = true AND is_super_admin(auth.uid()) = true)
    )
  );

CREATE POLICY "support_update_super_admin"
  ON public.support_messages FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "support_update_own_read_status"
  ON public.support_messages FOR UPDATE TO authenticated
  USING (from_user_id = auth.uid() OR (agence_id IS NOT NULL AND agence_id = get_my_agence_id()))
  WITH CHECK (from_user_id = auth.uid() OR (agence_id IS NOT NULL AND agence_id = get_my_agence_id()));

-- ============================================
-- 3) Table error_logs
-- ============================================
CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  agence_id uuid,
  level text NOT NULL DEFAULT 'error', -- error | warning | info
  source text NOT NULL, -- 'frontend' | 'backend' | 'auth' | etc
  message text NOT NULL,
  stack text,
  context jsonb,
  url text,
  user_agent text,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_errors_unresolved ON public.error_logs(created_at DESC) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_errors_level ON public.error_logs(level, created_at DESC);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "errors_select_super_admin"
  ON public.error_logs FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE POLICY "errors_insert_anyone"
  ON public.error_logs FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "errors_update_super_admin"
  ON public.error_logs FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Notifications agent (in-app)
CREATE TABLE IF NOT EXISTS public.agent_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  titre text NOT NULL,
  message text,
  link text,
  dossier_id uuid,
  cotation_id uuid,
  bulletin_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_notifs_user_unread
  ON public.agent_notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.agent_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_notifs_select_own"
ON public.agent_notifications
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "agent_notifs_update_own"
ON public.agent_notifications
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "agent_notifs_delete_own"
ON public.agent_notifications
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- (Pas de policy INSERT pour authenticated : insertions faites côté serveur via service role.)

-- Relance bulletins
ALTER TABLE public.bulletins
  ADD COLUMN IF NOT EXISTS last_relance_at timestamptz;

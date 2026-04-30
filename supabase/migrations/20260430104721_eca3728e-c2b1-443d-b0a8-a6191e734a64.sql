-- 1. Ajouter agent_id sur dossiers, cotations, demandes
ALTER TABLE public.dossiers   ADD COLUMN IF NOT EXISTS agent_id uuid;
ALTER TABLE public.cotations  ADD COLUMN IF NOT EXISTS agent_id uuid;
ALTER TABLE public.demandes   ADD COLUMN IF NOT EXISTS agent_id uuid;

-- 2. Rétro-remplir : par défaut, l'agent responsable = le créateur (user_id)
UPDATE public.dossiers   SET agent_id = user_id WHERE agent_id IS NULL;
UPDATE public.cotations  SET agent_id = user_id WHERE agent_id IS NULL;
UPDATE public.demandes   SET agent_id = user_id WHERE agent_id IS NULL;

-- 3. Trigger : si agent_id non fourni à l'insert, prendre user_id
CREATE OR REPLACE FUNCTION public.set_default_agent_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.agent_id IS NULL THEN
    NEW.agent_id := NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dossiers_default_agent  ON public.dossiers;
DROP TRIGGER IF EXISTS trg_cotations_default_agent ON public.cotations;
DROP TRIGGER IF EXISTS trg_demandes_default_agent  ON public.demandes;

CREATE TRIGGER trg_dossiers_default_agent
  BEFORE INSERT ON public.dossiers
  FOR EACH ROW EXECUTE FUNCTION public.set_default_agent_id();

CREATE TRIGGER trg_cotations_default_agent
  BEFORE INSERT ON public.cotations
  FOR EACH ROW EXECUTE FUNCTION public.set_default_agent_id();

CREATE TRIGGER trg_demandes_default_agent
  BEFORE INSERT ON public.demandes
  FOR EACH ROW EXECUTE FUNCTION public.set_default_agent_id();

-- 4. Index pour les agrégations CA par agent
CREATE INDEX IF NOT EXISTS idx_dossiers_agent_id  ON public.dossiers(agent_id);
CREATE INDEX IF NOT EXISTS idx_cotations_agent_id ON public.cotations(agent_id);
CREATE INDEX IF NOT EXISTS idx_demandes_agent_id  ON public.demandes(agent_id);
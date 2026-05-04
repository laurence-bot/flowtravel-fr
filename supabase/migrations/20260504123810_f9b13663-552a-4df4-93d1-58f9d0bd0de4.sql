
-- =====================================================================
-- Système de numérotation : YYMMDD-TYPE-NNN-AGE
-- TYPE ∈ DEM, PR, DOS, FAC, AVO, BUL, CUST, SUP
-- NNN : compteur continu par (agence, type)
-- AGE : 3 premières lettres du nom commercial de l'agence (uppercase, sans accents)
-- =====================================================================

-- 1) Étendre l'enum facture_client_type pour avoirs
ALTER TYPE facture_client_type ADD VALUE IF NOT EXISTS 'avoir';

-- 2) Colonnes numero (uniques par agence)
ALTER TABLE public.demandes  ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.cotations ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.dossiers  ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.contacts  ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.bulletins ADD COLUMN IF NOT EXISTS numero text;
-- factures_clients.numero existe déjà

CREATE UNIQUE INDEX IF NOT EXISTS demandes_numero_unique  ON public.demandes(agence_id, numero)  WHERE numero IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cotations_numero_unique ON public.cotations(agence_id, numero) WHERE numero IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS dossiers_numero_unique  ON public.dossiers(agence_id, numero)  WHERE numero IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contacts_numero_unique  ON public.contacts(agence_id, numero)  WHERE numero IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bulletins_numero_unique ON public.bulletins(agence_id, numero) WHERE numero IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS factures_clients_numero_unique ON public.factures_clients(agence_id, numero) WHERE numero IS NOT NULL AND numero <> '';

-- 3) Table compteur (continu, par agence + type)
CREATE TABLE IF NOT EXISTS public.numero_compteurs (
  agence_id uuid NOT NULL,
  type_doc  text NOT NULL,
  derniere_valeur integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agence_id, type_doc)
);

ALTER TABLE public.numero_compteurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compteurs_select_own_agence" ON public.numero_compteurs
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR agence_id = get_my_agence_id());

-- Pas de policies INSERT/UPDATE/DELETE : seules les fonctions SECURITY DEFINER y touchent.

-- 4) Helper : préfixe agence (3 lettres uppercase sans accents)
CREATE OR REPLACE FUNCTION public.agence_prefix(_agence_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT upper(
    substring(
      regexp_replace(
        translate(
          coalesce(nom_commercial, 'AGE'),
          'àáâäãåÀÁÂÄÃÅèéêëÈÉÊËìíîïÌÍÎÏòóôöõÒÓÔÖÕùúûüÙÚÛÜçÇñÑ',
          'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnN'
        ),
        '[^A-Za-z]', '', 'g'
      ),
      1, 3
    )
  )
  FROM public.agences WHERE id = _agence_id
$$;

-- 5) Génère un numéro complet et incrémente le compteur (atomique)
CREATE OR REPLACE FUNCTION public.next_numero(_agence_id uuid, _type text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_n integer;
  v_prefix text;
  v_date text;
BEGIN
  IF _agence_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.numero_compteurs (agence_id, type_doc, derniere_valeur)
  VALUES (_agence_id, _type, 1)
  ON CONFLICT (agence_id, type_doc)
  DO UPDATE SET derniere_valeur = numero_compteurs.derniere_valeur + 1,
                updated_at = now()
  RETURNING derniere_valeur INTO v_n;

  v_prefix := coalesce(public.agence_prefix(_agence_id), 'AGE');
  v_date := to_char(now(), 'YYMMDD');

  RETURN v_date || '-' || _type || '-' || lpad(v_n::text, 3, '0') || '-' || v_prefix;
END;
$$;

-- 6) Triggers BEFORE INSERT pour chaque table
CREATE OR REPLACE FUNCTION public.set_numero_demande()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.next_numero(NEW.agence_id, 'DEM');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.set_numero_cotation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.next_numero(NEW.agence_id, 'PR');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.set_numero_dossier()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.next_numero(NEW.agence_id, 'DOS');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.set_numero_contact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.next_numero(
      NEW.agence_id,
      CASE WHEN NEW.type = 'fournisseur' THEN 'SUP' ELSE 'CUST' END
    );
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.set_numero_bulletin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.next_numero(NEW.agence_id, 'BUL');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.set_numero_facture_client()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' OR NEW.numero ~ '^TMP' THEN
    NEW.numero := public.next_numero(
      NEW.agence_id,
      CASE WHEN NEW.type_facture = 'avoir' THEN 'AVO' ELSE 'FAC' END
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_numero_demande  ON public.demandes;
DROP TRIGGER IF EXISTS trg_set_numero_cotation ON public.cotations;
DROP TRIGGER IF EXISTS trg_set_numero_dossier  ON public.dossiers;
DROP TRIGGER IF EXISTS trg_set_numero_contact  ON public.contacts;
DROP TRIGGER IF EXISTS trg_set_numero_bulletin ON public.bulletins;
DROP TRIGGER IF EXISTS trg_set_numero_facture_client ON public.factures_clients;

CREATE TRIGGER trg_set_numero_demande  BEFORE INSERT ON public.demandes
  FOR EACH ROW EXECUTE FUNCTION public.set_numero_demande();
CREATE TRIGGER trg_set_numero_cotation BEFORE INSERT ON public.cotations
  FOR EACH ROW EXECUTE FUNCTION public.set_numero_cotation();
CREATE TRIGGER trg_set_numero_dossier  BEFORE INSERT ON public.dossiers
  FOR EACH ROW EXECUTE FUNCTION public.set_numero_dossier();
CREATE TRIGGER trg_set_numero_contact  BEFORE INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_numero_contact();
CREATE TRIGGER trg_set_numero_bulletin BEFORE INSERT ON public.bulletins
  FOR EACH ROW EXECUTE FUNCTION public.set_numero_bulletin();
CREATE TRIGGER trg_set_numero_facture_client BEFORE INSERT ON public.factures_clients
  FOR EACH ROW EXECUTE FUNCTION public.set_numero_facture_client();

-- 7) Backfill : numéroter les enregistrements existants par agence, par ordre created_at
-- Pour chaque table, on incrémente le compteur et on attribue.
DO $$
DECLARE
  r record;
  v_num text;
BEGIN
  -- DEMANDES
  FOR r IN SELECT id, agence_id FROM public.demandes WHERE numero IS NULL AND agence_id IS NOT NULL ORDER BY agence_id, created_at LOOP
    v_num := public.next_numero(r.agence_id, 'DEM');
    UPDATE public.demandes SET numero = v_num WHERE id = r.id;
  END LOOP;

  -- COTATIONS
  FOR r IN SELECT id, agence_id FROM public.cotations WHERE numero IS NULL AND agence_id IS NOT NULL ORDER BY agence_id, created_at LOOP
    v_num := public.next_numero(r.agence_id, 'PR');
    UPDATE public.cotations SET numero = v_num WHERE id = r.id;
  END LOOP;

  -- DOSSIERS
  FOR r IN SELECT id, agence_id FROM public.dossiers WHERE numero IS NULL AND agence_id IS NOT NULL ORDER BY agence_id, created_at LOOP
    v_num := public.next_numero(r.agence_id, 'DOS');
    UPDATE public.dossiers SET numero = v_num WHERE id = r.id;
  END LOOP;

  -- CONTACTS (CUST/SUP selon type)
  FOR r IN SELECT id, agence_id, type FROM public.contacts WHERE numero IS NULL AND agence_id IS NOT NULL ORDER BY agence_id, created_at LOOP
    v_num := public.next_numero(r.agence_id, CASE WHEN r.type::text = 'fournisseur' THEN 'SUP' ELSE 'CUST' END);
    UPDATE public.contacts SET numero = v_num WHERE id = r.id;
  END LOOP;

  -- BULLETINS
  FOR r IN SELECT id, agence_id FROM public.bulletins WHERE numero IS NULL AND agence_id IS NOT NULL ORDER BY agence_id, created_at LOOP
    v_num := public.next_numero(r.agence_id, 'BUL');
    UPDATE public.bulletins SET numero = v_num WHERE id = r.id;
  END LOOP;
END $$;

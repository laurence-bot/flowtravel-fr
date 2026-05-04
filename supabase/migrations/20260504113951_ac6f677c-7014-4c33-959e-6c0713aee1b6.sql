
-- Étape 0 : relever le quota d'agents
UPDATE public.agences
SET max_agents = 5
WHERE id = 'e1c8fd7a-c645-42de-9625-f6185dd22cd6';

-- Étape 1 : Affecter Lisa et l'admin FlowTravel à LA VOYAGERIE
UPDATE public.user_profiles
SET agence_id = 'e1c8fd7a-c645-42de-9625-f6185dd22cd6'
WHERE user_id IN (
  'c5af1f29-00b5-4655-8991-e20aaf2634f1',
  '99352822-5fea-4a23-8506-6253b89cdca1'
);

UPDATE public.agences
SET admin_user_id = '99352822-5fea-4a23-8506-6253b89cdca1',
    statut = 'validee',
    validee_at = COALESCE(validee_at, now())
WHERE id = 'e1c8fd7a-c645-42de-9625-f6185dd22cd6';

-- Étape 2 : agence_id sur tables métier
DO $$
DECLARE
  t text;
  metier_tables text[] := ARRAY[
    'contacts','cotations','cotation_jours','cotation_lignes_fournisseurs',
    'demandes','dossiers','dossier_tasks','flight_options','flight_segments',
    'fournisseur_conditions','fournisseur_options','bulletins','carnets',
    'factures_clients','factures_fournisseurs','facture_echeances',
    'mariage_contributions','quote_public_links','agent_notifications',
    'comptes','bank_transactions','paiements','rapprochements','transferts',
    'fx_coverages','fx_coverage_reservations'
  ];
BEGIN
  FOREACH t IN ARRAY metier_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS agence_id uuid', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_agence ON public.%I(agence_id)', t, t);
  END LOOP;
END $$;

-- Étape 3 : Backfill
DO $$
DECLARE
  t text;
  metier_tables text[] := ARRAY[
    'contacts','cotations','cotation_jours','cotation_lignes_fournisseurs',
    'demandes','dossiers','dossier_tasks','flight_options','flight_segments',
    'fournisseur_conditions','fournisseur_options','bulletins','carnets',
    'factures_clients','factures_fournisseurs','facture_echeances',
    'mariage_contributions','quote_public_links','agent_notifications',
    'comptes','bank_transactions','paiements','rapprochements','transferts',
    'fx_coverages','fx_coverage_reservations'
  ];
BEGIN
  FOREACH t IN ARRAY metier_tables LOOP
    EXECUTE format(
      'UPDATE public.%I SET agence_id = up.agence_id FROM public.user_profiles up WHERE %I.user_id = up.user_id AND %I.agence_id IS NULL AND up.agence_id IS NOT NULL',
      t, t, t
    );
  END LOOP;
END $$;

-- Étape 4 : Trigger d'auto-remplissage
CREATE OR REPLACE FUNCTION public.set_agence_id_from_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.agence_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT agence_id INTO NEW.agence_id
    FROM public.user_profiles
    WHERE user_id = NEW.user_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  metier_tables text[] := ARRAY[
    'contacts','cotations','cotation_jours','cotation_lignes_fournisseurs',
    'demandes','dossiers','dossier_tasks','flight_options','flight_segments',
    'fournisseur_conditions','fournisseur_options','bulletins','carnets',
    'factures_clients','factures_fournisseurs','facture_echeances',
    'mariage_contributions','quote_public_links','agent_notifications',
    'comptes','bank_transactions','paiements','rapprochements','transferts',
    'fx_coverages','fx_coverage_reservations'
  ];
BEGIN
  FOREACH t IN ARRAY metier_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_agence_id ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_set_agence_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_agence_id_from_user()',
      t
    );
  END LOOP;
END $$;

-- Étape 5 : RLS partagées par agence
DO $$
DECLARE
  t text;
  policy_name text;
  metier_tables text[] := ARRAY[
    'contacts','cotations','cotation_jours','cotation_lignes_fournisseurs',
    'demandes','dossiers','dossier_tasks','flight_options','flight_segments',
    'fournisseur_conditions','fournisseur_options','bulletins','carnets',
    'factures_clients','factures_fournisseurs','facture_echeances',
    'mariage_contributions','quote_public_links','agent_notifications',
    'comptes','bank_transactions','paiements','rapprochements','transferts',
    'fx_coverages','fx_coverage_reservations'
  ];
BEGIN
  FOREACH t IN ARRAY metier_tables LOOP
    FOR policy_name IN
      SELECT polname FROM pg_policy
      WHERE polrelid = format('public.%I', t)::regclass
        AND polname LIKE 'own_%_all'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, t);
    END LOOP;
    EXECUTE format('DROP POLICY IF EXISTS agence_%I_all ON public.%I', t, t);
    EXECUTE format($f$
      CREATE POLICY agence_%I_all ON public.%I
        FOR ALL TO authenticated
        USING (
          public.is_super_admin(auth.uid())
          OR (agence_id IS NOT NULL AND agence_id = public.get_my_agence_id())
          OR (agence_id IS NULL AND auth.uid() = user_id)
        )
        WITH CHECK (
          public.is_super_admin(auth.uid())
          OR (agence_id IS NOT NULL AND agence_id = public.get_my_agence_id())
          OR (agence_id IS NULL AND auth.uid() = user_id)
        )
    $f$, t, t);
  END LOOP;
END $$;

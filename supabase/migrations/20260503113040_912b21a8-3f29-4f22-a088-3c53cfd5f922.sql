CREATE OR REPLACE FUNCTION public.transformer_cotation_en_dossier(_cotation_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  cot record;
  v_dossier_id uuid;
  l record;
  v_facture_id uuid;
  pax int;
  qte numeric;
  mode_par_personne boolean;
  montant_devise_total numeric;
  montant_eur_total numeric;
  cout_total numeric := 0;
  ech_pcts numeric[];
  ech_types text[];
  ech_dates date[];
  i int;
  pct numeric;
BEGIN
  SELECT * INTO cot FROM public.cotations WHERE id = _cotation_id;
  IF cot IS NULL THEN
    RAISE EXCEPTION 'Cotation introuvable';
  END IF;

  IF cot.statut <> 'validee' THEN
    RAISE EXCEPTION 'La cotation doit être validée (statut actuel : %)', cot.statut;
  END IF;

  IF cot.client_id IS NULL THEN
    RAISE EXCEPTION 'Client requis sur la cotation';
  END IF;

  IF cot.dossier_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cette cotation a déjà été transformée en dossier';
  END IF;

  pax := GREATEST(1, COALESCE(cot.nombre_pax, 1));

  SELECT COALESCE(SUM(
    cl.montant_eur * COALESCE(cl.quantite, 1) *
    CASE WHEN cl.mode_tarifaire = 'par_personne' THEN pax ELSE 1 END
  ), 0)
  INTO cout_total
  FROM public.cotation_lignes_fournisseurs cl
  WHERE cl.cotation_id = cot.id;

  INSERT INTO public.dossiers (
    user_id, client_id, agent_id, titre, statut,
    prix_vente, cout_total, taux_tva_marge, pays_destination
  ) VALUES (
    cot.user_id, cot.client_id, cot.agent_id, cot.titre, 'confirme',
    COALESCE(cot.prix_vente_ttc, 0),
    cout_total,
    CASE WHEN cot.regime_tva = 'marge_ue' THEN cot.taux_tva_marge ELSE 0 END,
    cot.pays_destination
  )
  RETURNING id INTO v_dossier_id;

  FOR l IN
    SELECT * FROM public.cotation_lignes_fournisseurs WHERE cotation_id = cot.id ORDER BY ordre
  LOOP
    qte := COALESCE(l.quantite, 1);
    mode_par_personne := (l.mode_tarifaire = 'par_personne');
    montant_devise_total := COALESCE(l.montant_devise, 0) * qte *
      CASE WHEN mode_par_personne THEN pax ELSE 1 END;
    montant_eur_total := COALESCE(l.montant_eur, 0) * qte *
      CASE WHEN mode_par_personne THEN pax ELSE 1 END;

    INSERT INTO public.factures_fournisseurs (
      user_id, dossier_id, fournisseur_id,
      montant, montant_eur, montant_devise, devise,
      taux_change, fx_source, coverage_id,
      date_echeance, paye
    ) VALUES (
      cot.user_id, v_dossier_id, l.fournisseur_id,
      montant_eur_total, montant_eur_total, montant_devise_total, l.devise,
      l.taux_change_vers_eur, l.source_fx, l.couverture_id,
      l.date_solde, false
    )
    RETURNING id INTO v_facture_id;

    ech_pcts := ARRAY[
      COALESCE(l.pct_acompte_1, 0),
      COALESCE(l.pct_acompte_2, 0),
      COALESCE(l.pct_acompte_3, 0),
      COALESCE(l.pct_solde, 0)
    ];
    ech_types := ARRAY['acompte_1','acompte_2','acompte_3','solde'];
    ech_dates := ARRAY[l.date_acompte_1, l.date_acompte_2, l.date_acompte_3, l.date_solde];

    FOR i IN 1..4 LOOP
      pct := ech_pcts[i];
      IF pct > 0 THEN
        INSERT INTO public.facture_echeances (
          user_id, facture_id, ordre, type, statut,
          devise, montant_devise, taux_change, montant_eur,
          fx_source, coverage_id, date_echeance
        ) VALUES (
          cot.user_id, v_facture_id, i, ech_types[i]::echeance_type, 'a_payer',
          l.devise,
          montant_devise_total * pct / 100.0,
          l.taux_change_vers_eur,
          montant_devise_total * pct / 100.0 * l.taux_change_vers_eur,
          l.source_fx, l.couverture_id, ech_dates[i]
        );
      END IF;
    END LOOP;
  END LOOP;

  UPDATE public.cotations
     SET statut = 'transformee_en_dossier', dossier_id = v_dossier_id
   WHERE id = cot.id;

  RETURN v_dossier_id;
END;
$$;
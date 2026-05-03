import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TEST_EMAIL = `test-${Date.now()}@flowtravel.dev`;
const TEST_PASSWORD = 'TestFlow2026!';

async function main() {
  console.log('=== STEP 1: Création compte auth ===');
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Sophie Martin' },
  });
  if (authErr) throw authErr;
  const userId = authData.user.id;
  console.log('  user_id:', userId);

  // ensure profile is active and role is admin
  await supabase.from('user_profiles').update({ actif: true, full_name: 'Sophie Martin' }).eq('user_id', userId);
  await supabase.from('user_roles').upsert({ user_id: userId, role: 'administrateur' });

  console.log('=== STEP 2: Création agence validée ===');
  const { data: ag, error: agErr } = await supabase.from('agences').insert({
    nom_commercial: 'Évasion Couture',
    raison_sociale: 'EVASION COUTURE SARL',
    siret: '12345678900015',
    immat_atout_france: 'IM075XXXXXX',
    email_contact: TEST_EMAIL,
    telephone: '+33 1 42 00 00 00',
    adresse: '15 rue du Faubourg Saint-Honoré',
    code_postal: '75008',
    ville: 'Paris',
    admin_user_id: userId,
    admin_full_name: 'Sophie Martin',
    forfait: 'solo',
    max_agents: 1,
    statut: 'validee',
    validee_at: new Date().toISOString(),
  }).select().single(); 
  if (agErr) throw agErr;
  console.log('  agence_id:', ag.id);

  await supabase.from('user_profiles').update({ agence_id: ag.id }).eq('user_id', userId);

  console.log('=== STEP 3: agency_settings (IBAN, marges, signature) ===');
  await supabase.from('agency_settings').upsert({
    user_id: userId,
    agency_name: 'Évasion Couture',
    legal_name: 'EVASION COUTURE SARL',
    email: TEST_EMAIL,
    phone: '+33 1 42 00 00 00',
    address: '15 rue du Faubourg Saint-Honoré',
    city: 'Paris',
    country: 'France',
    siret: '12345678900015',
    immat_atout_france: 'IM075XXXXXX',
    garant_insolvabilite: 'APST',
    assureur_rc_pro: 'Hiscox',
    numero_police_rc: 'RCP-987654',
    iban: 'FR76 3000 4000 0312 3456 7890 143',
    bic: 'BNPAFRPP',
    titulaire_compte: 'EVASION COUTURE SARL',
    pct_acompte_client_1: 30,
    pct_acompte_client_2: 0,
    pct_solde_client: 70,
    delai_solde_jours: 30,
    signature_nom: 'Sophie Martin',
    brand_baseline: 'Le voyage sur-mesure',
    payment_methods: ['virement', 'cb'],
    conditions_annulation_agence: [
      { jours_min: 60, pct_retenue: 10 },
      { jours_min: 30, pct_retenue: 50 },
      { jours_min: 0, pct_retenue: 100 },
    ],
  }, { onConflict: 'user_id' });

  console.log('=== STEP 4: Client + Demande entrante ===');
  const { data: client } = await supabase.from('contacts').insert({
    user_id: userId, type: 'client',
    nom: 'Famille Dubois', email: 'jean.dubois@example.com', telephone: '+33 6 12 34 56 78',
    adresse: '42 avenue Victor Hugo', code_postal: '75116', ville: 'Paris', pays: 'France',
    contact_principal: 'Jean Dubois',
  }).select().single(); 
  console.log('  client_id:', client!.id);

  const { data: demande } = await supabase.from('demandes').insert({
    user_id: userId, client_id: client!.id, agent_id: userId,
    nom_client: 'Jean Dubois', email: 'jean.dubois@example.com', telephone: '+33 6 12 34 56 78',
    canal: 'site_web', destination: 'Bali, Indonésie', pays_destination: 'Indonésie',
    date_depart_souhaitee: '2026-09-15', date_retour_souhaitee: '2026-09-30',
    nombre_pax: 2, budget: 8000, statut: 'en_cours',
    message_client: 'Voyage de noces, hôtels boutique, plages calmes, expérience temple privée.',
  }).select().single(); 
  console.log('  demande_id:', demande!.id);

  console.log('=== STEP 5: Fournisseur + Cotation ===');
  const { data: fourn } = await supabase.from('contacts').insert({
    user_id: userId, type: 'fournisseur',
    nom: 'Asia DMC Bali', email: 'reservations@asiadmc.com',
    pays: 'Indonésie', ville: 'Denpasar', contact_principal: 'Wayan Putu',
  }).select().single(); 

  const { data: cot } = await supabase.from('cotations').insert({
    user_id: userId, agent_id: userId, client_id: client!.id, demande_id: demande!.id,
    titre: 'Voyage de noces — Bali sur-mesure',
    destination: 'Bali, Indonésie', pays_destination: 'Indonésie',
    date_depart: '2026-09-15', date_retour: '2026-09-30',
    nombre_pax: 2, nombre_chambres: 1,
    storytelling_intro: '15 jours d\'enchantement à Bali : rizières d\'Ubud, temples privés, plages secrètes de Nusa Lembongan.',
    inclus_text: 'Vols A/R • Transferts privés • Hôtels 5* • Petits-déjeuners • Excursions privées',
    non_inclus_text: 'Repas non mentionnés • Visa • Pourboires',
    prix_vente_ht: 7500, prix_vente_ttc: 9000,
    statut: 'envoyee',
  }).select().single(); 
  console.log('  cotation_id:', cot!.id);

  await supabase.from('cotation_lignes_fournisseurs').insert([
    { user_id: userId, cotation_id: cot!.id, fournisseur_id: fourn!.id,
      nom_fournisseur: 'Asia DMC Bali', prestation: 'Land package 15 nuits + transferts',
      mode_tarifaire: 'par_personne', quantite: 1, devise: 'EUR',
      montant_devise: 2800, taux_change_vers_eur: 1, montant_eur: 2800,
      pct_acompte_1: 30, pct_solde: 70,
      date_acompte_1: '2026-04-15', date_solde: '2026-08-15', ordre: 1 },
    { user_id: userId, cotation_id: cot!.id,
      nom_fournisseur: 'Air France', prestation: 'Vols PAR-DPS A/R',
      mode_tarifaire: 'par_personne', quantite: 1, devise: 'EUR',
      montant_devise: 1100, taux_change_vers_eur: 1, montant_eur: 1100,
      pct_acompte_1: 100, pct_solde: 0,
      date_acompte_1: '2026-04-20', ordre: 2 },
  ]);

  console.log('=== STEP 6: Lien public cotation ===');
  const { data: link } = await supabase.from('quote_public_links' as any).insert({
    cotation_id: cot!.id,
    expires_at: new Date(Date.now() + 30*24*3600*1000).toISOString(),
  }).select().single(); 
  console.log('  public_token:', (link as any)?.token);

  console.log('\n✅ SEED OK');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Email   :', TEST_EMAIL);
  console.log('Password:', TEST_PASSWORD);
  console.log('Agence  :', ag.id);
  console.log('Cotation:', cot!.id);
  console.log('Lien client public: /cotation/' + (link as any)?.token);
}

main().catch(e => { console.error('❌', e); process.exit(1); });

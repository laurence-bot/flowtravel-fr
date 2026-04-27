import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error('Variables Lovable Cloud manquantes');

const email = 'qa-clean@flowtravel.test';
const password = 'FlowTravel!2026';
const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const plus = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const coutTotal = +(4200 + 5600 / 1.08).toFixed(2);

async function getOrCreateUser() {
  const { data: created, error: createError } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Compte QA propre' },
  });
  if (created?.user) return created.user;
  if (!createError?.message?.toLowerCase().includes('already')) throw createError;

  for (let page = 1; page <= 10; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user) {
      const { data: updated, error: updateError } = await sb.auth.admin.updateUserById(user.id, {
        password,
        email_confirm: true,
        user_metadata: { full_name: 'Compte QA propre' },
      });
      if (updateError) throw updateError;
      return updated.user ?? user;
    }
    if (data.users.length < 1000) break;
  }
  throw new Error('Compte existant introuvable après conflit de création');
}

async function clearUserData(userId: string) {
  const operations = [
    sb.from('dossier_tasks').delete().eq('user_id', userId),
    sb.from('facture_echeances').delete().eq('user_id', userId),
    sb.from('fx_coverage_reservations').delete().eq('user_id', userId),
    sb.from('rapprochements').delete().eq('user_id', userId),
    sb.from('factures_fournisseurs').delete().eq('user_id', userId),
    sb.from('flight_options').delete().eq('user_id', userId),
    sb.from('fournisseur_options').delete().eq('user_id', userId),
    sb.from('cotation_lignes_fournisseurs').delete().eq('user_id', userId),
    sb.from('bank_transactions').delete().eq('user_id', userId),
    sb.from('paiements').delete().eq('user_id', userId),
    sb.from('cotations').delete().eq('user_id', userId),
    sb.from('dossiers').delete().eq('user_id', userId),
    sb.from('demandes').delete().eq('user_id', userId),
    sb.from('contacts').delete().eq('user_id', userId),
    sb.from('fx_coverages').delete().eq('user_id', userId),
    sb.from('transferts').delete().eq('user_id', userId),
    sb.from('comptes').delete().eq('user_id', userId),
    sb.from('audit_logs').delete().eq('user_id', userId),
    sb.from('agency_settings').delete().eq('user_id', userId),
  ];
  for (const op of operations) {
    const { error } = await op;
    if (error) throw error;
  }
}

async function one<T>(label: string, query: PromiseLike<{ data: T | null; error: any }>): Promise<T> {
  const { data, error } = await query;
  if (error || !data) throw new Error(`${label}: ${error?.message ?? 'aucune donnée'}`);
  return data;
}

async function main() {
  const user = await getOrCreateUser();
  const userId = user.id;

  await clearUserData(userId);

  await sb.from('user_profiles').upsert({
    user_id: userId,
    email,
    full_name: 'Compte QA propre',
    actif: true,
  }, { onConflict: 'user_id' });
  await sb.from('user_roles').delete().eq('user_id', userId);
  await sb.from('user_roles').insert({ user_id: userId, role: 'gestion' });

  const client = await one<any>('client', sb.from('contacts').insert({
    user_id: userId,
    nom: '[QA] Famille Dupont',
    type: 'client',
    email: 'dupont@qa.test',
    telephone: '+33 6 00 00 00 00',
  } as any).select().single());

  const fournisseurHotel = await one<any>('fournisseur hôtel', sb.from('contacts').insert({
    user_id: userId,
    nom: '[QA] Hôtel Zanzibar Beach',
    type: 'fournisseur',
    email: 'hotel@qa.test',
  } as any).select().single());
  const fournisseurSafari = await one<any>('fournisseur safari', sb.from('contacts').insert({
    user_id: userId,
    nom: '[QA] Réceptif Tanzanie Safari',
    type: 'fournisseur',
    email: 'safari@qa.test',
  } as any).select().single());

  const demande = await one<any>('demande', sb.from('demandes').insert({
    user_id: userId,
    client_id: client.id,
    nom_client: '[QA] Famille Dupont',
    email: 'dupont@qa.test',
    telephone: '+33 6 00 00 00 00',
    canal: 'email',
    destination: 'Tanzanie',
    date_depart_souhaitee: plus(90),
    date_retour_souhaitee: plus(104),
    budget: 12000,
    nombre_pax: 4,
    message_client: 'Safari + Zanzibar, lune de miel',
    statut: 'nouvelle',
  } as any).select().single());

  const cEur = await one<any>('compte EUR', sb.from('comptes').insert({
    user_id: userId,
    nom: '[QA] Compte EUR',
    banque: 'cic',
    categorie: 'gestion',
    devise: 'EUR',
    solde_initial: 0,
  } as any).select().single());
  const cUsd = await one<any>('compte USD', sb.from('comptes').insert({
    user_id: userId,
    nom: '[QA] Compte USD',
    banque: 'ebury',
    categorie: 'gestion',
    devise: 'USD',
    solde_initial: 0,
  } as any).select().single());

  const cov = await one<any>('couverture FX', sb.from('fx_coverages').insert({
    user_id: userId,
    devise: 'USD',
    reference: '[QA] Couverture USD',
    montant_devise: 10000,
    taux_change: 1.08,
    date_ouverture: plus(0),
    date_echeance: plus(90),
    statut: 'ouverte',
  } as any).select().single());

  const cotation = await one<any>('cotation', sb.from('cotations').insert({
    user_id: userId,
    client_id: client.id,
    demande_id: demande.id,
    titre: '[QA] Tanzanie · Dupont · Safari + Zanzibar',
    destination: 'Tanzanie',
    date_depart: demande.date_depart_souhaitee,
    date_retour: demande.date_retour_souhaitee,
    nombre_pax: 4,
    nombre_chambres: 2,
    statut: 'en_option',
    regime_tva: 'marge_ue',
    taux_tva_marge: 20,
    prix_vente_ttc: 12800,
    prix_vente_ht: 12800 / 1.2,
  } as any).select().single());

  const ligneHotel = await one<any>('ligne hôtel', sb.from('cotation_lignes_fournisseurs').insert({
    user_id: userId,
    cotation_id: cotation.id,
    fournisseur_id: fournisseurHotel.id,
    ordre: 1,
    nom_fournisseur: fournisseurHotel.nom,
    prestation: 'Hébergement 7 nuits',
    quantite: 1,
    devise: 'EUR',
    montant_devise: 4200,
    taux_change_vers_eur: 1,
    montant_eur: 4200,
    source_fx: 'taux_du_jour',
    mode_tarifaire: 'global',
    pct_acompte_1: 30,
    pct_solde: 70,
    date_acompte_1: plus(7),
    date_solde: plus(60),
  } as any).select().single());
  const ligneSafari = await one<any>('ligne safari', sb.from('cotation_lignes_fournisseurs').insert({
    user_id: userId,
    cotation_id: cotation.id,
    fournisseur_id: fournisseurSafari.id,
    ordre: 2,
    nom_fournisseur: fournisseurSafari.nom,
    prestation: 'Safari 5 jours',
    quantite: 1,
    devise: 'USD',
    montant_devise: 5600,
    taux_change_vers_eur: 1.08,
    montant_eur: +(5600 / 1.08).toFixed(2),
    source_fx: 'couverture',
    couverture_id: cov.id,
    mode_tarifaire: 'global',
    pct_acompte_1: 30,
    pct_solde: 70,
    date_acompte_1: plus(10),
    date_solde: plus(70),
  } as any).select().single());

  const past = new Date(Date.now() - 2 * 3600000);
  await sb.from('fournisseur_options').insert([
    {
      user_id: userId,
      cotation_id: cotation.id,
      ligne_fournisseur_id: ligneHotel.id,
      fournisseur_id: fournisseurHotel.id,
      nom_fournisseur: fournisseurHotel.nom,
      prestation: ligneHotel.prestation,
      email_fournisseur: fournisseurHotel.email,
      statut: 'confirmee',
      deadline_option_date: past.toISOString().slice(0, 10),
      deadline_option_time: past.toISOString().slice(11, 16),
    },
    {
      user_id: userId,
      cotation_id: cotation.id,
      ligne_fournisseur_id: ligneSafari.id,
      fournisseur_id: fournisseurSafari.id,
      nom_fournisseur: fournisseurSafari.nom,
      prestation: ligneSafari.prestation,
      email_fournisseur: fournisseurSafari.email,
      statut: 'confirmee',
      deadline_option_date: plus(5),
      deadline_option_time: '12:00',
    },
  ] as any);
  await sb.from('flight_options').insert({
    user_id: userId,
    cotation_id: cotation.id,
    compagnie: '[QA] Ethiopian Airlines',
    routing: 'CDG-ADD-ZNZ',
    numero_vol: 'ET505',
    date_depart: plus(90),
    heure_depart: '22:30',
    date_retour: plus(104),
    heure_retour: '06:15',
    prix: 3200,
    devise: 'EUR',
    deadline_option_date: plus(7),
    deadline_option_time: '18:00',
    statut: 'confirmee',
  } as any);

  const dossier = await one<any>('dossier', sb.from('dossiers').insert({
    user_id: userId,
    client_id: client.id,
    titre: '[QA] ' + cotation.titre,
    statut: 'confirme',
    prix_vente: 12800,
    cout_total: coutTotal,
    taux_tva_marge: 20,
  } as any).select().single());
  await sb.from('cotations').update({ statut: 'transformee_en_dossier', dossier_id: dossier.id }).eq('id', cotation.id);

  await sb.from('factures_fournisseurs').insert([
    {
      user_id: userId,
      dossier_id: dossier.id,
      fournisseur_id: fournisseurHotel.id,
      montant: ligneHotel.montant_eur,
      devise: ligneHotel.devise,
      montant_devise: ligneHotel.montant_devise,
      taux_change: ligneHotel.taux_change_vers_eur,
      montant_eur: ligneHotel.montant_eur,
      date_echeance: ligneHotel.date_solde,
      paye: false,
    },
    {
      user_id: userId,
      dossier_id: dossier.id,
      fournisseur_id: fournisseurSafari.id,
      montant: ligneSafari.montant_eur,
      devise: ligneSafari.devise,
      montant_devise: ligneSafari.montant_devise,
      taux_change: ligneSafari.taux_change_vers_eur,
      montant_eur: ligneSafari.montant_eur,
      date_echeance: ligneSafari.date_solde,
      paye: false,
      coverage_id: cov.id,
    },
  ] as any);

  await sb.from('dossier_tasks').insert([
    { user_id: userId, dossier_id: dossier.id, titre: 'Confirmer rooming list', phase: 'pre_depart', priorite: 'importante', statut: 'termine', date_echeance: plus(15), completed_at: new Date().toISOString(), ordre: 1 },
    { user_id: userId, dossier_id: dossier.id, titre: 'Réserver transferts aéroport', phase: 'pre_depart', priorite: 'importante', statut: 'a_faire', date_echeance: plus(30), ordre: 2 },
    { user_id: userId, dossier_id: dossier.id, titre: 'Envoyer carnet de voyage', phase: 'pre_depart', priorite: 'critique', statut: 'en_cours', date_echeance: plus(80), ordre: 3 },
    { user_id: userId, dossier_id: dossier.id, titre: 'Suivi pendant voyage', phase: 'pendant', priorite: 'normale', statut: 'a_faire', date_echeance: plus(95), ordre: 4 },
    { user_id: userId, dossier_id: dossier.id, titre: 'Demander avis client', phase: 'apres', priorite: 'normale', statut: 'a_faire', date_echeance: plus(110), ordre: 5 },
  ] as any);

  await sb.from('paiements').insert([
    {
      user_id: userId,
      type: 'paiement_client',
      source: 'manuel',
      methode: 'virement',
      date: plus(0),
      montant: 4000,
      devise: 'EUR',
      taux_change: 1,
      montant_eur: 4000,
      compte_id: cEur.id,
      personne_id: client.id,
      dossier_id: dossier.id,
    },
    {
      user_id: userId,
      type: 'paiement_fournisseur',
      source: 'manuel',
      methode: 'virement',
      date: plus(0),
      montant: 1260,
      devise: 'EUR',
      taux_change: 1,
      montant_eur: 1260,
      compte_id: cEur.id,
      personne_id: fournisseurHotel.id,
      dossier_id: dossier.id,
    },
  ] as any);

  const bankTx = await one<any>('transaction bancaire', sb.from('bank_transactions').insert({
    user_id: userId,
    compte_id: cEur.id,
    source_banque: 'cic',
    sens: 'credit',
    montant: 4000,
    libelle_normalise: 'VIR DUPONT ACOMPTE TANZANIE',
    libelle_original: 'VIREMENT RECU DUPONT REF TANZANIE',
    date: plus(0),
    devise: 'EUR',
    statut: 'nouveau',
    hash_unique: `qa-clean-${Date.now()}-vir-dupont`,
  } as any).select().single());

  console.log(JSON.stringify({
    email,
    password,
    userId,
    routes: {
      client: `/contacts/${client.id}`,
      demande: `/demandes/${demande.id}`,
      cotation: `/cotations/${cotation.id}`,
      dossier: `/dossiers/${dossier.id}`,
      comptes: '/comptes',
      rapprochement: '/rapprochement',
    },
    ids: { cEur: cEur.id, cUsd: cUsd.id, bankTx: bankTx.id },
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});

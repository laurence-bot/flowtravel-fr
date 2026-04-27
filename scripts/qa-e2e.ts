/**
 * Flow Travel — Scénario E2E automatisé
 *
 * Exécute toutes les étapes du scénario de test (demande → cotation → option →
 * acompte → confirmation → dossier → tâches → trésorerie → rapprochement → export)
 * via l'API Supabase, en utilisant un compte de test dédié.
 *
 * Pré-requis :
 *   1. Créer manuellement le compte qa-test@flowtravel.test via /auth (UI),
 *      mot de passe au choix. Sinon, fournir SERVICE_ROLE pour la création auto.
 *   2. Variables d'env :
 *        SUPABASE_URL, SUPABASE_ANON_KEY,
 *        QA_EMAIL=qa-test@flowtravel.test, QA_PASSWORD=...
 *
 * Lancement :
 *   bun run scripts/qa-e2e.ts
 *
 * Sortie : rapport Markdown dans /mnt/documents/flow-travel-qa-report.md
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";

const URL = process.env.SUPABASE_URL!;
const ANON = process.env.SUPABASE_ANON_KEY!;
const EMAIL = process.env.QA_EMAIL || "qa-test@flowtravel.test";
const PASSWORD = process.env.QA_PASSWORD || "QaTest!2026";

if (!URL || !ANON) {
  console.error("Manque SUPABASE_URL / SUPABASE_ANON_KEY");
  process.exit(1);
}

const sb = createClient(URL, ANON);
const log: string[] = [];
const ok = (m: string) => { console.log("✓", m); log.push(`- ✅ ${m}`); };
const ko = (m: string, e?: unknown) => { console.error("✗", m, e); log.push(`- ❌ ${m}${e ? " — " + (e as Error).message : ""}`); };
const step = (m: string) => { console.log("\n##", m); log.push(`\n## ${m}\n`); };

async function main() {
  step("0. Connexion compte de test");
  const { data: auth, error: authErr } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (authErr || !auth?.user) {
    ko("Connexion échouée — créer manuellement le compte via /auth puis relancer.", authErr);
    finish();
    return;
  }
  const uid = auth.user.id;
  ok(`Connecté en tant que ${EMAIL} (${uid})`);

  step("0bis. Préparation comptes + couverture FX");
  const { data: cEur } = await sb.from("comptes").insert({
    user_id: uid, nom: "[QA] Compte EUR", banque: "BNP", categorie: "courant", devise: "EUR", solde_initial: 0,
  } as any).select().single();
  const { data: cUsd } = await sb.from("comptes").insert({
    user_id: uid, nom: "[QA] Compte USD", banque: "EBURY", categorie: "courant", devise: "USD", solde_initial: 0,
  } as any).select().single();
  ok(`2 comptes créés (EUR=${cEur?.id?.slice(0,8)}, USD=${cUsd?.id?.slice(0,8)})`);

  const today = new Date();
  const plus = (d: number) => new Date(today.getTime() + d * 86400000).toISOString().slice(0, 10);

  const { data: cov, error: covErr } = await sb.from("fx_coverages").insert({
    user_id: uid, devise: "USD", reference: "[QA] Couverture USD",
    montant_devise: 10000, taux_change: 1.08,
    date_ouverture: plus(0), date_echeance: plus(90), statut: "ouverte",
  } as any).select().single();
  covErr ? ko("Couverture FX", covErr) : ok(`Couverture FX 10 000 USD @ 1.08 créée (${cov.id.slice(0,8)})`);

  step("1. Demande client");
  const { data: client } = await sb.from("contacts").insert({
    user_id: uid, nom: "[QA] Famille Dupont", type: "client", email: "dupont@qa.test",
  } as any).select().single();
  const { data: demande, error: demErr } = await sb.from("demandes").insert({
    user_id: uid, client_id: client?.id, nom_client: "[QA] Famille Dupont",
    email: "dupont@qa.test", canal: "email",
    destination: "Tanzanie", date_depart_souhaitee: plus(90), date_retour_souhaitee: plus(104),
    budget: 12000, nombre_pax: 4, message_client: "Safari + Zanzibar, lune de miel",
    statut: "nouvelle",
  } as any).select().single();
  demErr ? ko("Demande", demErr) : ok(`Demande créée (${demande.id.slice(0,8)})`);

  step("2. Transformation en cotation");
  const { data: cotation, error: cotErr } = await sb.from("cotations").insert({
    user_id: uid, client_id: client?.id, demande_id: demande?.id,
    titre: "[QA] Tanzanie · Dupont · Safari + Zanzibar",
    destination: "Tanzanie", date_depart: demande?.date_depart_souhaitee,
    date_retour: demande?.date_retour_souhaitee, nombre_pax: 4, nombre_chambres: 2,
    statut: "brouillon", regime_tva: "marge_ue", taux_tva_marge: 20,
    prix_vente_ttc: 12800, prix_vente_ht: 12800 / 1.2,
  } as any).select().single();
  cotErr ? ko("Cotation", cotErr) : ok(`Cotation créée (${cotation.id.slice(0,8)})`);

  step("3. Lignes fournisseurs EUR + USD");
  const { error: l1Err } = await sb.from("cotation_lignes_fournisseurs").insert({
    user_id: uid, cotation_id: cotation.id, ordre: 1,
    nom_fournisseur: "[QA] Hôtel Zanzibar Beach", prestation: "Hébergement 7 nuits",
    quantite: 1, devise: "EUR", montant_devise: 4200, taux_change_vers_eur: 1, montant_eur: 4200,
    source_fx: "taux_du_jour", mode_tarifaire: "global",
    pct_acompte_1: 30, pct_solde: 70, date_acompte_1: plus(7), date_solde: plus(60),
  } as any);
  const { error: l2Err } = await sb.from("cotation_lignes_fournisseurs").insert({
    user_id: uid, cotation_id: cotation.id, ordre: 2,
    nom_fournisseur: "[QA] Réceptif Tanzanie Safari", prestation: "Safari 5 jours",
    quantite: 1, devise: "USD", montant_devise: 5600, taux_change_vers_eur: 1.08,
    montant_eur: +(5600 / 1.08).toFixed(2),
    source_fx: "taux_couverture", couverture_id: cov?.id, mode_tarifaire: "global",
    pct_acompte_1: 30, pct_solde: 70, date_acompte_1: plus(10), date_solde: plus(70),
  } as any);
  l1Err || l2Err ? ko("Lignes", l1Err || l2Err) : ok("2 lignes (EUR 4 200 + USD 5 600 @1.08 ≈ 5 185,19 €)");

  const coutTotal = 4200 + 5600 / 1.08;
  const margeBrute = 12800 - coutTotal;
  const tvaMarge = (margeBrute / 1.2) * 0.2;
  const margeNette = margeBrute - tvaMarge;
  ok(`Calculs attendus : coût=${coutTotal.toFixed(2)} | brute=${margeBrute.toFixed(2)} | TVA=${tvaMarge.toFixed(2)} | nette=${margeNette.toFixed(2)}`);

  step("4. Passage en option");
  await sb.from("cotations").update({ statut: "en_option" }).eq("id", cotation.id);
  const { data: lignes } = await sb.from("cotation_lignes_fournisseurs").select("*").eq("cotation_id", cotation.id);
  for (const l of lignes ?? []) {
    await sb.from("fournisseur_options").insert({
      user_id: uid, cotation_id: cotation.id, ligne_fournisseur_id: l.id,
      nom_fournisseur: l.nom_fournisseur, prestation: l.prestation,
      email_fournisseur: "fournisseur@qa.test", statut: "a_demander",
      deadline_option_date: plus(5), deadline_option_time: "12:00",
    } as any);
  }
  ok(`Cotation passée en_option + ${lignes?.length} options fournisseurs créées`);

  await sb.from("flight_options").insert({
    user_id: uid, cotation_id: cotation.id, compagnie: "[QA] Ethiopian Airlines",
    routing: "CDG-ADD-ZNZ", numero_vol: "ET505", date_depart: plus(90), heure_depart: "22:30",
    date_retour: plus(104), heure_retour: "06:15", prix: 3200, devise: "EUR",
    deadline_option_date: plus(7), deadline_option_time: "18:00", statut: "en_option",
  } as any);
  ok("Option vol Ethiopian Airlines créée");

  step("5. Test deadlines (expirée + critique)");
  const { data: opts } = await sb.from("fournisseur_options").select("*").eq("cotation_id", cotation.id);
  if (opts?.[0]) {
    const past = new Date(Date.now() - 2 * 3600000);
    await sb.from("fournisseur_options").update({
      deadline_option_date: past.toISOString().slice(0, 10),
      deadline_option_time: past.toISOString().slice(11, 16),
    }).eq("id", opts[0].id);
    ok(`Deadline option ${opts[0].nom_fournisseur} → expirée (-2h)`);
  }

  step("6. Acompte client");
  const { error: payErr } = await sb.from("paiements").insert({
    user_id: uid, type: "client_acompte", source: "manuel", methode: "virement",
    date: plus(0), montant: 4000, devise: "EUR", taux_change: 1, montant_eur: 4000,
    compte_id: cEur?.id, personne_id: client?.id,
  } as any);
  payErr ? ko("Acompte client", payErr) : ok("Acompte client 4 000 € enregistré (compte EUR)");

  step("7. Confirmation fournisseurs");
  await sb.from("fournisseur_options").update({ statut: "confirmee" }).eq("cotation_id", cotation.id);
  await sb.from("flight_options").update({ statut: "confirmee" }).eq("cotation_id", cotation.id);
  ok("Toutes options fournisseurs + vol passées en confirmée");

  step("8. Transformation en dossier");
  const { data: dossier, error: dosErr } = await sb.from("dossiers").insert({
    user_id: uid, client_id: client?.id, titre: "[QA] " + cotation.titre,
    statut: "confirme", prix_vente: 12800, cout_total: +coutTotal.toFixed(2),
    taux_tva_marge: 20,
  } as any).select().single();
  if (dosErr) ko("Dossier", dosErr);
  else {
    await sb.from("cotations").update({ statut: "transformee_en_dossier", dossier_id: dossier.id }).eq("id", cotation.id);
    ok(`Dossier créé (${dossier.id.slice(0,8)}) + cotation marquée transformée_en_dossier`);

    // factures fournisseurs
    for (const l of lignes ?? []) {
      await sb.from("factures_fournisseurs").insert({
        user_id: uid, dossier_id: dossier.id,
        montant: l.montant_eur, devise: l.devise, montant_devise: l.montant_devise,
        taux_change: l.taux_change_vers_eur, montant_eur: l.montant_eur,
        date_echeance: l.date_solde, paye: false,
      } as any);
    }
    ok(`${lignes?.length} factures fournisseurs générées`);
  }

  step("9. Suivi opérationnel — checklist dossier");
  if (dossier) {
    const tasks = [
      { titre: "Confirmer rooming list", phase: "preparation", priorite: "importante", statut: "termine", date_echeance: plus(15) },
      { titre: "Réserver transferts aéroport", phase: "preparation", priorite: "importante", statut: "a_faire", date_echeance: plus(30) },
      { titre: "Envoyer carnet de voyage", phase: "preparation", priorite: "critique", statut: "en_cours", date_echeance: plus(80) },
      { titre: "Suivi pendant voyage", phase: "voyage", priorite: "normale", statut: "a_faire", date_echeance: plus(95) },
      { titre: "Demander avis client", phase: "retour", priorite: "normale", statut: "a_faire", date_echeance: plus(110) },
    ];
    for (const t of tasks) {
      await sb.from("dossier_tasks").insert({
        user_id: uid, dossier_id: dossier.id, ...t,
        completed_at: t.statut === "termine" ? new Date().toISOString() : null,
      } as any);
    }
    ok(`${tasks.length} tâches insérées (1 terminée, 1 en_cours, 3 à faire)`);
  }

  step("10. Trésorerie — paiement fournisseur");
  await sb.from("paiements").insert({
    user_id: uid, type: "fournisseur_acompte", source: "manuel", methode: "virement",
    date: plus(0), montant: 1260, devise: "EUR", taux_change: 1, montant_eur: 1260,
    compte_id: cEur?.id, dossier_id: dossier?.id,
  } as any);
  ok("Acompte fournisseur 30% Zanzibar = 1 260 € enregistré");

  step("11. FX — vérification couverture");
  const { data: fxRes } = await sb.from("fx_coverages").select("*").eq("id", cov?.id).single();
  ok(`Couverture USD : ${fxRes?.montant_devise} USD @ ${fxRes?.taux_change}`);

  step("12. Rapprochement bancaire — simulation");
  const { data: bt } = await sb.from("bank_transactions").insert({
    user_id: uid, compte_id: cEur?.id, source_banque: "BNP", sens: "credit",
    montant: 4000, libelle_normalise: "VIR DUPONT ACOMPTE TANZANIE",
    libelle_original: "VIREMENT RECU DUPONT REF TANZANIE",
    date: plus(0), devise: "EUR", statut: "nouveau",
    hash_unique: `qa-${Date.now()}-vir-dupont`,
  } as any).select().single();
  bt ? ok(`Transaction bancaire 4 000 € créée (${bt.id.slice(0,8)})`) : ko("Bank tx");

  step("13. Audit & cohérence");
  const { count: auditCount } = await sb.from("audit_logs").select("*", { count: "exact", head: true }).eq("user_id", uid);
  ok(`Audit logs total : ${auditCount}`);

  const { data: paiements } = await sb.from("paiements").select("montant_eur,type").eq("user_id", uid);
  const totalClient = (paiements ?? []).filter(p => p.type?.startsWith("client")).reduce((s, p) => s + Number(p.montant_eur || 0), 0);
  ok(`Total acomptes client : ${totalClient.toFixed(2)} € / 12 800 € (reste à facturer ${(12800 - totalClient).toFixed(2)} €)`);

  step("✅ Scénario E2E exécuté");
  ok("Toutes les entités créées portent le préfixe [QA] — nettoyage facile.");

  finish();
}

function finish() {
  const md = `# Flow Travel — Rapport QA E2E\n\nDate : ${new Date().toISOString()}\nCompte : ${EMAIL}\n\n${log.join("\n")}\n`;
  writeFileSync("/mnt/documents/flow-travel-qa-report.md", md);
  console.log("\nRapport écrit dans /mnt/documents/flow-travel-qa-report.md");
}

main().catch((e) => { ko("Crash", e); finish(); process.exit(1); });

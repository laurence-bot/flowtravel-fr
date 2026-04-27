// Scénario E2E exécutable côté client.
// Insère des données préfixées [QA] sur le compte connecté.
// Toutes les écritures sont protégées par RLS (auth.uid() = user_id).

import { supabase } from "@/integrations/supabase/client";

export type QaStep = {
  key: string;
  label: string;
  status: "pending" | "running" | "ok" | "ko";
  detail?: string;
};

export type QaProgress = (steps: QaStep[]) => void;

const plus = (d: number) =>
  new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

export async function runQaScenario(userId: string, onProgress: QaProgress): Promise<QaStep[]> {
  const steps: QaStep[] = [
    { key: "comptes", label: "Créer comptes EUR + USD", status: "pending" },
    { key: "fx", label: "Créer couverture FX 10 000 USD", status: "pending" },
    { key: "client", label: "Créer client + demande", status: "pending" },
    { key: "cotation", label: "Créer cotation Tanzanie", status: "pending" },
    { key: "lignes", label: "Lignes fournisseurs EUR + USD", status: "pending" },
    { key: "options", label: "Passer en option + auto-options", status: "pending" },
    { key: "vol", label: "Option vol + deadline expirée", status: "pending" },
    { key: "acompte", label: "Acompte client 4 000 €", status: "pending" },
    { key: "confirm", label: "Confirmer fournisseurs", status: "pending" },
    { key: "dossier", label: "Transformer en dossier + factures", status: "pending" },
    { key: "tasks", label: "Checklist opérationnelle (5 tâches)", status: "pending" },
    { key: "tresorerie", label: "Paiement fournisseur", status: "pending" },
    { key: "bank", label: "Transaction bancaire à rapprocher", status: "pending" },
  ];

  const update = (k: string, patch: Partial<QaStep>) => {
    const i = steps.findIndex((s) => s.key === k);
    if (i >= 0) steps[i] = { ...steps[i], ...patch };
    onProgress([...steps]);
  };

  const run = async (k: string, fn: () => Promise<string | void>) => {
    update(k, { status: "running" });
    try {
      const detail = await fn();
      update(k, { status: "ok", detail: detail || undefined });
    } catch (e) {
      update(k, { status: "ko", detail: (e as Error).message });
      throw e;
    }
  };

  // 1. Comptes
  let cEur: any, cUsd: any;
  await run("comptes", async () => {
    const { data: e, error: e1 } = await supabase
      .from("comptes")
      .insert({
        user_id: userId,
        nom: "[QA] Compte EUR",
        banque: "cic",
        categorie: "courant",
        devise: "EUR",
        solde_initial: 0,
      } as any)
      .select()
      .single();
    if (e1) throw e1;
    cEur = e;
    const { data: u, error: e2 } = await supabase
      .from("comptes")
      .insert({
        user_id: userId,
        nom: "[QA] Compte USD",
        banque: "ebury",
        categorie: "courant",
        devise: "USD",
        solde_initial: 0,
      } as any)
      .select()
      .single();
    if (e2) throw e2;
    cUsd = u;
    return "EUR + USD créés";
  });

  // 2. Couverture FX
  let cov: any;
  await run("fx", async () => {
    const { data, error } = await supabase
      .from("fx_coverages")
      .insert({
        user_id: userId,
        devise: "USD",
        reference: "[QA] Couverture USD",
        montant_devise: 10000,
        taux_change: 1.08,
        date_ouverture: plus(0),
        date_echeance: plus(90),
        statut: "ouverte",
      } as any)
      .select()
      .single();
    if (error) throw error;
    cov = data;
    return "10 000 USD @ 1.08";
  });

  // 3. Client + demande
  let client: any, demande: any;
  await run("client", async () => {
    const { data: c, error: e1 } = await supabase
      .from("contacts")
      .insert({
        user_id: userId,
        nom: "[QA] Famille Dupont",
        type: "client",
        email: "dupont@qa.test",
      } as any)
      .select()
      .single();
    if (e1) throw e1;
    client = c;
    const { data: d, error: e2 } = await supabase
      .from("demandes")
      .insert({
        user_id: userId,
        client_id: client.id,
        nom_client: "[QA] Famille Dupont",
        email: "dupont@qa.test",
        canal: "email",
        destination: "Tanzanie",
        date_depart_souhaitee: plus(90),
        date_retour_souhaitee: plus(104),
        budget: 12000,
        nombre_pax: 4,
        message_client: "Safari + Zanzibar, lune de miel",
        statut: "nouvelle",
      } as any)
      .select()
      .single();
    if (e2) throw e2;
    demande = d;
    return "Famille Dupont · Tanzanie · 4 pax";
  });

  // 4. Cotation
  let cotation: any;
  const coutTotal = 4200 + 5600 / 1.08;
  await run("cotation", async () => {
    const { data, error } = await supabase
      .from("cotations")
      .insert({
        user_id: userId,
        client_id: client.id,
        demande_id: demande.id,
        titre: "[QA] Tanzanie · Dupont · Safari + Zanzibar",
        destination: "Tanzanie",
        date_depart: demande.date_depart_souhaitee,
        date_retour: demande.date_retour_souhaitee,
        nombre_pax: 4,
        nombre_chambres: 2,
        statut: "brouillon",
        regime_tva: "marge_ue",
        taux_tva_marge: 20,
        prix_vente_ttc: 12800,
        prix_vente_ht: 12800 / 1.2,
      } as any)
      .select()
      .single();
    if (error) throw error;
    cotation = data;
    return `12 800 € TTC · marge nette ≈ ${(((12800 - coutTotal) / 1.2) * 0.8).toFixed(0)} €`;
  });

  // 5. Lignes
  await run("lignes", async () => {
    const { error: e1 } = await supabase.from("cotation_lignes_fournisseurs").insert({
      user_id: userId,
      cotation_id: cotation.id,
      ordre: 1,
      nom_fournisseur: "[QA] Hôtel Zanzibar Beach",
      prestation: "Hébergement 7 nuits",
      quantite: 1,
      devise: "EUR",
      montant_devise: 4200,
      taux_change_vers_eur: 1,
      montant_eur: 4200,
      source_fx: "taux_du_jour",
      mode_tarifaire: "global",
      pct_acompte_1: 30,
      pct_solde: 70,
      date_acompte_1: plus(7),
      date_solde: plus(60),
    } as any);
    if (e1) throw e1;
    const { error: e2 } = await supabase.from("cotation_lignes_fournisseurs").insert({
      user_id: userId,
      cotation_id: cotation.id,
      ordre: 2,
      nom_fournisseur: "[QA] Réceptif Tanzanie Safari",
      prestation: "Safari 5 jours",
      quantite: 1,
      devise: "USD",
      montant_devise: 5600,
      taux_change_vers_eur: 1.08,
      montant_eur: +(5600 / 1.08).toFixed(2),
      source_fx: "taux_couverture",
      couverture_id: cov.id,
      mode_tarifaire: "global",
      pct_acompte_1: 30,
      pct_solde: 70,
      date_acompte_1: plus(10),
      date_solde: plus(70),
    } as any);
    if (e2) throw e2;
    return "EUR 4 200 + USD 5 600 (couverts)";
  });

  // 6. Passage en option
  await run("options", async () => {
    await supabase.from("cotations").update({ statut: "en_option" }).eq("id", cotation.id);
    const { data: lignes } = await supabase
      .from("cotation_lignes_fournisseurs")
      .select("*")
      .eq("cotation_id", cotation.id);
    for (const l of lignes ?? []) {
      await supabase.from("fournisseur_options").insert({
        user_id: userId,
        cotation_id: cotation.id,
        ligne_fournisseur_id: l.id,
        nom_fournisseur: l.nom_fournisseur,
        prestation: l.prestation,
        email_fournisseur: "fournisseur@qa.test",
        statut: "a_demander",
        deadline_option_date: plus(5),
        deadline_option_time: "12:00",
      } as any);
    }
    return `${lignes?.length ?? 0} options auto-créées`;
  });

  // 7. Vol + deadline expirée
  await run("vol", async () => {
    await supabase.from("flight_options").insert({
      user_id: userId,
      cotation_id: cotation.id,
      compagnie: "[QA] Ethiopian Airlines",
      routing: "CDG-ADD-ZNZ",
      numero_vol: "ET505",
      date_depart: plus(90),
      heure_depart: "22:30",
      date_retour: plus(104),
      heure_retour: "06:15",
      prix: 3200,
      devise: "EUR",
      deadline_option_date: plus(7),
      deadline_option_time: "18:00",
      statut: "en_option",
    } as any);
    const { data: opts } = await supabase
      .from("fournisseur_options")
      .select("*")
      .eq("cotation_id", cotation.id);
    if (opts?.[0]) {
      const past = new Date(Date.now() - 2 * 3600000);
      await supabase
        .from("fournisseur_options")
        .update({
          deadline_option_date: past.toISOString().slice(0, 10),
          deadline_option_time: past.toISOString().slice(11, 16),
        })
        .eq("id", opts[0].id);
    }
    return "Vol Ethiopian + 1 deadline expirée (-2h)";
  });

  // 8. Acompte
  await run("acompte", async () => {
    const { error } = await supabase.from("paiements").insert({
      user_id: userId,
      type: "client_acompte",
      source: "manuel",
      methode: "virement",
      date: plus(0),
      montant: 4000,
      devise: "EUR",
      taux_change: 1,
      montant_eur: 4000,
      compte_id: cEur.id,
      personne_id: client.id,
    } as any);
    if (error) throw error;
    return "4 000 € sur compte EUR";
  });

  // 9. Confirm
  await run("confirm", async () => {
    await supabase
      .from("fournisseur_options")
      .update({ statut: "confirmee" })
      .eq("cotation_id", cotation.id);
    await supabase
      .from("flight_options")
      .update({ statut: "confirmee" })
      .eq("cotation_id", cotation.id);
    return "Toutes options confirmées";
  });

  // 10. Dossier + factures
  let dossier: any;
  await run("dossier", async () => {
    const { data, error } = await supabase
      .from("dossiers")
      .insert({
        user_id: userId,
        client_id: client.id,
        titre: "[QA] " + cotation.titre,
        statut: "confirme",
        prix_vente: 12800,
        cout_total: +coutTotal.toFixed(2),
        taux_tva_marge: 20,
      } as any)
      .select()
      .single();
    if (error) throw error;
    dossier = data;
    await supabase
      .from("cotations")
      .update({ statut: "transformee_en_dossier", dossier_id: dossier.id })
      .eq("id", cotation.id);
    const { data: lignes } = await supabase
      .from("cotation_lignes_fournisseurs")
      .select("*")
      .eq("cotation_id", cotation.id);
    for (const l of lignes ?? []) {
      await supabase.from("factures_fournisseurs").insert({
        user_id: userId,
        dossier_id: dossier.id,
        montant: l.montant_eur,
        devise: l.devise,
        montant_devise: l.montant_devise,
        taux_change: l.taux_change_vers_eur,
        montant_eur: l.montant_eur,
        date_echeance: l.date_solde,
        paye: false,
      } as any);
    }
    return `Dossier + ${lignes?.length ?? 0} factures`;
  });

  // 11. Tâches
  await run("tasks", async () => {
    const tasks = [
      { titre: "Confirmer rooming list", phase: "preparation", priorite: "importante", statut: "termine", date_echeance: plus(15) },
      { titre: "Réserver transferts aéroport", phase: "preparation", priorite: "importante", statut: "a_faire", date_echeance: plus(30) },
      { titre: "Envoyer carnet de voyage", phase: "preparation", priorite: "critique", statut: "en_cours", date_echeance: plus(80) },
      { titre: "Suivi pendant voyage", phase: "voyage", priorite: "normale", statut: "a_faire", date_echeance: plus(95) },
      { titre: "Demander avis client", phase: "retour", priorite: "normale", statut: "a_faire", date_echeance: plus(110) },
    ];
    for (const t of tasks) {
      await supabase.from("dossier_tasks").insert({
        user_id: userId,
        dossier_id: dossier.id,
        ...t,
        completed_at: t.statut === "termine" ? new Date().toISOString() : null,
      } as any);
    }
    return "5 tâches (1 terminée, 1 en cours, 3 à faire)";
  });

  // 12. Paiement fournisseur
  await run("tresorerie", async () => {
    const { error } = await supabase.from("paiements").insert({
      user_id: userId,
      type: "fournisseur_acompte",
      source: "manuel",
      methode: "virement",
      date: plus(0),
      montant: 1260,
      devise: "EUR",
      taux_change: 1,
      montant_eur: 1260,
      compte_id: cEur.id,
      dossier_id: dossier.id,
    } as any);
    if (error) throw error;
    return "Acompte 30 % Zanzibar = 1 260 €";
  });

  // 13. Bank tx
  await run("bank", async () => {
    const { error } = await supabase.from("bank_transactions").insert({
      user_id: userId,
      compte_id: cEur.id,
      source_banque: "cic",
      sens: "credit",
      montant: 4000,
      libelle_normalise: "VIR DUPONT ACOMPTE TANZANIE",
      libelle_original: "VIREMENT RECU DUPONT REF TANZANIE",
      date: plus(0),
      devise: "EUR",
      statut: "nouveau",
      hash_unique: `qa-${Date.now()}-vir-dupont`,
    } as any);
    if (error) throw error;
    return "4 000 € en attente de rapprochement";
  });

  return steps;
}

/** Supprime toutes les entités préfixées [QA] du compte courant. */
export async function cleanupQaData(userId: string): Promise<void> {
  // Ordre : enfants puis parents (RLS auto user_id)
  await supabase.from("dossier_tasks").delete().eq("user_id", userId).ilike("titre", "%");
  await supabase.from("factures_fournisseurs").delete().eq("user_id", userId);
  await supabase.from("flight_options").delete().eq("user_id", userId).ilike("compagnie", "[QA]%");
  await supabase.from("fournisseur_options").delete().eq("user_id", userId).ilike("nom_fournisseur", "[QA]%");
  await supabase.from("cotation_lignes_fournisseurs").delete().eq("user_id", userId).ilike("nom_fournisseur", "[QA]%");
  await supabase.from("bank_transactions").delete().eq("user_id", userId).ilike("libelle_normalise", "%DUPONT%");
  await supabase.from("paiements").delete().eq("user_id", userId);
  await supabase.from("cotations").delete().eq("user_id", userId).ilike("titre", "[QA]%");
  await supabase.from("dossiers").delete().eq("user_id", userId).ilike("titre", "[QA]%");
  await supabase.from("demandes").delete().eq("user_id", userId).ilike("nom_client", "[QA]%");
  await supabase.from("contacts").delete().eq("user_id", userId).ilike("nom", "[QA]%");
  await supabase.from("fx_coverages").delete().eq("user_id", userId).ilike("reference", "[QA]%");
  await supabase.from("comptes").delete().eq("user_id", userId).ilike("nom", "[QA]%");
}

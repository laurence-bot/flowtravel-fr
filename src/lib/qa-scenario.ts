// Scénario E2E exécutable côté client.
// Insère des données préfixées [QA] sur le compte connecté.
// Toutes les écritures sont protégées par RLS (auth.uid() = user_id).

import { supabase } from "@/integrations/supabase/client";

export type QaStep = {
  key: string;
  label: string;
  status: "pending" | "running" | "ok" | "ko";
  detail?: string;
  /** Route à ouvrir pour visualiser le résultat de cette étape. */
  viewRoute?: string;
  /** Description courte de ce que fait l'étape. */
  description?: string;
};

export type QaProgress = (steps: QaStep[]) => void;

const plus = (d: number) =>
  new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

/** État partagé entre étapes — persisté côté composant. */
export type QaState = {
  cEur?: any;
  cUsd?: any;
  cov?: any;
  client?: any;
  demande?: any;
  cotation?: any;
  dossier?: any;
};

const coutTotal = 4200 + 5600 / 1.08;

/** Définition ordonnée des étapes — chacune est une fonction async indépendante. */
export const QA_STEPS: Array<{
  key: string;
  label: string;
  description: string;
  viewRoute: string;
  run: (userId: string, state: QaState) => Promise<string>;
}> = [
  {
    key: "client",
    label: "1. Créer client + demande",
    description:
      "Crée un contact « Famille Dupont » et une demande Tanzanie pour 4 personnes (~12 000 €).",
    viewRoute: "/demandes",
    run: async (userId, state) => {
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
      state.client = c;
      const { data: d, error: e2 } = await supabase
        .from("demandes")
        .insert({
          user_id: userId,
          client_id: c.id,
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
      state.demande = d;
      return "Demande créée — voir page Demandes";
    },
  },
  {
    key: "comptes",
    label: "2. Créer comptes bancaires EUR + USD",
    description: "Crée deux comptes bancaires : un EUR (CIC) et un USD (Ebury).",
    viewRoute: "/comptes",
    run: async (userId, state) => {
      const { data: e, error: e1 } = await supabase
        .from("comptes")
        .insert({
          user_id: userId,
          nom: "[QA] Compte EUR",
          banque: "cic",
          categorie: "gestion",
          devise: "EUR",
          solde_initial: 0,
        } as any)
        .select()
        .single();
      if (e1) throw e1;
      state.cEur = e;
      const { data: u, error: e2 } = await supabase
        .from("comptes")
        .insert({
          user_id: userId,
          nom: "[QA] Compte USD",
          banque: "ebury",
          categorie: "gestion",
          devise: "USD",
          solde_initial: 0,
        } as any)
        .select()
        .single();
      if (e2) throw e2;
      state.cUsd = u;
      return "2 comptes créés (EUR + USD)";
    },
  },
  {
    key: "fx",
    label: "3. Acheter une couverture FX 10 000 USD @ 1.08",
    description:
      "Crée une couverture de change pour sécuriser un futur paiement fournisseur en USD.",
    viewRoute: "/couvertures-fx",
    run: async (userId, state) => {
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
      state.cov = data;
      return "Couverture 10 000 USD @ 1.08 créée";
    },
  },
  {
    key: "cotation",
    label: "4. Créer la cotation Tanzanie (12 800 € TTC)",
    description:
      "Cotation rattachée à la demande, régime TVA marge UE, prix de vente 12 800 € TTC.",
    viewRoute: "/cotations",
    run: async (userId, state) => {
      if (!state.client || !state.demande)
        throw new Error("Étape 1 (client + demande) requise d'abord.");
      const { data, error } = await supabase
        .from("cotations")
        .insert({
          user_id: userId,
          client_id: state.client.id,
          demande_id: state.demande.id,
          titre: "[QA] Tanzanie · Dupont · Safari + Zanzibar",
          destination: "Tanzanie",
          date_depart: state.demande.date_depart_souhaitee,
          date_retour: state.demande.date_retour_souhaitee,
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
      state.cotation = data;
      return `Cotation créée · marge nette ≈ ${(((12800 - coutTotal) / 1.2) * 0.8).toFixed(0)} €`;
    },
  },
  {
    key: "lignes",
    label: "5. Ajouter lignes fournisseurs (EUR + USD couverts)",
    description:
      "Ligne 1 : Hôtel Zanzibar 4 200 € · Ligne 2 : Safari 5 600 USD adossé à la couverture FX.",
    viewRoute: "/cotations",
    run: async (userId, state) => {
      if (!state.cotation) throw new Error("Étape 4 (cotation) requise d'abord.");
      if (!state.cov) throw new Error("Étape 3 (couverture FX) requise d'abord.");
      const { error: e1 } = await supabase.from("cotation_lignes_fournisseurs").insert({
        user_id: userId,
        cotation_id: state.cotation.id,
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
        cotation_id: state.cotation.id,
        ordre: 2,
        nom_fournisseur: "[QA] Réceptif Tanzanie Safari",
        prestation: "Safari 5 jours",
        quantite: 1,
        devise: "USD",
        montant_devise: 5600,
        taux_change_vers_eur: 1.08,
        montant_eur: +(5600 / 1.08).toFixed(2),
        source_fx: "couverture",
        couverture_id: state.cov.id,
        mode_tarifaire: "global",
        pct_acompte_1: 30,
        pct_solde: 70,
        date_acompte_1: plus(10),
        date_solde: plus(70),
      } as any);
      if (e2) throw e2;
      return "EUR 4 200 + USD 5 600 (couverts à 1.08)";
    },
  },
  {
    key: "options",
    label: "6. Passer la cotation en option (auto-options fournisseurs)",
    description:
      "Change le statut en « en option » et crée automatiquement une demande d'option par fournisseur.",
    viewRoute: "/cotations",
    run: async (userId, state) => {
      if (!state.cotation) throw new Error("Étape 4 requise.");
      await supabase
        .from("cotations")
        .update({ statut: "en_option" })
        .eq("id", state.cotation.id);
      const { data: lignes } = await supabase
        .from("cotation_lignes_fournisseurs")
        .select("*")
        .eq("cotation_id", state.cotation.id);
      for (const l of lignes ?? []) {
        await supabase.from("fournisseur_options").insert({
          user_id: userId,
          cotation_id: state.cotation.id,
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
    },
  },
  {
    key: "vol",
    label: "7. Ajouter une option vol + simuler deadline expirée",
    description:
      "Option Ethiopian Airlines CDG-ADD-ZNZ + une deadline forcée à -2h pour tester l'alerte.",
    viewRoute: "/",
    run: async (userId, state) => {
      if (!state.cotation) throw new Error("Étape 4 requise.");
      await supabase.from("flight_options").insert({
        user_id: userId,
        cotation_id: state.cotation.id,
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
        .eq("cotation_id", state.cotation.id);
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
      return "Vol + 1 deadline expirée — visible sur le dashboard";
    },
  },
  {
    key: "acompte",
    label: "8. Encaisser l'acompte client (4 000 €)",
    description: "Crée un paiement entrant de 4 000 € sur le compte EUR.",
    viewRoute: "/paiements",
    run: async (userId, state) => {
      if (!state.cEur) throw new Error("Étape 2 (comptes) requise.");
      if (!state.client) throw new Error("Étape 1 (client) requise.");
      const { error } = await supabase.from("paiements").insert({
        user_id: userId,
        type: "paiement_client",
        source: "manuel",
        methode: "virement",
        date: plus(0),
        montant: 4000,
        devise: "EUR",
        taux_change: 1,
        montant_eur: 4000,
        compte_id: state.cEur.id,
        personne_id: state.client.id,
      } as any);
      if (error) throw error;
      return "4 000 € encaissés sur compte EUR";
    },
  },
  {
    key: "confirm",
    label: "9. Confirmer les options fournisseurs",
    description: "Passe toutes les options (fournisseurs + vol) au statut « confirmée ».",
    viewRoute: "/cotations",
    run: async (_userId, state) => {
      if (!state.cotation) throw new Error("Étape 4 requise.");
      await supabase
        .from("fournisseur_options")
        .update({ statut: "confirmee" })
        .eq("cotation_id", state.cotation.id);
      await supabase
        .from("flight_options")
        .update({ statut: "confirmee" })
        .eq("cotation_id", state.cotation.id);
      return "Toutes options confirmées";
    },
  },
  {
    key: "dossier",
    label: "10. Transformer en dossier + générer factures fournisseurs",
    description:
      "Crée le dossier de voyage confirmé et une facture fournisseur par ligne de cotation.",
    viewRoute: "/dossiers",
    run: async (userId, state) => {
      if (!state.cotation) throw new Error("Étape 4 requise.");
      if (!state.client) throw new Error("Étape 1 requise.");
      const { data, error } = await supabase
        .from("dossiers")
        .insert({
          user_id: userId,
          client_id: state.client.id,
          titre: "[QA] " + state.cotation.titre,
          statut: "confirme",
          prix_vente: 12800,
          cout_total: +coutTotal.toFixed(2),
          taux_tva_marge: 20,
        } as any)
        .select()
        .single();
      if (error) throw error;
      state.dossier = data;
      await supabase
        .from("cotations")
        .update({ statut: "transformee_en_dossier", dossier_id: data.id })
        .eq("id", state.cotation.id);
      const { data: lignes } = await supabase
        .from("cotation_lignes_fournisseurs")
        .select("*")
        .eq("cotation_id", state.cotation.id);
      for (const l of lignes ?? []) {
        await supabase.from("factures_fournisseurs").insert({
          user_id: userId,
          dossier_id: data.id,
          montant: l.montant_eur,
          devise: l.devise,
          montant_devise: l.montant_devise,
          taux_change: l.taux_change_vers_eur,
          montant_eur: l.montant_eur,
          date_echeance: l.date_solde,
          paye: false,
        } as any);
      }
      return `Dossier + ${lignes?.length ?? 0} factures créées`;
    },
  },
  {
    key: "tasks",
    label: "11. Générer la checklist opérationnelle (5 tâches)",
    description: "Tâches pré-départ, pendant et après voyage avec différents statuts.",
    viewRoute: "/dossiers",
    run: async (userId, state) => {
      if (!state.dossier) throw new Error("Étape 10 (dossier) requise.");
      const tasks = [
        { titre: "Confirmer rooming list", phase: "pre_depart", priorite: "importante", statut: "termine", date_echeance: plus(15) },
        { titre: "Réserver transferts aéroport", phase: "pre_depart", priorite: "importante", statut: "a_faire", date_echeance: plus(30) },
        { titre: "Envoyer carnet de voyage", phase: "pre_depart", priorite: "critique", statut: "en_cours", date_echeance: plus(80) },
        { titre: "Suivi pendant voyage", phase: "pendant", priorite: "normale", statut: "a_faire", date_echeance: plus(95) },
        { titre: "Demander avis client", phase: "apres", priorite: "normale", statut: "a_faire", date_echeance: plus(110) },
      ];
      for (const t of tasks) {
        await supabase.from("dossier_tasks").insert({
          user_id: userId,
          dossier_id: state.dossier.id,
          ...t,
          completed_at: t.statut === "termine" ? new Date().toISOString() : null,
        } as any);
      }
      return "5 tâches créées";
    },
  },
  {
    key: "tresorerie",
    label: "12. Régler l'acompte fournisseur Zanzibar (1 260 €)",
    description: "Paiement sortant de 30 % sur l'hôtel Zanzibar.",
    viewRoute: "/paiements",
    run: async (userId, state) => {
      if (!state.cEur || !state.dossier) throw new Error("Étapes 2 et 10 requises.");
      const { error } = await supabase.from("paiements").insert({
        user_id: userId,
        type: "paiement_fournisseur",
        source: "manuel",
        methode: "virement",
        date: plus(0),
        montant: 1260,
        devise: "EUR",
        taux_change: 1,
        montant_eur: 1260,
        compte_id: state.cEur.id,
        dossier_id: state.dossier.id,
      } as any);
      if (error) throw error;
      return "1 260 € versés à l'hôtel Zanzibar";
    },
  },
  {
    key: "bank",
    label: "13. Importer une transaction bancaire à rapprocher",
    description:
      "Simule un virement reçu de 4 000 € à rapprocher avec l'acompte client.",
    viewRoute: "/rapprochement",
    run: async (userId, state) => {
      if (!state.cEur) throw new Error("Étape 2 requise.");
      const { error } = await supabase.from("bank_transactions").insert({
        user_id: userId,
        compte_id: state.cEur.id,
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
    },
  },
];

/** Exécute toutes les étapes d'affilée (ancien comportement). */
export async function runQaScenario(
  userId: string,
  onProgress: QaProgress,
): Promise<QaStep[]> {
  const steps: QaStep[] = QA_STEPS.map((s) => ({
    key: s.key,
    label: s.label,
    description: s.description,
    viewRoute: s.viewRoute,
    status: "pending",
  }));
  const state: QaState = {};
  const update = (k: string, patch: Partial<QaStep>) => {
    const i = steps.findIndex((s) => s.key === k);
    if (i >= 0) steps[i] = { ...steps[i], ...patch };
    onProgress([...steps]);
  };
  for (const def of QA_STEPS) {
    update(def.key, { status: "running" });
    try {
      const detail = await def.run(userId, state);
      update(def.key, { status: "ok", detail });
    } catch (e) {
      update(def.key, { status: "ko", detail: (e as Error).message });
      throw e;
    }
  }
  return steps;
}

/** Supprime toutes les entités préfixées [QA] du compte courant. */
export async function cleanupQaData(userId: string): Promise<void> {
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

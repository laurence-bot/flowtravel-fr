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

export type QaDetailField = { label: string; value: string; mono?: boolean };
export type QaDetail = {
  title: string;
  fields: QaDetailField[];
  detailRoute?: string;
  actions?: { label: string; route: string }[];
  groups?: { title: string; fields: QaDetailField[] }[];
};

const fmtEUR = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
const fmtUSD = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD" }).format(n);
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR") : "—";

/** Construit un panneau de détail riche pour une étape donnée. */
export async function getStepDetails(
  key: string,
  state: QaState,
): Promise<QaDetail | null> {
  switch (key) {
    case "client": {
      if (!state.client || !state.demande) return null;
      return {
        title: "Client + demande créés",
        detailRoute: `/demandes/${state.demande.id}`,
        actions: [
          { label: "Ouvrir la fiche client", route: `/contacts/${state.client.id}` },
          { label: "Ouvrir la demande", route: `/demandes/${state.demande.id}` },
        ],
        fields: [
          { label: "Client", value: state.client.nom },
          { label: "Email", value: state.client.email ?? "—" },
          { label: "Destination", value: state.demande.destination },
          { label: "Départ", value: fmtDate(state.demande.date_depart_souhaitee) },
          { label: "Retour", value: fmtDate(state.demande.date_retour_souhaitee) },
          { label: "Voyageurs", value: `${state.demande.nombre_pax} pax` },
          { label: "Budget", value: fmtEUR(Number(state.demande.budget ?? 0)) },
          { label: "Canal", value: state.demande.canal },
          { label: "Statut", value: state.demande.statut },
        ],
      };
    }
    case "comptes": {
      if (!state.cEur || !state.cUsd) return null;
      return {
        title: "Comptes bancaires",
        detailRoute: "/comptes",
        groups: [
          {
            title: "Compte EUR",
            fields: [
              { label: "Nom", value: state.cEur.nom },
              { label: "Banque", value: state.cEur.banque.toUpperCase() },
              { label: "Devise", value: state.cEur.devise },
            ],
          },
          {
            title: "Compte USD",
            fields: [
              { label: "Nom", value: state.cUsd.nom },
              { label: "Banque", value: state.cUsd.banque.toUpperCase() },
              { label: "Devise", value: state.cUsd.devise },
            ],
          },
        ],
        fields: [],
      };
    }
    case "fx": {
      if (!state.cov) return null;
      return {
        title: "Couverture de change",
        detailRoute: "/couvertures-fx",
        fields: [
          { label: "Référence", value: state.cov.reference },
          { label: "Devise", value: state.cov.devise },
          { label: "Montant couvert", value: fmtUSD(Number(state.cov.montant_devise)) },
          { label: "Taux fixé", value: `1 EUR = ${state.cov.taux_change} USD`, mono: true },
          {
            label: "Contre-valeur EUR",
            value: fmtEUR(Number(state.cov.montant_devise) / Number(state.cov.taux_change)),
          },
          { label: "Ouverture", value: fmtDate(state.cov.date_ouverture) },
          { label: "Échéance", value: fmtDate(state.cov.date_echeance) },
          { label: "Statut", value: state.cov.statut },
        ],
      };
    }
    case "cotation": {
      if (!state.cotation) return null;
      const c = state.cotation;
      return {
        title: "Cotation créée",
        detailRoute: `/cotations/${c.id}`,
        fields: [
          { label: "Titre", value: c.titre },
          { label: "Destination", value: c.destination },
          { label: "Voyageurs", value: `${c.nombre_pax} pax · ${c.nombre_chambres} chambres` },
          { label: "Départ", value: fmtDate(c.date_depart) },
          { label: "Retour", value: fmtDate(c.date_retour) },
          { label: "Régime TVA", value: c.regime_tva },
          { label: "Taux TVA marge", value: `${c.taux_tva_marge} %` },
          { label: "Prix de vente TTC", value: fmtEUR(Number(c.prix_vente_ttc)) },
          { label: "Prix de vente HT", value: fmtEUR(Number(c.prix_vente_ht)) },
          { label: "Statut", value: c.statut },
        ],
      };
    }
    case "lignes": {
      if (!state.cotation) return null;
      const { data: lignes } = await supabase
        .from("cotation_lignes_fournisseurs")
        .select("*")
        .eq("cotation_id", state.cotation.id)
        .order("ordre");
      const groups = (lignes ?? []).map((l: any) => ({
        title: `Ligne ${l.ordre} · ${l.nom_fournisseur}`,
        fields: [
          { label: "Prestation", value: l.prestation ?? "—" },
          { label: "Devise", value: l.devise },
          {
            label: "Montant",
            value:
              l.devise === "USD"
                ? fmtUSD(Number(l.montant_devise))
                : fmtEUR(Number(l.montant_devise)),
          },
          {
            label: "Taux",
            value: `1 EUR = ${l.taux_change_vers_eur} ${l.devise}`,
            mono: true,
          },
          { label: "Contre-valeur EUR", value: fmtEUR(Number(l.montant_eur)) },
          { label: "Source FX", value: l.source_fx },
          { label: "Acompte 1", value: `${l.pct_acompte_1}% · ${fmtDate(l.date_acompte_1)}` },
          { label: "Solde", value: `${l.pct_solde}% · ${fmtDate(l.date_solde)}` },
        ],
      }));
      const totalEUR = (lignes ?? []).reduce((s: number, l: any) => s + Number(l.montant_eur), 0);
      return {
        title: `${lignes?.length ?? 0} lignes fournisseurs`,
        detailRoute: `/cotations/${state.cotation.id}`,
        fields: [{ label: "Coût total", value: fmtEUR(totalEUR) }],
        groups,
      };
    }
    case "options": {
      if (!state.cotation) return null;
      const { data: opts } = await supabase
        .from("fournisseur_options")
        .select("*")
        .eq("cotation_id", state.cotation.id);
      return {
        title: `${opts?.length ?? 0} options fournisseurs`,
        detailRoute: `/cotations/${state.cotation.id}`,
        fields: (opts ?? []).flatMap((o: any) => [
          {
            label: o.nom_fournisseur,
            value: `${o.statut} · deadline ${fmtDate(o.deadline_option_date)} ${o.deadline_option_time ?? ""}`,
          },
        ]),
      };
    }
    case "vol": {
      if (!state.cotation) return null;
      const { data: vols } = await supabase
        .from("flight_options")
        .select("*")
        .eq("cotation_id", state.cotation.id);
      const v = vols?.[0];
      if (!v) return null;
      return {
        title: "Option vol ajoutée",
        detailRoute: `/cotations/${state.cotation.id}`,
        fields: [
          { label: "Compagnie", value: v.compagnie },
          { label: "Routing", value: v.routing },
          { label: "N° vol", value: v.numero_vol ?? "—" },
          { label: "Aller", value: `${fmtDate(v.date_depart)} ${v.heure_depart ?? ""}` },
          { label: "Retour", value: `${fmtDate(v.date_retour)} ${v.heure_retour ?? ""}` },
          { label: "Prix", value: fmtEUR(Number(v.prix)) },
          { label: "Deadline", value: `${fmtDate(v.deadline_option_date)} ${v.deadline_option_time ?? ""}` },
        ],
      };
    }
    case "acompte": {
      const { data: pays } = await supabase
        .from("paiements")
        .select("*")
        .eq("type", "paiement_client")
        .order("created_at", { ascending: false })
        .limit(1);
      const p = pays?.[0];
      if (!p) return null;
      return {
        title: "Acompte client encaissé",
        detailRoute: "/paiements",
        fields: [
          { label: "Type", value: p.type },
          { label: "Méthode", value: p.methode },
          { label: "Date", value: fmtDate(p.date) },
          { label: "Montant", value: fmtEUR(Number(p.montant)) },
          { label: "Devise", value: p.devise },
          { label: "Compte", value: state.cEur?.nom ?? "—" },
        ],
      };
    }
    case "confirm": {
      if (!state.cotation) return null;
      const { count: nbOpts } = await supabase
        .from("fournisseur_options")
        .select("id", { count: "exact", head: true })
        .eq("cotation_id", state.cotation.id)
        .eq("statut", "confirmee");
      return {
        title: "Options confirmées",
        detailRoute: `/cotations/${state.cotation.id}`,
        fields: [
          { label: "Fournisseurs confirmés", value: String(nbOpts ?? 0) },
          { label: "Vol confirmé", value: "Oui" },
        ],
      };
    }
    case "dossier": {
      if (!state.dossier) return null;
      const d = state.dossier;
      const { data: facts } = await supabase
        .from("factures_fournisseurs")
        .select("*")
        .eq("dossier_id", d.id);
      return {
        title: "Dossier de voyage",
        detailRoute: `/dossiers/${d.id}`,
        fields: [
          { label: "Titre", value: d.titre },
          { label: "Statut", value: d.statut },
          { label: "Prix de vente", value: fmtEUR(Number(d.prix_vente)) },
          { label: "Coût total", value: fmtEUR(Number(d.cout_total)) },
          {
            label: "Marge brute",
            value: fmtEUR(Number(d.prix_vente) - Number(d.cout_total)),
          },
          { label: "Factures fournisseurs", value: `${facts?.length ?? 0} créées` },
        ],
        groups: (facts ?? []).map((f: any, i: number) => ({
          title: `Facture ${i + 1}`,
          fields: [
            { label: "Devise", value: f.devise },
            {
              label: "Montant",
              value:
                f.devise === "USD"
                  ? fmtUSD(Number(f.montant_devise ?? f.montant))
                  : fmtEUR(Number(f.montant)),
            },
            { label: "Contre-valeur EUR", value: fmtEUR(Number(f.montant_eur ?? f.montant)) },
            { label: "Échéance", value: fmtDate(f.date_echeance) },
            { label: "Payée", value: f.paye ? "Oui" : "Non" },
          ],
        })),
      };
    }
    case "tasks": {
      if (!state.dossier) return null;
      const { data: tasks } = await supabase
        .from("dossier_tasks")
        .select("*")
        .eq("dossier_id", state.dossier.id)
        .order("date_echeance");
      return {
        title: `${tasks?.length ?? 0} tâches opérationnelles`,
        detailRoute: `/dossiers/${state.dossier.id}`,
        fields: (tasks ?? []).map((t: any) => ({
          label: t.titre,
          value: `${t.phase} · ${t.priorite} · ${t.statut} · ${fmtDate(t.date_echeance)}`,
        })),
      };
    }
    case "tresorerie": {
      const { data: pays } = await supabase
        .from("paiements")
        .select("*")
        .eq("type", "paiement_fournisseur")
        .order("created_at", { ascending: false })
        .limit(1);
      const p = pays?.[0];
      if (!p) return null;
      return {
        title: "Paiement fournisseur",
        detailRoute: "/paiements",
        fields: [
          { label: "Type", value: p.type },
          { label: "Méthode", value: p.methode },
          { label: "Date", value: fmtDate(p.date) },
          { label: "Montant", value: fmtEUR(Number(p.montant)) },
        ],
      };
    }
    case "bank": {
      const { data: txs } = await supabase
        .from("bank_transactions")
        .select("*")
        .ilike("libelle_normalise", "%DUPONT%")
        .order("created_at", { ascending: false })
        .limit(1);
      const t = txs?.[0];
      if (!t) return null;
      return {
        title: "Transaction bancaire à rapprocher",
        detailRoute: "/rapprochement",
        fields: [
          { label: "Libellé", value: t.libelle_normalise },
          { label: "Sens", value: t.sens },
          { label: "Montant", value: fmtEUR(Number(t.montant)) },
          { label: "Date", value: fmtDate(t.date) },
          { label: "Statut", value: t.statut },
        ],
      };
    }
  }
  return null;
}

/** Recharge l'état QA depuis la base via les préfixes [QA] — utile en lecture seule
 * ou après un rechargement de page pour réafficher tous les détails. */
export async function loadQaStateFromDb(userId: string): Promise<QaState> {
  const state: QaState = {};
  const [{ data: demandes }, { data: clients }, { data: comptes }, { data: covs }, { data: cotations }, { data: dossiers }] =
    await Promise.all([
      supabase.from("demandes").select("*").eq("user_id", userId).ilike("nom_client", "[QA]%").order("created_at", { ascending: false }).limit(1),
      supabase.from("contacts").select("*").eq("user_id", userId).ilike("nom", "[QA]%").order("created_at", { ascending: false }).limit(1),
      supabase.from("comptes").select("*").eq("user_id", userId).ilike("nom", "[QA]%"),
      supabase.from("fx_coverages").select("*").eq("user_id", userId).ilike("reference", "[QA]%").order("created_at", { ascending: false }).limit(1),
      supabase.from("cotations").select("*").eq("user_id", userId).ilike("titre", "[QA]%").order("created_at", { ascending: false }).limit(1),
      supabase.from("dossiers").select("*").eq("user_id", userId).ilike("titre", "[QA]%").order("created_at", { ascending: false }).limit(1),
    ]);
  const demande = demandes?.[0];
  const client = clients?.[0];
  const cov = covs?.[0];
  const cotation = cotations?.[0];
  const dossier = dossiers?.[0];
  if (client) state.client = client;
  if (demande) state.demande = demande;
  if (cov) state.cov = cov;
  if (cotation) state.cotation = cotation;
  if (dossier) state.dossier = dossier;
  if (comptes) {
    state.cEur = comptes.find((c: any) => c.devise === "EUR");
    state.cUsd = comptes.find((c: any) => c.devise === "USD");
  }
  if (!state.client && demande?.client_id) {
    const { data: linkedClient } = await supabase
      .from("contacts").select("*").eq("user_id", userId).eq("id", demande.client_id).maybeSingle();
    if (linkedClient) state.client = linkedClient;
  }
  return state;
}

/** Quelles étapes ont effectivement des données présentes en base, d'après l'état rechargé. */
export function detectCompletedSteps(state: QaState): string[] {
  const done: string[] = [];
  if (state.client && state.demande) done.push("client");
  if (state.cEur && state.cUsd) done.push("comptes");
  if (state.cov) done.push("fx");
  if (state.cotation) done.push("cotation", "lignes", "options", "vol", "confirm");
  if (state.cEur && state.client) done.push("acompte");
  if (state.dossier) done.push("dossier", "tasks", "tresorerie");
  if (state.cEur) done.push("bank");
  return done;
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

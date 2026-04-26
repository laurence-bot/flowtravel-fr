/**
 * Prévision de trésorerie (cash forecast).
 * Projette jour par jour le solde en tenant compte :
 *  - de la trésorerie actuelle (soldes des comptes incluant les paiements déjà passés)
 *  - des encaissements clients attendus (reste à encaisser sur les dossiers)
 *  - des décaissements fournisseurs prévus (factures non payées avec échéance)
 */
import type { Dossier, Paiement, Facture, Compte, Transfert, Contact } from "@/hooks/use-data";
import { computeComptesSoldes, computeDossierFinance } from "./finance";

export type ForecastPoint = {
  date: string; // ISO yyyy-mm-dd
  solde: number;
  entrees: number;
  sorties: number;
  evenements: ForecastEvent[];
};

export type ForecastEvent = {
  type: "encaissement" | "decaissement";
  label: string;
  montant: number;
  source: "dossier" | "facture";
  refId: string;
};

export type ForecastAlert = {
  date: string;
  type: "tresorerie_negative" | "pic_decaissement";
  message: string;
  montant: number;
};

export type CashForecast = {
  soldeInitial: number;
  soldeFinal: number;
  totalEntrees: number;
  totalSorties: number;
  pointBas: ForecastPoint | null;
  points: ForecastPoint[];
  alertes: ForecastAlert[];
};

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toISO = (d: Date) => d.toISOString().slice(0, 10);

const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

/**
 * Heuristique d'étalement : si une échéance n'est pas définie pour un encaissement
 * client attendu, on la place à 30 jours après aujourd'hui (acompte/solde voyage).
 */
const DEFAULT_CLIENT_DELAY_DAYS = 30;

export function computeCashForecast(
  periodDays: 7 | 30 | 90,
  inputs: {
    comptes: Compte[];
    paiements: Paiement[];
    transferts: Transfert[];
    dossiers: Dossier[];
    factures: Facture[];
    contacts?: Contact[];
  },
): CashForecast {
  const { comptes, paiements, transferts, dossiers, factures, contacts = [] } = inputs;

  // 1. Trésorerie actuelle (= somme des soldes des comptes, qui intègrent déjà les paiements passés)
  const soldes = computeComptesSoldes(comptes, paiements, transferts);
  const soldeInitial = soldes.reduce((s, c) => s + c.solde, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizonEnd = addDays(today, periodDays);

  const contactName = (id: string | null) =>
    contacts.find((c) => c.id === id)?.nom ?? null;

  // 2. Évènements futurs : encaissements clients (reste à encaisser par dossier)
  const events: { date: Date; ev: ForecastEvent }[] = [];
  for (const d of dossiers) {
    if (d.statut === "cloture") continue;
    const fin = computeDossierFinance(d, paiements, factures);
    if (fin.resteAEncaisser <= 0.01) continue;
    const dueDate = addDays(today, DEFAULT_CLIENT_DELAY_DAYS);
    if (dueDate > horizonEnd) continue;
    const clientLabel = contactName(d.client_id);
    events.push({
      date: dueDate,
      ev: {
        type: "encaissement",
        label: `${d.titre}${clientLabel ? ` · ${clientLabel}` : ""}`,
        montant: fin.resteAEncaisser,
        source: "dossier",
        refId: d.id,
      },
    });
  }

  // 3. Évènements futurs : décaissements fournisseurs (factures non payées)
  for (const f of factures) {
    if (f.paye) continue;
    const montant = num(f.montant);
    if (montant <= 0.01) continue;
    const due = f.date_echeance ? new Date(f.date_echeance) : addDays(today, 7);
    due.setHours(0, 0, 0, 0);
    // Échéances passées : on les place dès aujourd'hui (à payer sans délai)
    const eventDate = due < today ? today : due;
    if (eventDate > horizonEnd) continue;
    const fournisseur = contactName(f.fournisseur_id);
    const dossier = dossiers.find((d) => d.id === f.dossier_id);
    const label = [fournisseur, dossier?.titre].filter(Boolean).join(" · ") || "Facture fournisseur";
    events.push({
      date: eventDate,
      ev: {
        type: "decaissement",
        label,
        montant,
        source: "facture",
        refId: f.id,
      },
    });
  }

  // 4. Construction de la courbe jour par jour
  const points: ForecastPoint[] = [];
  let runningSolde = soldeInitial;
  let totalEntrees = 0;
  let totalSorties = 0;
  const alertes: ForecastAlert[] = [];

  for (let i = 0; i <= periodDays; i++) {
    const day = addDays(today, i);
    const iso = toISO(day);
    const dayEvents = events.filter((e) => toISO(e.date) === iso).map((e) => e.ev);
    const entrees = dayEvents
      .filter((e) => e.type === "encaissement")
      .reduce((s, e) => s + e.montant, 0);
    const sorties = dayEvents
      .filter((e) => e.type === "decaissement")
      .reduce((s, e) => s + e.montant, 0);

    runningSolde += entrees - sorties;
    totalEntrees += entrees;
    totalSorties += sorties;

    const point: ForecastPoint = {
      date: iso,
      solde: runningSolde,
      entrees,
      sorties,
      evenements: dayEvents,
    };
    points.push(point);

    if (runningSolde < 0) {
      alertes.push({
        date: iso,
        type: "tresorerie_negative",
        message: "Trésorerie projetée négative",
        montant: runningSolde,
      });
    }
    // Pic de décaissement : un jour qui draine plus de 30 % du solde initial (et > 5 000 €)
    if (sorties > 0 && soldeInitial > 0 && sorties > Math.max(5000, soldeInitial * 0.3)) {
      alertes.push({
        date: iso,
        type: "pic_decaissement",
        message: "Pic de paiements fournisseurs",
        montant: sorties,
      });
    }
  }

  const pointBas = points.length
    ? points.reduce((min, p) => (p.solde < min.solde ? p : min), points[0])
    : null;

  return {
    soldeInitial,
    soldeFinal: runningSolde,
    totalEntrees,
    totalSorties,
    pointBas,
    points,
    alertes,
  };
}

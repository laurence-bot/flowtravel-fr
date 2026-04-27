/**
 * Calcul des écarts de change (gain/perte FX) — Lot 4.
 *
 * Principe :
 *  - Pour chaque échéance / paiement en devise étrangère, on compare :
 *      * EUR effectif appliqué (taux réservé via couverture, ou taux saisi)
 *      * EUR théorique au "taux du jour" (référence par devise) à la date considérée
 *  - L'écart est positif (gain) si EUR effectif < EUR théorique côté décaissement
 *    fournisseur (on a payé moins cher en euros qu'au taux du marché).
 */
import type {
  Facture,
  FactureEcheance,
  Paiement,
} from "@/hooks/use-data";
import type {
  DeviseCode,
  FxCoverage,
  FxReservation,
} from "@/lib/fx";
import { factureEUR, paiementEUR } from "@/lib/finance";

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Taux de référence indicatifs par devise (EUR pour 1 unité). À terme : table dédiée. */
export const REFERENCE_RATES: Record<DeviseCode, number> = {
  EUR: 1,
  USD: 0.92,
  GBP: 1.17,
  ZAR: 0.05,
  CHF: 1.05,
  CAD: 0.68,
  AUD: 0.61,
  JPY: 0.0061,
  AED: 0.25,
  MAD: 0.092,
  TND: 0.30,
};

export type FxPnlEntry = {
  id: string;
  source: "echeance" | "paiement" | "facture";
  devise: DeviseCode;
  montantDevise: number;
  tauxApplique: number;
  tauxReference: number;
  eurApplique: number;
  eurReference: number;
  ecart: number; // > 0 = gain ; < 0 = perte
  couvert: boolean;
};

export function pnlForEcheance(
  e: FactureEcheance,
  reservations: FxReservation[],
): FxPnlEntry | null {
  if (e.devise === "EUR") return null;
  const ref = REFERENCE_RATES[e.devise] ?? 1;
  const montant = num(e.montant_devise);
  const eurApplique = num(e.montant_eur);
  const eurReference = montant * ref;
  const couvert = !!reservations.find(
    (r) => r.echeance_id === e.id && r.statut !== "annulee",
  );
  return {
    id: e.id,
    source: "echeance",
    devise: e.devise,
    montantDevise: montant,
    tauxApplique: num(e.taux_change),
    tauxReference: ref,
    eurApplique,
    eurReference,
    // Côté décaissement fournisseur : un EUR appliqué inférieur = gain
    ecart: eurReference - eurApplique,
    couvert,
  };
}

export function pnlForPaiement(p: Paiement): FxPnlEntry | null {
  if (p.devise === "EUR") return null;
  const ref = REFERENCE_RATES[p.devise] ?? 1;
  const montant = num(p.montant_devise ?? p.montant);
  const eurApplique = paiementEUR(p);
  const eurReference = montant * ref;
  return {
    id: p.id,
    source: "paiement",
    devise: p.devise,
    montantDevise: montant,
    tauxApplique: num(p.taux_change),
    tauxReference: ref,
    eurApplique,
    eurReference,
    ecart:
      p.type === "paiement_fournisseur"
        ? eurReference - eurApplique
        : eurApplique - eurReference,
    couvert: !!p.coverage_id,
  };
}

export function pnlForFacture(f: Facture): FxPnlEntry | null {
  if (f.devise === "EUR") return null;
  const ref = REFERENCE_RATES[f.devise] ?? 1;
  const montant = num(f.montant_devise ?? f.montant);
  const eurApplique = factureEUR(f);
  const eurReference = montant * ref;
  return {
    id: f.id,
    source: "facture",
    devise: f.devise,
    montantDevise: montant,
    tauxApplique: num(f.taux_change),
    tauxReference: ref,
    eurApplique,
    eurReference,
    ecart: eurReference - eurApplique,
    couvert: !!f.coverage_id,
  };
}

export type FxPnlSummary = {
  expositionDevise: Record<DeviseCode, number>;
  expositionEUR: number;
  gainTotal: number;
  perteTotal: number;
  net: number;
  couvert: number;
  nonCouvert: number;
  entries: FxPnlEntry[];
};

/** Synthèse d'écart FX à partir des échéances + paiements en devise. */
export function computeFxPnl(params: {
  echeances: FactureEcheance[];
  paiements: Paiement[];
  reservations: FxReservation[];
}): FxPnlSummary {
  const entries: FxPnlEntry[] = [];
  for (const e of params.echeances) {
    const x = pnlForEcheance(e, params.reservations);
    if (x) entries.push(x);
  }
  for (const p of params.paiements) {
    const x = pnlForPaiement(p);
    if (x) entries.push(x);
  }

  const expositionDevise = {} as Record<DeviseCode, number>;
  let expositionEUR = 0;
  let gainTotal = 0;
  let perteTotal = 0;
  let couvert = 0;
  let nonCouvert = 0;

  for (const e of entries) {
    expositionDevise[e.devise] = (expositionDevise[e.devise] ?? 0) + e.montantDevise;
    expositionEUR += e.eurReference;
    if (e.ecart >= 0) gainTotal += e.ecart;
    else perteTotal += e.ecart;
    if (e.couvert) couvert += e.eurApplique;
    else nonCouvert += e.eurApplique;
  }

  return {
    expositionDevise,
    expositionEUR,
    gainTotal,
    perteTotal,
    net: gainTotal + perteTotal,
    couvert,
    nonCouvert,
    entries,
  };
}

/** Solde réservé/utilisé pour une couverture. */
export type CoverageUsage = {
  totalDevise: number;
  reserveActif: number;
  utilise: number;
  disponible: number;
  ecart: number; // gain/perte EUR vs taux de marché de référence
};

export function computeCoverageUsage(
  coverage: FxCoverage,
  reservations: FxReservation[],
): CoverageUsage {
  const linked = reservations.filter((r) => r.coverage_id === coverage.id);
  const reserveActif = linked
    .filter((r) => r.statut === "active")
    .reduce((s, r) => s + num(r.montant_devise), 0);
  const utilise = linked
    .filter((r) => r.statut === "utilisee")
    .reduce((s, r) => s + num(r.montant_devise), 0);
  const totalDevise = num(coverage.montant_devise);
  const disponible = Math.max(0, totalDevise - reserveActif - utilise);
  const ref = REFERENCE_RATES[coverage.devise] ?? 1;
  // Écart sur la portion engagée (réservée + utilisée) = (taux_couv - taux_ref) × montant
  const engage = reserveActif + utilise;
  const ecart = (num(coverage.taux_change) - ref) * engage * -1;
  // signe : si taux_couv < taux_ref → on paie moins en EUR → gain positif
  return { totalDevise, reserveActif, utilise, disponible, ecart };
}

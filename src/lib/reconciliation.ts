/**
 * Module de rapprochement automatique entre transactions bancaires
 * et paiements enregistrés.
 *
 * Score 0–100 calculé à partir de 4 axes :
 *  - cohérence du sens (crédit ↔ encaissement, débit ↔ décaissement)
 *  - proximité du montant
 *  - proximité de la date
 *  - présence du nom (client / fournisseur / dossier) dans le libellé bancaire
 */
import type { Paiement, Dossier, Contact } from "@/hooks/use-data";
import { normalizeLibelle } from "@/lib/bank-import";

export type BankTxLite = {
  id: string;
  date: string;
  libelle_normalise: string;
  libelle_original: string;
  montant: number;
  sens: "credit" | "debit";
  compte_id: string;
  statut: "nouveau" | "rapproche" | "ignore";
};

export type ScoreReason = {
  label: string;
  weight: number;
};

export type ReconciliationScore = {
  score: number; // 0–100
  reasons: ScoreReason[];
  // Indique si le couple est éligible (sens cohérent obligatoire)
  eligible: boolean;
};

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((da - db) / 86_400_000));
}

/**
 * Calcule le score de rapprochement entre une transaction bancaire
 * et un paiement.
 *
 * Sens cohérent obligatoire :
 *  - crédit bancaire ↔ paiement_client
 *  - débit  bancaire ↔ paiement_fournisseur
 *
 * Sinon le couple est marqué `eligible = false` et le score est nul.
 */
export function computeReconciliationScore(
  bankTx: BankTxLite,
  paiement: Paiement,
  dossier?: Dossier | null,
  contact?: Contact | null,
): ReconciliationScore {
  const reasons: ScoreReason[] = [];

  // 1. Cohérence du sens — bloquant
  const sensCoherent =
    (bankTx.sens === "credit" && paiement.type === "paiement_client") ||
    (bankTx.sens === "debit" && paiement.type === "paiement_fournisseur");

  if (!sensCoherent) {
    return { score: 0, reasons: [{ label: "Sens incohérent", weight: 0 }], eligible: false };
  }
  reasons.push({ label: "Type cohérent", weight: 15 });

  // 2. Compte cohérent (bonus si le paiement est rattaché au même compte)
  let compteBonus = 0;
  if (paiement.compte_id && paiement.compte_id === bankTx.compte_id) {
    compteBonus = 10;
    reasons.push({ label: "Même compte", weight: 10 });
  }

  // 3. Montant
  const mBank = num(bankTx.montant);
  const mPay = num(paiement.montant);
  let montantScore = 0;
  if (mBank > 0 && mPay > 0) {
    const diff = Math.abs(mBank - mPay);
    const ratio = diff / Math.max(mBank, mPay);
    if (diff < 0.01) {
      montantScore = 40;
      reasons.push({ label: "Montant identique", weight: 40 });
    } else if (ratio <= 0.02) {
      montantScore = 28;
      reasons.push({ label: "Montant très proche", weight: 28 });
    } else if (ratio <= 0.1) {
      montantScore = 14;
      reasons.push({ label: "Montant proche", weight: 14 });
    } else {
      reasons.push({ label: `Écart de montant (${ratio.toFixed(0)}%)`, weight: 0 });
    }
  }

  // 4. Date
  const ecartJ = daysBetween(bankTx.date, paiement.date);
  let dateScore = 0;
  if (ecartJ === 0) {
    dateScore = 20;
    reasons.push({ label: "Même date", weight: 20 });
  } else if (ecartJ <= 3) {
    dateScore = 14;
    reasons.push({ label: `Écart ${ecartJ}j`, weight: 14 });
  } else if (ecartJ <= 7) {
    dateScore = 6;
    reasons.push({ label: `Écart ${ecartJ}j`, weight: 6 });
  } else {
    reasons.push({ label: `Écart ${ecartJ}j (faible)`, weight: 0 });
  }

  // 5. Libellé : détection nom contact / titre dossier
  const libN = bankTx.libelle_normalise || normalizeLibelle(bankTx.libelle_original);
  let libelleScore = 0;
  const tokens: { source: string; value: string | undefined }[] = [
    { source: "client/fournisseur", value: contact?.nom },
    { source: "dossier", value: dossier?.titre },
  ];
  for (const t of tokens) {
    if (!t.value) continue;
    const n = normalizeLibelle(t.value);
    if (!n) continue;
    // mot significatif (≥ 3 lettres) trouvé
    const parts = n.split(" ").filter((p) => p.length >= 3);
    const hit = parts.some((p) => libN.includes(p));
    if (hit) {
      libelleScore += 15;
      reasons.push({ label: `Nom détecté (${t.source})`, weight: 15 });
      break; // un seul match libellé suffit
    }
  }

  const total = Math.min(100, montantScore + dateScore + libelleScore + compteBonus + 15);
  return { score: total, reasons, eligible: true };
}

export type Suggestion = {
  paiement: Paiement;
  score: number;
  reasons: ScoreReason[];
  contact: Contact | null;
  dossier: Dossier | null;
};

/**
 * Renvoie les meilleures suggestions de paiements pour une transaction.
 * Filtre :
 *  - score >= 60
 *  - paiement non encore rapproché
 */
export function suggestPaiementsForTransaction(
  bankTx: BankTxLite,
  paiements: Paiement[],
  dossiers: Dossier[],
  contacts: Contact[],
  options: { minScore?: number; limit?: number } = {},
): Suggestion[] {
  const minScore = options.minScore ?? 60;
  const limit = options.limit ?? 5;

  const dossierMap = new Map(dossiers.map((d) => [d.id, d]));
  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  const out: Suggestion[] = [];
  for (const p of paiements) {
    if (p.statut_rapprochement === "rapproche") continue;
    const dossier = p.dossier_id ? dossierMap.get(p.dossier_id) ?? null : null;
    const contact = p.personne_id ? contactMap.get(p.personne_id) ?? null : null;
    const r = computeReconciliationScore(bankTx, p, dossier, contact);
    if (!r.eligible) continue;
    if (r.score < minScore) continue;
    out.push({ paiement: p, score: r.score, reasons: r.reasons, contact, dossier });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

export function scoreTone(score: number): "high" | "medium" | "low" {
  if (score >= 85) return "high";
  if (score >= 60) return "medium";
  return "low";
}

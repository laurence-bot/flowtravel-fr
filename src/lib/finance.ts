/**
 * Logique métier financière — toutes les valeurs en euros.
 * Centralise les calculs pour éviter toute incohérence entre écrans.
 */
import type { Dossier, Paiement, Facture } from "@/hooks/use-data";

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export type DossierFinance = {
  prixVente: number;
  coutTotal: number;
  marge: number;
  margePct: number;
  encaisseClient: number;
  payeFournisseur: number;
  resteAEncaisser: number;
  soldeTresorerie: number;
};

export function computeDossierFinance(
  dossier: Dossier,
  paiements: Paiement[],
): DossierFinance {
  const prixVente = num(dossier.prix_vente);
  const coutTotal = num(dossier.cout_total);
  const marge = prixVente - coutTotal;
  const margePct = prixVente > 0 ? (marge / prixVente) * 100 : 0;

  const encaisseClient = paiements
    .filter((p) => p.dossier_id === dossier.id && p.type === "paiement_client")
    .reduce((s, p) => s + num(p.montant), 0);
  const payeFournisseur = paiements
    .filter((p) => p.dossier_id === dossier.id && p.type === "paiement_fournisseur")
    .reduce((s, p) => s + num(p.montant), 0);

  return {
    prixVente,
    coutTotal,
    marge,
    margePct,
    encaisseClient,
    payeFournisseur,
    resteAEncaisser: Math.max(0, prixVente - encaisseClient),
    soldeTresorerie: encaisseClient - payeFournisseur,
  };
}

export type GlobalFinance = {
  ca: number;
  couts: number;
  marge: number;
  margePct: number;
  encaisse: number;
  decaisse: number;
  tresorerie: number;
  facturesNonPayees: number;
  resteAPayerFournisseurs: number;
};

export function computeGlobalFinance(
  dossiers: Dossier[],
  paiements: Paiement[],
  factures: Facture[],
): GlobalFinance {
  const ca = dossiers.reduce((s, d) => s + num(d.prix_vente), 0);
  const couts = dossiers.reduce((s, d) => s + num(d.cout_total), 0);
  const marge = ca - couts;
  const margePct = ca > 0 ? (marge / ca) * 100 : 0;

  const encaisse = paiements
    .filter((p) => p.type === "paiement_client")
    .reduce((s, p) => s + num(p.montant), 0);
  const decaisse = paiements
    .filter((p) => p.type === "paiement_fournisseur")
    .reduce((s, p) => s + num(p.montant), 0);

  const facturesNonPayees = factures.filter((f) => !f.paye);
  const resteAPayerFournisseurs = facturesNonPayees.reduce(
    (s, f) => s + num(f.montant),
    0,
  );

  return {
    ca,
    couts,
    marge,
    margePct,
    encaisse,
    decaisse,
    tresorerie: encaisse - decaisse,
    facturesNonPayees: facturesNonPayees.length,
    resteAPayerFournisseurs,
  };
}

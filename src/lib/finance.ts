/**
 * Logique métier financière — toutes les valeurs en euros.
 * Centralise les calculs pour éviter toute incohérence entre écrans.
 */
import type {
  Dossier,
  Paiement,
  Facture,
  Compte,
  Transfert,
} from "@/hooks/use-data";

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Montant en EUR d'un paiement : utilise montant_eur s'il est défini, sinon retombe sur montant. */
export const paiementEUR = (p: { montant: number; montant_eur?: number | null }) =>
  num(p.montant_eur ?? p.montant);

/** Montant en EUR d'une facture : utilise montant_eur s'il est défini, sinon retombe sur montant. */
export const factureEUR = (f: { montant: number; montant_eur?: number | null }) =>
  num(f.montant_eur ?? f.montant);

export type DossierFinance = {
  prixVente: number;
  coutTotal: number;
  marge: number;
  margePct: number;
  margeBrute: number;
  tauxTva: number;
  tvaSurMarge: number;
  margeNette: number;
  margeNettePct: number;
  encaisseClient: number;
  payeFournisseur: number;
  resteAEncaisser: number;
  resteAPayerFournisseur: number;
  soldeTresorerie: number;
};

/**
 * TVA sur marge (régime spécifique des agences de voyages, art. 266-1-e CGI).
 * Formule : TVA = (marge brute × taux) / (1 + taux). Nulle si marge brute ≤ 0.
 */
export type TvaMarge = {
  margeBrute: number;
  tauxTva: number;
  tvaSurMarge: number;
  margeNette: number;
};

export function computeTvaMarge(
  dossier: Pick<Dossier, "prix_vente" | "cout_total" | "taux_tva_marge">,
): TvaMarge {
  const prix = num(dossier.prix_vente);
  const cout = num(dossier.cout_total);
  const tauxRaw = num(dossier.taux_tva_marge);
  const tauxTva = tauxRaw > 0 && tauxRaw < 100 ? tauxRaw : 20;
  const margeBrute = prix - cout;
  if (margeBrute <= 0) {
    return { margeBrute, tauxTva, tvaSurMarge: 0, margeNette: margeBrute };
  }
  const t = tauxTva / 100;
  const tvaSurMarge = (margeBrute * t) / (1 + t);
  return {
    margeBrute,
    tauxTva,
    tvaSurMarge,
    margeNette: margeBrute - tvaSurMarge,
  };
}

export function computeDossierFinance(
  dossier: Dossier,
  paiements: Paiement[],
  factures: Facture[] = [],
): DossierFinance {
  const prixVente = num(dossier.prix_vente);
  const coutTotal = num(dossier.cout_total);
  const marge = prixVente - coutTotal;
  const margePct = prixVente > 0 ? (marge / prixVente) * 100 : 0;
  const tva = computeTvaMarge(dossier);
  const margeNettePct = prixVente > 0 ? (tva.margeNette / prixVente) * 100 : 0;

  const encaisseClient = paiements
    .filter((p) => p.dossier_id === dossier.id && p.type === "paiement_client")
    .reduce((s, p) => s + paiementEUR(p), 0);
  const payeFournisseur = paiements
    .filter((p) => p.dossier_id === dossier.id && p.type === "paiement_fournisseur")
    .reduce((s, p) => s + paiementEUR(p), 0);

  const facturesDossier = factures.filter((f) => f.dossier_id === dossier.id);
  const totalFactures = facturesDossier.reduce((s, f) => s + factureEUR(f), 0);
  const resteAPayerFournisseur = Math.max(0, totalFactures - payeFournisseur);

  return {
    prixVente,
    coutTotal,
    marge,
    margePct,
    margeBrute: tva.margeBrute,
    tauxTva: tva.tauxTva,
    tvaSurMarge: tva.tvaSurMarge,
    margeNette: tva.margeNette,
    margeNettePct,
    encaisseClient,
    payeFournisseur,
    resteAEncaisser: Math.max(0, prixVente - encaisseClient),
    resteAPayerFournisseur,
    soldeTresorerie: encaisseClient - payeFournisseur,
  };
}

export type GlobalFinance = {
  ca: number;
  couts: number;
  marge: number;
  margePct: number;
  tvaSurMarge: number;
  margeNette: number;
  margeNettePct: number;
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
  const tvaSurMarge = dossiers.reduce((s, d) => s + computeTvaMarge(d).tvaSurMarge, 0);
  const margeNette = marge - tvaSurMarge;
  const margeNettePct = ca > 0 ? (margeNette / ca) * 100 : 0;

  const encaisse = paiements
    .filter((p) => p.type === "paiement_client")
    .reduce((s, p) => s + paiementEUR(p), 0);
  const decaisse = paiements
    .filter((p) => p.type === "paiement_fournisseur")
    .reduce((s, p) => s + paiementEUR(p), 0);

  const facturesNonPayees = factures.filter((f) => !f.paye);
  const resteAPayerFournisseurs = facturesNonPayees.reduce(
    (s, f) => s + factureEUR(f),
    0,
  );

  return {
    ca,
    couts,
    marge,
    margePct,
    tvaSurMarge,
    margeNette,
    margeNettePct,
    encaisse,
    decaisse,
    // Trésorerie nette = encaissements − décaissements (les transferts internes sont neutres par construction)
    tresorerie: encaisse - decaisse,
    facturesNonPayees: facturesNonPayees.length,
    resteAPayerFournisseurs,
  };
}

/**
 * Solde par compte — intègre :
 *  - solde initial
 *  - encaissements clients (entrants)
 *  - décaissements fournisseurs (sortants)
 *  - transferts internes (sortants pour la source, entrants pour la destination → impact net zéro sur la trésorerie globale)
 */
export type CompteSolde = {
  compte: Compte;
  entrees: number;
  sorties: number;
  transfertsEntrants: number;
  transfertsSortants: number;
  solde: number;
};

export function computeComptesSoldes(
  comptes: Compte[],
  paiements: Paiement[],
  transferts: Transfert[],
): CompteSolde[] {
  return comptes.map((compte) => {
    const entrees = paiements
      .filter((p) => p.compte_id === compte.id && p.type === "paiement_client")
      .reduce((s, p) => s + paiementEUR(p), 0);
    const sorties = paiements
      .filter((p) => p.compte_id === compte.id && p.type === "paiement_fournisseur")
      .reduce((s, p) => s + paiementEUR(p), 0);
    const transfertsEntrants = transferts
      .filter((t) => t.compte_destination_id === compte.id)
      .reduce((s, t) => s + num(t.montant), 0);
    const transfertsSortants = transferts
      .filter((t) => t.compte_source_id === compte.id)
      .reduce((s, t) => s + num(t.montant), 0);

    return {
      compte,
      entrees,
      sorties,
      transfertsEntrants,
      transfertsSortants,
      solde:
        num(compte.solde_initial) +
        entrees -
        sorties +
        transfertsEntrants -
        transfertsSortants,
    };
  });
}

export type TresorerieGlobale = {
  soldeTotal: number;
  totalEntrees: number;
  totalSorties: number;
  nbComptes: number;
};

export function computeTresorerieGlobale(soldes: CompteSolde[]): TresorerieGlobale {
  return {
    soldeTotal: soldes.reduce((s, c) => s + c.solde, 0),
    totalEntrees: soldes.reduce((s, c) => s + c.entrees, 0),
    totalSorties: soldes.reduce((s, c) => s + c.sorties, 0),
    nbComptes: soldes.length,
  };
}

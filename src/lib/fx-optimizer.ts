// Moteur d'optimisation des couvertures FX pour une cotation.
// Objectifs (par ordre) :
//  1) consommer en priorité les couvertures dont la deadline est la plus proche
//     (sinon elles expirent inutilisées)
//  2) à deadline équivalente, prendre le meilleur taux pour le client
//     (montant EUR le plus bas pour une dépense en devise)
//
// Le résultat est un plan : pour chaque ligne en devise étrangère, une
// répartition en 1..N tranches sur des couvertures différentes.

import type { CotationLigne } from "@/lib/cotations";
import type { FxCoverage, FxReservation, DeviseCode } from "@/lib/fx";
import { availableOnCoverage } from "@/lib/fx-reservations";
import { ligneCoutEur } from "@/lib/cotations";

export type AllocationSlice = {
  coverageId: string;
  coverageRef: string | null;
  montantDevise: number;
  taux: number;
  montantEur: number;
  deadline: string;
};

export type LineAllocation = {
  ligneId: string;
  devise: DeviseCode;
  montantBesoinDevise: number;
  spotTaux: number;
  spotMontantEur: number;
  slices: AllocationSlice[];
  uncovered: number; // montant devise non couvert (tombe au taux du jour)
  optimizedMontantEur: number;
  gainEur: number; // spotMontantEur - optimizedMontantEur (positif = gain)
};

export type FxPlan = {
  byLine: LineAllocation[];
  totalSpotEur: number;
  totalOptimizedEur: number;
  totalGainEur: number;
  byDevise: Record<string, { besoin: number; couvert: number; restant: number }>;
};

/** Besoin total en devise pour une ligne (qty × montant × pax si /pax). */
function ligneBesoinDevise(ligne: CotationLigne, nombrePax: number): number {
  const base = Number(ligne.montant_devise || 0);
  const qte = Number(ligne.quantite || 1);
  if (ligne.mode_tarifaire === "par_personne") {
    return base * qte * Math.max(1, nombrePax);
  }
  return base * qte;
}

/**
 * Calcule un plan optimal d'allocation des couvertures FX.
 *
 * @param lignes Lignes de la cotation à couvrir.
 * @param coverages Toutes les couvertures de l'utilisateur.
 * @param reservations Réservations existantes (pour calculer le solde dispo).
 * @param nombrePax Nb de pax (impacte les lignes /pax).
 */
export function buildFxPlan(
  lignes: CotationLigne[],
  coverages: FxCoverage[],
  reservations: FxReservation[],
  nombrePax: number,
): FxPlan {
  // Solde disponible vivant pour chaque couverture
  const remaining = new Map<string, number>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const usableCoverages = coverages.filter((c) => {
    if (c.statut === "expiree" || c.statut === "anomalie" || c.statut === "utilisee") return false;
    const dl = new Date(c.date_echeance);
    return dl >= today;
  });

  for (const c of usableCoverages) {
    remaining.set(c.id, availableOnCoverage(c, reservations));
  }

  const byLine: LineAllocation[] = [];
  const byDevise: Record<string, { besoin: number; couvert: number; restant: number }> = {};

  for (const l of lignes) {
    if (l.devise === "EUR") continue;
    const besoin = ligneBesoinDevise(l, nombrePax);
    if (besoin <= 0) continue;

    const spotTaux = Number(l.taux_change_vers_eur || 0);
    const spotMontantEur = besoin * spotTaux;

    // Couvertures candidates pour cette devise, dispo > 0
    // Tri : deadline asc (urgence) puis taux asc (meilleur prix client)
    const candidates = usableCoverages
      .filter((c) => c.devise === l.devise && (remaining.get(c.id) ?? 0) > 0.01)
      .sort((a, b) => {
        const da = new Date(a.date_echeance).getTime();
        const db = new Date(b.date_echeance).getTime();
        if (da !== db) return da - db;
        return Number(a.taux_change) - Number(b.taux_change);
      });

    let restantBesoin = besoin;
    const slices: AllocationSlice[] = [];

    for (const cov of candidates) {
      if (restantBesoin <= 0.01) break;
      const dispo = remaining.get(cov.id) ?? 0;
      const prendre = Math.min(dispo, restantBesoin);
      if (prendre <= 0) continue;
      const taux = Number(cov.taux_change);
      slices.push({
        coverageId: cov.id,
        coverageRef: cov.reference,
        montantDevise: prendre,
        taux,
        montantEur: prendre * taux,
        deadline: cov.date_echeance,
      });
      remaining.set(cov.id, dispo - prendre);
      restantBesoin -= prendre;
    }

    const uncovered = Math.max(0, restantBesoin);
    const optimizedMontantEur =
      slices.reduce((s, x) => s + x.montantEur, 0) + uncovered * spotTaux;

    byLine.push({
      ligneId: l.id,
      devise: l.devise,
      montantBesoinDevise: besoin,
      spotTaux,
      spotMontantEur,
      slices,
      uncovered,
      optimizedMontantEur,
      gainEur: spotMontantEur - optimizedMontantEur,
    });

    const key = l.devise;
    byDevise[key] = byDevise[key] ?? { besoin: 0, couvert: 0, restant: 0 };
    byDevise[key].besoin += besoin;
    byDevise[key].couvert += besoin - uncovered;
    byDevise[key].restant += uncovered;
  }

  const totalSpotEur = byLine.reduce((s, x) => s + x.spotMontantEur, 0);
  const totalOptimizedEur = byLine.reduce((s, x) => s + x.optimizedMontantEur, 0);

  return {
    byLine,
    totalSpotEur,
    totalOptimizedEur,
    totalGainEur: totalSpotEur - totalOptimizedEur,
    byDevise,
  };
}

/** Coût EUR optimisé d'une ligne (utile pour ré-écrire montant_eur). */
export function lineOptimizedEur(plan: FxPlan, ligne: CotationLigne, nombrePax: number): number {
  const alloc = plan.byLine.find((b) => b.ligneId === ligne.id);
  if (!alloc) return ligneCoutEur(ligne, nombrePax);
  return alloc.optimizedMontantEur;
}

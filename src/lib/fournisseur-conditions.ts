// Module : conditions commerciales fournisseur (1 ou plusieurs par fournisseur)

import type { DeviseCode } from "@/lib/fx";

export type CancelationTier = {
  jours_avant: number;
  pct_penalite: number;
};

export type FournisseurCondition = {
  id: string;
  user_id: string;
  fournisseur_id: string;
  nom: string;
  est_principale: boolean;
  devises_acceptees: DeviseCode[];
  pct_acompte_1: number;
  pct_acompte_2: number;
  pct_acompte_3: number;
  pct_solde: number;
  delai_acompte_1_jours: number | null;
  delai_acompte_2_jours: number | null;
  delai_acompte_3_jours: number | null;
  delai_solde_jours: number | null;
  acompte_1_a_reservation: boolean;
  acompte_2_a_reservation: boolean;
  acompte_3_a_reservation: boolean;
  solde_a_reservation: boolean;
  conditions_annulation: CancelationTier[];
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const DEFAULT_CONDITION_VALUES = {
  nom: "Standard",
  est_principale: true,
  devises_acceptees: ["EUR"] as DeviseCode[],
  pct_acompte_1: 30,
  pct_acompte_2: 0,
  pct_acompte_3: 0,
  pct_solde: 70,
  delai_acompte_1_jours: null as number | null,
  delai_acompte_2_jours: null as number | null,
  delai_acompte_3_jours: null as number | null,
  delai_solde_jours: 30 as number | null,
  acompte_1_a_reservation: true,
  acompte_2_a_reservation: false,
  acompte_3_a_reservation: false,
  solde_a_reservation: false,
  conditions_annulation: [] as CancelationTier[],
  notes: null as string | null,
};

/** Calcule la date d'échéance d'un acompte/solde.
 *  - Si `aReservation` est vrai → renvoie `dateReservation`.
 *  - Sinon → `datePrestation - delaiJours`.
 */
export function dateEcheance(
  aReservation: boolean,
  dateReservation: string | null,
  datePrestation: string | null,
  delaiJours: number | null,
): string | null {
  if (aReservation) return dateReservation;
  return dateFromDelai(datePrestation, delaiJours);
}

/** Calcule la date d'échéance (YYYY-MM-DD) à partir de la date prestation et d'un délai en jours avant. */
export function dateFromDelai(datePrestation: string | null, delaiJours: number | null): string | null {
  if (!datePrestation || delaiJours == null) return null;
  const d = new Date(datePrestation);
  if (!Number.isFinite(d.getTime())) return null;
  d.setDate(d.getDate() - delaiJours);
  return d.toISOString().slice(0, 10);
}

/** Renvoie la pénalité applicable à une date donnée (en jours avant prestation). */
export function penaliteAt(
  conditions: CancelationTier[],
  joursAvantPrestation: number,
): number {
  if (!conditions.length) return 0;
  const sorted = [...conditions].sort((a, b) => b.jours_avant - a.jours_avant);
  let pct = 0;
  for (const tier of sorted) {
    if (joursAvantPrestation <= tier.jours_avant) pct = tier.pct_penalite;
  }
  return pct;
}

export function getMainCondition(
  conditions: FournisseurCondition[],
  fournisseurId: string,
): FournisseurCondition | undefined {
  const list = conditions.filter((c) => c.fournisseur_id === fournisseurId);
  return list.find((c) => c.est_principale) ?? list[0];
}

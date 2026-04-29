// Module : conditions commerciales fournisseur (multi-profils par type prestation)

import type { DeviseCode } from "@/lib/fx";

export type CancelationTier = {
  jours_avant: number;
  pct_penalite: number;
};

export type FournisseurCondition = {
  id: string;
  user_id: string;
  fournisseur_id: string;
  nom_profil: string;
  est_defaut: boolean;
  devises_acceptees: DeviseCode[];
  pct_acompte_1: number;
  pct_acompte_2: number;
  pct_acompte_3: number;
  pct_solde: number;
  delai_acompte_1_jours: number | null;
  delai_acompte_2_jours: number | null;
  delai_acompte_3_jours: number | null;
  delai_solde_jours: number | null;
  conditions_annulation: CancelationTier[];
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ConditionInput = Omit<FournisseurCondition, "id" | "user_id" | "created_at" | "updated_at">;

export const DEFAULT_CONDITION: Omit<ConditionInput, "fournisseur_id"> = {
  nom_profil: "Standard",
  est_defaut: true,
  devises_acceptees: ["EUR"],
  pct_acompte_1: 30,
  pct_acompte_2: 0,
  pct_acompte_3: 0,
  pct_solde: 70,
  delai_acompte_1_jours: 0,
  delai_acompte_2_jours: null,
  delai_acompte_3_jours: null,
  delai_solde_jours: 30,
  conditions_annulation: [
    { jours_avant: 60, pct_penalite: 10 },
    { jours_avant: 30, pct_penalite: 50 },
    { jours_avant: 0, pct_penalite: 100 },
  ],
  notes: null,
};

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
  // Trier décroissant par jours_avant : on prend la 1re tranche dont jours_avant ≤ joursAvantPrestation
  const sorted = [...conditions].sort((a, b) => b.jours_avant - a.jours_avant);
  let pct = 0;
  for (const tier of sorted) {
    if (joursAvantPrestation <= tier.jours_avant) pct = tier.pct_penalite;
  }
  return pct;
}

export function getDefaultProfile(
  conditions: FournisseurCondition[],
  fournisseurId: string,
): FournisseurCondition | undefined {
  const list = conditions.filter((c) => c.fournisseur_id === fournisseurId);
  return list.find((c) => c.est_defaut) ?? list[0];
}

// Module : conditions commerciales fournisseur (stockées directement sur contacts)

import type { DeviseCode } from "@/lib/fx";

export type CancelationTier = {
  jours_avant: number;
  pct_penalite: number;
};

/** Conditions commerciales d'un fournisseur (sous-ensemble de la fiche contact). */
export type FournisseurConditions = {
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
  conditions_notes: string | null;
};

export const DEFAULT_CONDITIONS: FournisseurConditions = {
  devises_acceptees: ["EUR"],
  pct_acompte_1: 30,
  pct_acompte_2: 0,
  pct_acompte_3: 0,
  pct_solde: 70,
  delai_acompte_1_jours: 0,
  delai_acompte_2_jours: null,
  delai_acompte_3_jours: null,
  delai_solde_jours: 30,
  conditions_annulation: [],
  conditions_notes: null,
};

/** Extrait les conditions commerciales depuis une fiche contact (avec valeurs par défaut). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getConditionsFromContact(contact: any): FournisseurConditions {
  if (!contact) return DEFAULT_CONDITIONS;
  return {
    devises_acceptees: (contact.devises_acceptees ?? ["EUR"]) as DeviseCode[],
    pct_acompte_1: Number(contact.pct_acompte_1 ?? 30),
    pct_acompte_2: Number(contact.pct_acompte_2 ?? 0),
    pct_acompte_3: Number(contact.pct_acompte_3 ?? 0),
    pct_solde: Number(contact.pct_solde ?? 70),
    delai_acompte_1_jours: contact.delai_acompte_1_jours ?? null,
    delai_acompte_2_jours: contact.delai_acompte_2_jours ?? null,
    delai_acompte_3_jours: contact.delai_acompte_3_jours ?? null,
    delai_solde_jours: contact.delai_solde_jours ?? null,
    conditions_annulation: (contact.conditions_annulation ?? []) as CancelationTier[],
    conditions_notes: contact.conditions_notes ?? null,
  };
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

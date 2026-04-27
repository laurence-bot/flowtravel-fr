export type DeviseCode =
  | "EUR" | "USD" | "GBP" | "ZAR" | "CHF" | "CAD" | "AUD" | "JPY" | "AED" | "MAD" | "TND";

export const DEVISES: { code: DeviseCode; label: string; symbol: string }[] = [
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "USD", label: "Dollar US", symbol: "$" },
  { code: "GBP", label: "Livre sterling", symbol: "£" },
  { code: "ZAR", label: "Rand sud-africain", symbol: "R" },
  { code: "CHF", label: "Franc suisse", symbol: "CHF" },
  { code: "CAD", label: "Dollar canadien", symbol: "CA$" },
  { code: "AUD", label: "Dollar australien", symbol: "AU$" },
  { code: "JPY", label: "Yen", symbol: "¥" },
  { code: "AED", label: "Dirham EAU", symbol: "د.إ" },
  { code: "MAD", label: "Dirham marocain", symbol: "DH" },
  { code: "TND", label: "Dinar tunisien", symbol: "DT" },
];

export const DEVISE_LABELS: Record<DeviseCode, string> = Object.fromEntries(
  DEVISES.map((d) => [d.code, d.label]),
) as Record<DeviseCode, string>;

export type FxSource = "taux_du_jour" | "couverture" | "manuel";

export const FX_SOURCE_LABELS: Record<FxSource, string> = {
  taux_du_jour: "Taux du jour",
  couverture: "Couverture FX",
  manuel: "Saisie manuelle",
};

export type FxCoverageStatut = "ouverte" | "reservee" | "utilisee" | "expiree" | "anomalie";

export const FX_STATUT_LABELS: Record<FxCoverageStatut, string> = {
  ouverte: "Ouverte",
  reservee: "Réservée",
  utilisee: "Utilisée",
  expiree: "Expirée",
  anomalie: "Anomalie",
};

export const FX_STATUT_COLORS: Record<FxCoverageStatut, string> = {
  ouverte: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  reservee: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  utilisee: "bg-muted text-muted-foreground border-border",
  expiree: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  anomalie: "bg-destructive/15 text-destructive border-destructive/30",
};

/** montant_eur = montant_devise × taux. Si EUR, taux forcé à 1. */
export function toEUR(montant: number, devise: DeviseCode, taux: number): number {
  if (devise === "EUR") return montant;
  return montant * taux;
}

export function formatMoney(value: number | null | undefined, devise: DeviseCode = "EUR"): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: devise,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    const sym = DEVISES.find((d) => d.code === devise)?.symbol ?? devise;
    return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${sym}`;
  }
}

export type FxCoverage = {
  id: string;
  user_id: string;
  reference: string | null;
  devise: DeviseCode;
  montant_devise: number;
  taux_change: number;
  date_ouverture: string;
  date_echeance: string;
  statut: FxCoverageStatut;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type FxReservation = {
  id: string;
  coverage_id: string;
  facture_fournisseur_id: string | null;
  echeance_id: string | null;
  paiement_id: string | null;
  montant_devise: number;
  taux_change: number;
  statut: "active" | "utilisee" | "annulee";
  created_at: string;
};

/** Solde disponible d'une couverture après réservations actives. */
export function coverageBalance(coverage: FxCoverage, reservations: FxReservation[]): {
  reserve: number;
  disponible: number;
} {
  const reserve = reservations
    .filter((r) => r.coverage_id === coverage.id && r.statut !== "annulee")
    .reduce((s, r) => s + Number(r.montant_devise), 0);
  return { reserve, disponible: Math.max(0, coverage.montant_devise - reserve) };
}

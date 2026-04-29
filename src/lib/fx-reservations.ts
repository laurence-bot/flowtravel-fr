import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { isReservationVivante, isReservationEngagee, isReservationReservee, type FxCoverage, type FxReservation } from "@/lib/fx";

/** Crée une réservation sur une couverture pour une échéance ou facture. */
export async function createReservation(params: {
  userId: string;
  coverageId: string;
  montantDevise: number;
  tauxChange: number;
  echeanceId?: string | null;
  factureFournisseurId?: string | null;
  paiementId?: string | null;
  cotationId?: string | null;
  ligneFournisseurId?: string | null;
  /** "reservee" (devis, libérable) ou "engagee" (dossier confirmé). Défaut : reservee. */
  statut?: "reservee" | "engagee";
}): Promise<{ data: FxReservation | null; error: string | null }> {
  const { data, error } = await supabase
    .from("fx_coverage_reservations")
    .insert({
      user_id: params.userId,
      coverage_id: params.coverageId,
      montant_devise: params.montantDevise,
      taux_change: params.tauxChange,
      echeance_id: params.echeanceId ?? null,
      facture_fournisseur_id: params.factureFournisseurId ?? null,
      paiement_id: params.paiementId ?? null,
      cotation_id: params.cotationId ?? null,
      ligne_fournisseur_id: params.ligneFournisseurId ?? null,
      statut: params.statut ?? "reservee",
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };

  await logAudit({
    userId: params.userId,
    entity: "fx_reservation",
    entityId: data.id,
    action: "create",
    description: `Réservation FX ${params.montantDevise} @ ${params.tauxChange} (${params.statut ?? "reservee"})`,
    newValue: data,
  });

  // Mettre la couverture à "réservée" si pas déjà utilisée
  await supabase
    .from("fx_coverages")
    .update({ statut: "reservee" })
    .eq("id", params.coverageId)
    .eq("statut", "ouverte");

  return { data: data as unknown as FxReservation, error: null };
}

/** Annule (libère) une réservation existante. */
export async function cancelReservation(params: {
  userId: string;
  reservationId: string;
}): Promise<{ error: string | null }> {
  const { data: oldRes } = await supabase
    .from("fx_coverage_reservations")
    .select("*")
    .eq("id", params.reservationId)
    .single();

  const { error } = await supabase
    .from("fx_coverage_reservations")
    .update({ statut: "liberee" })
    .eq("id", params.reservationId);

  if (error) return { error: error.message };

  await logAudit({
    userId: params.userId,
    entity: "fx_reservation",
    entityId: params.reservationId,
    action: "update",
    description: "Réservation libérée",
    oldValue: oldRes,
  });

  return { error: null };
}

/** Engage définitivement toutes les réservations liées à une cotation (dossier confirmé). */
export async function engageReservationsForCotation(params: {
  userId: string;
  cotationId: string;
}): Promise<{ count: number; error: string | null }> {
  const { data, error } = await supabase
    .from("fx_coverage_reservations")
    .update({ statut: "engagee" })
    .eq("cotation_id", params.cotationId)
    .in("statut", ["active", "reservee"])
    .select("id");

  if (error) return { count: 0, error: error.message };

  await logAudit({
    userId: params.userId,
    entity: "fx_reservation",
    entityId: params.cotationId,
    action: "update",
    description: `${data?.length ?? 0} réservation(s) FX engagée(s) (dossier confirmé)`,
  });

  return { count: data?.length ?? 0, error: null };
}

/** Libère toutes les réservations liées à une cotation perdue/expirée. */
export async function releaseReservationsForCotation(params: {
  userId: string;
  cotationId: string;
}): Promise<{ count: number; error: string | null }> {
  const { data, error } = await supabase
    .from("fx_coverage_reservations")
    .update({ statut: "liberee" })
    .eq("cotation_id", params.cotationId)
    .in("statut", ["active", "reservee"])
    .select("id");

  if (error) return { count: 0, error: error.message };

  await logAudit({
    userId: params.userId,
    entity: "fx_reservation",
    entityId: params.cotationId,
    action: "update",
    description: `${data?.length ?? 0} réservation(s) FX libérée(s) (devis perdu/expiré)`,
  });

  return { count: data?.length ?? 0, error: null };
}

/** Solde disponible pour une couverture donnée (réservé + engagé bloquent). */
export function availableOnCoverage(
  coverage: FxCoverage,
  reservations: FxReservation[],
): number {
  const used = reservations
    .filter((r) => r.coverage_id === coverage.id && isReservationVivante(r.statut))
    .reduce((s, r) => s + Number(r.montant_devise), 0);
  return Math.max(0, Number(coverage.montant_devise) - used);
}

/** Montant uniquement réservé (libérable) sur une couverture. */
export function reservedOnlyOnCoverage(coverage: FxCoverage, reservations: FxReservation[]): number {
  return reservations
    .filter((r) => r.coverage_id === coverage.id && isReservationReservee(r.statut))
    .reduce((s, r) => s + Number(r.montant_devise), 0);
}

/** Montant engagé (définitif) sur une couverture. */
export function engagedOnCoverage(coverage: FxCoverage, reservations: FxReservation[]): number {
  return reservations
    .filter((r) => r.coverage_id === coverage.id && isReservationEngagee(r.statut))
    .reduce((s, r) => s + Number(r.montant_devise), 0);
}


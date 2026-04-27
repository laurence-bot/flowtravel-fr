import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import type { FxCoverage, FxReservation } from "@/lib/fx";

/** Crée une réservation sur une couverture pour une échéance ou facture. */
export async function createReservation(params: {
  userId: string;
  coverageId: string;
  montantDevise: number;
  tauxChange: number;
  echeanceId?: string | null;
  factureFournisseurId?: string | null;
  paiementId?: string | null;
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
      statut: "active",
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };

  await logAudit({
    userId: params.userId,
    entity: "fx_reservation",
    entityId: data.id,
    action: "create",
    description: `Réservation FX ${params.montantDevise} @ ${params.tauxChange}`,
    newValue: data,
  });

  // Mettre la couverture à "réservée" si pas déjà utilisée
  await supabase
    .from("fx_coverages")
    .update({ statut: "reservee" })
    .eq("id", params.coverageId)
    .eq("statut", "ouverte");

  return { data: data as FxReservation, error: null };
}

/** Annule une réservation existante. */
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
    .update({ statut: "annulee" })
    .eq("id", params.reservationId);

  if (error) return { error: error.message };

  await logAudit({
    userId: params.userId,
    entity: "fx_reservation",
    entityId: params.reservationId,
    action: "update",
    description: "Réservation annulée",
    oldValue: oldRes,
  });

  return { error: null };
}

/** Solde disponible pour une couverture donnée. */
export function availableOnCoverage(
  coverage: FxCoverage,
  reservations: FxReservation[],
): number {
  const reserved = reservations
    .filter((r) => r.coverage_id === coverage.id && r.statut !== "annulee")
    .reduce((s, r) => s + Number(r.montant_devise), 0);
  return Math.max(0, Number(coverage.montant_devise) - reserved);
}

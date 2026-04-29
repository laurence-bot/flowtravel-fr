import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTable } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";
import { formatEUR, formatDate } from "@/lib/format";
import { TrendingDown, TrendingUp, Sparkles, ShieldCheck, AlertTriangle } from "lucide-react";
import {
  buildFxPlan,
  type FxPlan,
} from "@/lib/fx-optimizer";
import type { CotationLigne } from "@/lib/cotations";
import type { FxCoverage, FxReservation } from "@/lib/fx";
import { createReservation } from "@/lib/fx-reservations";

type Props = {
  cotationId: string;
  lignes: CotationLigne[];
  nombrePax: number;
  canWrite: boolean;
  onApplied?: () => void;
};

export function FxOptimizerBlock({ cotationId, lignes, nombrePax, canWrite, onApplied }: Props) {
  const { user } = useAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: coverages } = useTable<FxCoverage>("fx_coverages" as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reservations, refetch: refetchReservations } = useTable<FxReservation>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "fx_coverage_reservations" as any,
  );

  const [busy, setBusy] = useState(false);

  const plan: FxPlan = useMemo(
    () => buildFxPlan(lignes, coverages, reservations, nombrePax),
    [lignes, coverages, reservations, nombrePax],
  );

  const hasForeignLines = lignes.some((l) => l.devise !== "EUR");
  if (!hasForeignLines) return null;

  const applyPlan = async (reserveCoverages: boolean) => {
    if (!user) return;
    if (plan.byLine.length === 0) return;
    setBusy(true);

    let ligneCount = 0;
    let reservationCount = 0;

    for (const alloc of plan.byLine) {
      const ligne = lignes.find((l) => l.id === alloc.ligneId);
      if (!ligne) continue;
      // On ne gère pas le split multi-couvertures par ligne (limitation : 1 ligne = 1 couverture).
      // On prend la principale (première slice) si elle couvre ≥ 50 % du besoin, sinon on n'attache rien.
      const main = alloc.slices[0];
      if (!main) continue;
      const ratio = main.montantDevise / alloc.montantBesoinDevise;
      if (ratio < 0.5) continue;

      // Met à jour la ligne : taux figé = taux de la couverture, source = couverture
      const newMontantEur = Number(ligne.montant_devise) * main.taux;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("cotation_lignes_fournisseurs")
        .update({
          couverture_id: main.coverageId,
          taux_change_vers_eur: main.taux,
          montant_eur: newMontantEur,
          source_fx: "couverture",
        })
        .eq("id", ligne.id);
      if (!error) ligneCount++;

      if (reserveCoverages && main.coverageId) {
        const { error: errRes } = await createReservation({
          userId: user.id,
          coverageId: main.coverageId,
          montantDevise: alloc.montantBesoinDevise,
          tauxChange: main.taux,
          cotationId,
          ligneFournisseurId: ligne.id,
          statut: "reservee",
        });
        if (!errRes) reservationCount++;
      }
    }

    await logAudit({
      userId: user.id,
      entity: "cotation",
      entityId: cotationId,
      action: "update",
      description: `Optimisation FX appliquée (${ligneCount} lignes, ${reservationCount} réservations)`,
    });

    setBusy(false);
    toast.success(
      reserveCoverages
        ? `${ligneCount} lignes ré-évaluées, ${reservationCount} réservation(s) créée(s).`
        : `${ligneCount} lignes ré-évaluées au taux des couvertures.`,
    );
    refetchReservations();
    onApplied?.();
  };

  const tone = plan.totalGainEur > 0 ? "good" : plan.totalGainEur < 0 ? "bad" : "neutral";
  const Icon = tone === "good" ? TrendingDown : tone === "bad" ? TrendingUp : Sparkles;

  return (
    <Card className="border-border/60 overflow-hidden">
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            Optimisation des couvertures FX
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Priorité aux couvertures qui expirent bientôt, puis au meilleur taux pour le client.
          </p>
        </div>
        {canWrite && (
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => applyPlan(false)}
              disabled={busy || plan.byLine.length === 0}
            >
              Appliquer les taux
            </Button>
            <Button
              size="sm"
              onClick={() => applyPlan(true)}
              disabled={busy || plan.byLine.length === 0}
            >
              Réserver les devises
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-4 pb-3">
        <div className="rounded border border-border/60 p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Au taux du jour</div>
          <div className="text-lg font-semibold tabular mt-0.5">{formatEUR(plan.totalSpotEur)}</div>
        </div>
        <div className="rounded border border-border/60 p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Avec couvertures</div>
          <div className="text-lg font-semibold tabular mt-0.5">{formatEUR(plan.totalOptimizedEur)}</div>
        </div>
        <div
          className={`rounded border p-3 ${
            tone === "good"
              ? "bg-emerald-500/10 border-emerald-500/30"
              : tone === "bad"
                ? "bg-orange-500/10 border-orange-500/30"
                : "border-border/60"
          }`}
        >
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Icon className="h-3 w-3" /> Gain client
          </div>
          <div className="text-lg font-semibold tabular mt-0.5">
            {plan.totalGainEur >= 0 ? "−" : "+"}
            {formatEUR(Math.abs(plan.totalGainEur))}
          </div>
        </div>
      </div>

      {/* Détail par ligne */}
      <div className="border-t border-border/60">
        {plan.byLine.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">
            <AlertTriangle className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            Aucune couverture disponible pour les devises de cette cotation.
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {plan.byLine.map((alloc) => {
              const ligne = lignes.find((l) => l.id === alloc.ligneId);
              return (
                <li key={alloc.ligneId} className="p-4 text-sm">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{ligne?.nom_fournisseur ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {alloc.montantBesoinDevise.toFixed(2)} {alloc.devise}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Économie</div>
                      <div
                        className={`text-sm font-semibold tabular ${
                          alloc.gainEur > 0 ? "text-emerald-600" : alloc.gainEur < 0 ? "text-orange-600" : ""
                        }`}
                      >
                        {alloc.gainEur >= 0 ? "−" : "+"}
                        {formatEUR(Math.abs(alloc.gainEur))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {alloc.slices.map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-secondary/40 rounded px-2 py-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {s.coverageRef ?? s.coverageId.slice(0, 6)}
                          </Badge>
                          <span className="text-muted-foreground">
                            {s.montantDevise.toFixed(2)} {alloc.devise} @ {s.taux.toFixed(4)}
                          </span>
                          <span className="text-muted-foreground">
                            · expire {formatDate(s.deadline)}
                          </span>
                        </div>
                        <span className="tabular">{formatEUR(s.montantEur)}</span>
                      </div>
                    ))}
                    {alloc.uncovered > 0.01 && (
                      <div className="flex items-center justify-between text-xs text-orange-600 px-2 py-1">
                        <span>
                          <AlertTriangle className="h-3 w-3 inline mr-1" />
                          Non couvert : {alloc.uncovered.toFixed(2)} {alloc.devise} (taux du jour)
                        </span>
                        <span className="tabular">{formatEUR(alloc.uncovered * alloc.spotTaux)}</span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

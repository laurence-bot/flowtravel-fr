import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTable } from "@/hooks/use-data";
import { ShieldCheck, Sparkles } from "lucide-react";
import { formatDate } from "@/lib/format";
import {
  type DeviseCode,
  type FxCoverage,
  type FxReservation,
} from "@/lib/fx";
import { availableOnCoverage } from "@/lib/fx-reservations";

type Props = {
  devise: DeviseCode;
  montantDevise: number;
  /** Couverture déjà sélectionnée (pour la marquer active). */
  selectedCoverageId?: string | null;
  /** Si true, on inclut la portion déjà réservée par cette ligne dans le solde. */
  excludeReservationFromLigneId?: string | null;
  onPick: (args: {
    coverage: FxCoverage;
    taux: number;
  }) => void;
};

/**
 * Encart compact à insérer dans la modale d'édition d'une ligne fournisseur.
 * Liste les couvertures FX disponibles pour la devise et permet d'appliquer
 * leur taux en un clic.
 */
export function InlineFxCoveragePicker({
  devise,
  montantDevise,
  selectedCoverageId,
  excludeReservationFromLigneId,
  onPick,
}: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: coverages } = useTable<FxCoverage>("fx_coverages" as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reservations } = useTable<FxReservation>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "fx_coverage_reservations" as any,
  );

  const matching = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return coverages
      .filter(
        (c) =>
          c.devise === devise &&
          c.statut !== "expiree" &&
          c.statut !== "anomalie" &&
          c.statut !== "utilisee" &&
          new Date(c.date_echeance) >= today,
      )
      .map((c) => {
        const otherReservations = reservations.filter(
          (r) =>
            r.coverage_id === c.id &&
            r.ligne_fournisseur_id !== excludeReservationFromLigneId,
        );
        const dispo = availableOnCoverage(c, otherReservations);
        return { coverage: c, dispo };
      })
      .sort((a, b) => {
        // Priorité 1 : la couverture déjà sélectionnée en haut
        if (a.coverage.id === selectedCoverageId) return -1;
        if (b.coverage.id === selectedCoverageId) return 1;
        // Priorité 2 : deadline la plus proche
        const da = new Date(a.coverage.date_echeance).getTime();
        const db = new Date(b.coverage.date_echeance).getTime();
        if (da !== db) return da - db;
        return Number(a.coverage.taux_change) - Number(b.coverage.taux_change);
      });
  }, [coverages, reservations, devise, excludeReservationFromLigneId, selectedCoverageId]);

  if (devise === "EUR") return null;

  return (
    <div className="border border-border/60 rounded-md bg-secondary/30 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        Couvertures FX disponibles en {devise}
      </div>

      {matching.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Aucune couverture {devise} active. Le taux du jour est utilisé.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {matching.map(({ coverage, dispo }) => {
            const taux = Number(coverage.taux_change);
            const besoin = montantDevise > 0 ? montantDevise : 0;
            const couvre = besoin === 0 || dispo >= besoin;
            const isSelected = coverage.id === selectedCoverageId;
            return (
              <li
                key={coverage.id}
                className={`flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-xs ${
                  isSelected
                    ? "border-primary/60 bg-primary/5"
                    : "border-border/60 bg-background"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">
                      {coverage.reference ?? coverage.id.slice(0, 6)}
                    </Badge>
                    <span className="tabular">@ {taux.toFixed(4)}</span>
                    <span className="text-muted-foreground">
                      · expire {formatDate(coverage.date_echeance)}
                    </span>
                    {isSelected && (
                      <Badge className="text-[10px] h-4 bg-primary/15 text-primary border-primary/30 hover:bg-primary/20">
                        Sélectionnée
                      </Badge>
                    )}
                  </div>
                  <div
                    className={`mt-0.5 ${
                      couvre ? "text-muted-foreground" : "text-orange-600"
                    }`}
                  >
                    Disponible : {dispo.toFixed(2)} {devise}
                    {besoin > 0 && !couvre && (
                      <span className="ml-1">
                        (besoin {besoin.toFixed(2)})
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={isSelected ? "secondary" : "outline"}
                  className="h-7 shrink-0"
                  onClick={() => onPick({ coverage, taux })}
                  disabled={dispo <= 0}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  {isSelected ? "Mise à jour" : "Utiliser"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

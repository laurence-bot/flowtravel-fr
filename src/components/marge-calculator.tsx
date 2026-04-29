// Calculateur de marge pour fixer le prix de vente d'une cotation.
// Deux modes : % marge nette sur CA, ou montant fixe en €.
// Intègre la TVA sur marge (régime UE) si applicable.

import { useMemo, useState } from "react";
import { Calculator, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatEUR } from "@/lib/format";

type Mode = "pct_ca" | "montant";

type Props = {
  coutTotal: number;
  regimeTva: "marge_ue" | "hors_ue";
  tauxTvaMarge: number;
  /** Appelé lorsque l'utilisateur applique le calcul. */
  onApply: (params: { prixHt: number; prixTtc: number }) => void;
};

export function MargeCalculator({ coutTotal, regimeTva, tauxTvaMarge, onApply }: Props) {
  const [mode, setMode] = useState<Mode>("pct_ca");
  const [pctCa, setPctCa] = useState<number>(25);
  const [montant, setMontant] = useState<number>(2000);

  const result = useMemo(() => {
    const cout = Math.max(0, coutTotal);
    let margeNetteSouhaitee = 0;

    if (mode === "montant") {
      margeNetteSouhaitee = montant;
    } else {
      const alpha = pctCa / 100;
      if (alpha >= 1) {
        margeNetteSouhaitee = 0;
      } else {
        // Calcul itératif pour intégrer la TVA sur marge si UE
        let prixTtc = cout / (1 - alpha);
        for (let i = 0; i < 20; i++) {
          const margeNette = alpha * prixTtc;
          const margeBrute = prixTtc - cout;
          const tvaMarge =
            regimeTva === "marge_ue" && margeBrute > 0
              ? margeBrute - margeBrute / (1 + tauxTvaMarge / 100)
              : 0;
          const next = cout + margeNette + tvaMarge;
          if (Math.abs(next - prixTtc) < 0.01) break;
          prixTtc = next;
        }
        margeNetteSouhaitee = alpha * prixTtc;
      }
    }

    let prixTtc = cout + margeNetteSouhaitee;
    if (regimeTva === "marge_ue" && margeNetteSouhaitee > 0) {
      const margeBrute = margeNetteSouhaitee * (1 + tauxTvaMarge / 100);
      prixTtc = cout + margeBrute;
    }

    const margeBrute = prixTtc - cout;
    const tvaSurMarge =
      regimeTva === "marge_ue" && margeBrute > 0
        ? margeBrute - margeBrute / (1 + tauxTvaMarge / 100)
        : 0;
    const margeNette = margeBrute - tvaSurMarge;
    const margeNettePct = prixTtc > 0 ? (margeNette / prixTtc) * 100 : 0;
    const prixHt = prixTtc - tvaSurMarge;

    return {
      prixTtc: Math.round(prixTtc * 100) / 100,
      prixHt: Math.round(prixHt * 100) / 100,
      margeBrute,
      margeNette,
      margeNettePct,
      tvaSurMarge,
    };
  }, [mode, pctCa, montant, coutTotal, regimeTva, tauxTvaMarge]);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <Calculator className="h-4 w-4 text-primary" />
        <div className="text-sm font-semibold">Calculateur de marge</div>
        <div className="ml-auto text-xs text-muted-foreground">
          Coût fournisseurs : <span className="font-medium text-foreground">{formatEUR(coutTotal)}</span>
          {regimeTva === "marge_ue" && (
            <> · TVA marge {tauxTvaMarge}%</>
          )}
        </div>
      </div>

      {/* Body : input + result */}
      <div className="p-4 space-y-4">
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pct_ca">% de marge sur CA</TabsTrigger>
            <TabsTrigger value="montant">Montant en €</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {mode === "pct_ca"
                ? "Marge nette souhaitée (%)"
                : "Marge nette souhaitée (€)"}
            </label>
            {mode === "pct_ca" ? (
              <div className="relative mt-1">
                <Input
                  type="number"
                  step="0.5"
                  value={pctCa}
                  onChange={(e) => setPctCa(Number(e.target.value))}
                  className="h-11 pr-8 text-lg font-semibold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
              </div>
            ) : (
              <div className="relative mt-1">
                <Input
                  type="number"
                  step="100"
                  value={montant}
                  onChange={(e) => setMontant(Number(e.target.value))}
                  className="h-11 pr-8 text-lg font-semibold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
              </div>
            )}
          </div>

          <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Prix de vente TTC
            </div>
            <div className="mt-1 text-2xl font-bold tabular text-primary">
              {formatEUR(result.prixTtc)}
            </div>
          </div>
        </div>

        {/* Détail */}
        <div className="grid grid-cols-3 gap-3 pt-2 border-t text-xs">
          <div>
            <div className="text-muted-foreground">Prix HT</div>
            <div className="font-semibold tabular text-sm mt-0.5">{formatEUR(result.prixHt)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Marge nette</div>
            <div className="font-semibold tabular text-sm mt-0.5 text-[color:var(--margin,inherit)]">
              {formatEUR(result.margeNette)}{" "}
              <span className="text-muted-foreground font-normal">
                ({result.margeNettePct.toFixed(1)}%)
              </span>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">TVA sur marge</div>
            <div className="font-semibold tabular text-sm mt-0.5">
              {regimeTva === "marge_ue" ? formatEUR(result.tvaSurMarge) : "—"}
            </div>
          </div>
        </div>

        <Button
          className="w-full"
          onClick={() => onApply({ prixHt: result.prixHt, prixTtc: result.prixTtc })}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Appliquer ce prix de vente
        </Button>
      </div>
    </div>
  );
}

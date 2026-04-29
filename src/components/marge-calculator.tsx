// Calculateur de marge pour fixer le prix de vente d'une cotation.
// Trois modes : % marge sur coût, % marge nette sur CA, montant fixe en €.
// Intègre la TVA sur marge (régime UE) si applicable.

import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [pctCa, setPctCa] = useState<number>(20);
  const [montant, setMontant] = useState<number>(1000);

  const result = useMemo(() => {
    const cout = Math.max(0, coutTotal);
    let margeNetteSouhaitee = 0;

    if (mode === "montant") {
      margeNetteSouhaitee = montant;
    } else {
      // pct_ca : marge nette = pct_ca % du prix TTC final
      // Résolution : prixTtc = cout + margeNette + tvaMarge
      // avec margeNette = (pct_ca/100) * prixTtc
      // et tvaMarge = (regime UE) ? margeBrute - margeBrute / (1 + t) ; margeBrute = margeNette + tvaMarge
      // Approche simple : on pose margeNette = α * prixTtc, on calcule itérativement.
      const alpha = pctCa / 100;
      if (alpha >= 1) {
        margeNetteSouhaitee = 0;
      } else {
        // prixTtc * (1 - alpha) = cout + tvaMarge
        // si hors UE : tvaMarge = 0 → prixTtc = cout / (1 - alpha)
        // si UE : tvaMarge dépend de margeBrute, on itère
        let prixTtc = cout / (1 - alpha);
        for (let i = 0; i < 20; i++) {
          const margeNette = alpha * prixTtc;
          const margeBrute = prixTtc - cout;
          const tvaMarge =
            regimeTva === "marge_ue" && margeBrute > 0
              ? margeBrute - margeBrute / (1 + tauxTvaMarge / 100)
              : 0;
          // margeBrute = margeNette + tvaMarge → prixTtc = cout + margeNette + tvaMarge
          const next = cout + margeNette + tvaMarge;
          if (Math.abs(next - prixTtc) < 0.01) break;
          prixTtc = next;
        }
        margeNetteSouhaitee = alpha * prixTtc;
      }
    }

    // À partir de la marge nette souhaitée, calcule prix TTC en intégrant TVA sur marge si UE
    let prixTtc = cout + margeNetteSouhaitee;
    if (regimeTva === "marge_ue" && margeNetteSouhaitee > 0) {
      // margeNette = margeBrute / (1 + t) → margeBrute = margeNette * (1 + t)
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
    // Pour une agence (régime marge), le HT = TTC - TVA sur marge uniquement
    const prixHt = prixTtc - tvaSurMarge;

    return {
      prixTtc: Math.round(prixTtc * 100) / 100,
      prixHt: Math.round(prixHt * 100) / 100,
      margeBrute,
      margeNette,
      margeNettePct,
      tvaSurMarge,
    };
  }, [mode, pctCout, pctCa, montant, coutTotal, regimeTva, tauxTvaMarge]);

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Calculator className="h-4 w-4 text-primary" />
        Calculateur de marge
      </div>

      <div className="text-xs text-muted-foreground">
        Coût total fournisseurs : <span className="font-semibold">{formatEUR(coutTotal)}</span>
        {regimeTva === "marge_ue" && (
          <> · TVA sur marge {tauxTvaMarge}% (régime UE)</>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Méthode de calcul</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pct_cout">% de marge sur coût</SelectItem>
              <SelectItem value="pct_ca">% de marge nette sur CA</SelectItem>
              <SelectItem value="montant">Montant fixe en €</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          {mode === "pct_cout" && (
            <>
              <Label className="text-xs">Marge sur coût (%)</Label>
              <Input
                type="number"
                step="0.5"
                value={pctCout}
                onChange={(e) => setPctCout(Number(e.target.value))}
                className="h-9"
              />
            </>
          )}
          {mode === "pct_ca" && (
            <>
              <Label className="text-xs">Marge nette / CA (%)</Label>
              <Input
                type="number"
                step="0.5"
                value={pctCa}
                onChange={(e) => setPctCa(Number(e.target.value))}
                className="h-9"
              />
            </>
          )}
          {mode === "montant" && (
            <>
              <Label className="text-xs">Marge nette souhaitée (€)</Label>
              <Input
                type="number"
                step="50"
                value={montant}
                onChange={(e) => setMontant(Number(e.target.value))}
                className="h-9"
              />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 rounded-md bg-background p-2 text-xs">
        <div>
          <div className="text-muted-foreground">Prix TTC client</div>
          <div className="font-semibold tabular text-base">{formatEUR(result.prixTtc)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Prix HT</div>
          <div className="font-semibold tabular">{formatEUR(result.prixHt)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Marge nette</div>
          <div className="font-semibold tabular text-[color:var(--margin,inherit)]">
            {formatEUR(result.margeNette)} ({result.margeNettePct.toFixed(1)}%)
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">TVA sur marge</div>
          <div className="font-semibold tabular">{formatEUR(result.tvaSurMarge)}</div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => onApply({ prixHt: result.prixHt, prixTtc: result.prixTtc })}
        >
          Appliquer ce prix
        </Button>
      </div>
    </div>
  );
}

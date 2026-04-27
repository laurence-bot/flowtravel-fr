import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useTable } from "@/hooks/use-data";
import {
  DEVISES, DEVISE_LABELS, FX_SOURCE_LABELS,
  type DeviseCode, type FxCoverage, type FxSource,
} from "@/lib/fx";
import { formatEUR } from "@/lib/format";

export type FxFieldValue = {
  devise: DeviseCode;
  montant_devise: string;
  taux_change: string;
  fx_source: FxSource;
  coverage_id: string;
};

export const emptyFxValue = (): FxFieldValue => ({
  devise: "EUR",
  montant_devise: "",
  taux_change: "1",
  fx_source: "taux_du_jour",
  coverage_id: "",
});

/**
 * Bloc de saisie devise + taux + source + couverture.
 * - Si devise = EUR : taux verrouillé à 1, source/couverture masquées.
 * - Sinon : permet de choisir une couverture FX (filtrée par devise) qui pré-remplit le taux.
 */
export function FxFieldGroup({
  value,
  onChange,
  amountLabel = "Montant",
  required = true,
}: {
  value: FxFieldValue;
  onChange: (v: FxFieldValue) => void;
  amountLabel?: string;
  required?: boolean;
}) {
  const { data: coverages } = useTable<FxCoverage>("fx_coverages");
  const isEUR = value.devise === "EUR";

  // Forcer taux=1 quand devise = EUR
  useEffect(() => {
    if (isEUR && value.taux_change !== "1") {
      onChange({ ...value, taux_change: "1", fx_source: "taux_du_jour", coverage_id: "" });
    }
  }, [isEUR, value, onChange]);

  const coveragesDevise = coverages.filter(
    (c) => c.devise === value.devise && (c.statut === "ouverte" || c.statut === "reservee"),
  );

  const handleDeviseChange = (v: DeviseCode) => {
    if (v === "EUR") {
      onChange({ ...value, devise: v, taux_change: "1", fx_source: "taux_du_jour", coverage_id: "" });
    } else {
      onChange({ ...value, devise: v, coverage_id: "" });
    }
  };

  const handleSourceChange = (s: FxSource) => {
    if (s !== "couverture") {
      onChange({ ...value, fx_source: s, coverage_id: "" });
    } else {
      onChange({ ...value, fx_source: s });
    }
  };

  const handleCoverageChange = (cid: string) => {
    const cov = coverages.find((c) => c.id === cid);
    if (cov) {
      onChange({
        ...value,
        coverage_id: cid,
        fx_source: "couverture",
        taux_change: String(cov.taux_change),
      });
    } else {
      onChange({ ...value, coverage_id: "" });
    }
  };

  const montantNum = Number(value.montant_devise);
  const tauxNum = Number(value.taux_change);
  const eur =
    Number.isFinite(montantNum) && Number.isFinite(tauxNum) && montantNum > 0
      ? montantNum * tauxNum
      : null;

  return (
    <div className="space-y-3 rounded-md border border-border/60 bg-secondary/20 p-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Devise</Label>
          <Select value={value.devise} onValueChange={(v) => handleDeviseChange(v as DeviseCode)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DEVISES.map((d) => (
                <SelectItem key={d.code} value={d.code}>
                  {d.code} — {DEVISE_LABELS[d.code]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{amountLabel} ({value.devise})</Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            required={required}
            value={value.montant_devise}
            onChange={(e) => onChange({ ...value, montant_devise: e.target.value })}
            placeholder="0,00"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Taux → EUR</Label>
          <Input
            type="number"
            step="0.0001"
            min="0.0001"
            required={!isEUR}
            disabled={isEUR}
            value={value.taux_change}
            onChange={(e) => onChange({ ...value, taux_change: e.target.value })}
            placeholder="0.92"
          />
        </div>
      </div>

      {!isEUR && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Source du taux</Label>
            <Select value={value.fx_source} onValueChange={(s) => handleSourceChange(s as FxSource)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="taux_du_jour">{FX_SOURCE_LABELS.taux_du_jour}</SelectItem>
                <SelectItem value="couverture">{FX_SOURCE_LABELS.couverture}</SelectItem>
                <SelectItem value="manuel">{FX_SOURCE_LABELS.manuel}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Couverture FX</Label>
            <Select
              value={value.coverage_id || "none"}
              onValueChange={(v) => handleCoverageChange(v === "none" ? "" : v)}
              disabled={value.fx_source !== "couverture"}
            >
              <SelectTrigger>
                <SelectValue placeholder={coveragesDevise.length === 0 ? "Aucune dispo" : "Sélectionner"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                {coveragesDevise.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.reference || `Couv. ${c.devise}`} @ {Number(c.taux_change).toFixed(4)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs pt-1">
        <span className="text-muted-foreground">Équivalent EUR</span>
        <span className="font-medium tabular-nums text-foreground">
          {eur !== null ? formatEUR(eur) : "—"}
        </span>
      </div>
    </div>
  );
}

/** Dérive les colonnes DB à insérer/mettre à jour à partir de la valeur du formulaire. */
export function fxValueToDb(v: FxFieldValue) {
  const montant_devise = Number(v.montant_devise);
  const taux = v.devise === "EUR" ? 1 : Number(v.taux_change);
  const montant_eur = montant_devise * taux;
  return {
    devise: v.devise,
    montant_devise,
    taux_change: taux,
    montant_eur,
    montant: montant_eur, // colonne historique en EUR (compat retro)
    fx_source: v.fx_source,
    coverage_id: v.coverage_id || null,
  };
}

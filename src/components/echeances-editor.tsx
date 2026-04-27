import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  ECHEANCE_STATUT_LABELS, ECHEANCE_TYPE_LABELS,
  type EcheanceStatut, type EcheanceType, type FactureEcheance, type Facture,
} from "@/hooks/use-data";
import { useTable } from "@/hooks/use-data";
import {
  formatMoney, type FxCoverage, type FxReservation, type DeviseCode,
} from "@/lib/fx";
import { formatEUR, formatDate } from "@/lib/format";
import { availableOnCoverage, createReservation, cancelReservation } from "@/lib/fx-reservations";
import { logAudit } from "@/lib/audit";
import { Plus, Trash2, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";

export function EcheancesEditor({ facture }: { facture: Facture }) {
  const { user } = useAuth();
  const [echeances, setEcheances] = useState<FactureEcheance[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: coverages, refetch: refetchCov } = useTable<FxCoverage>("fx_coverages");
  const { data: reservations, refetch: refetchRes } = useTable<FxReservation>("fx_coverage_reservations");
  const [adding, setAdding] = useState(false);

  const refetch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("facture_echeances")
      .select("*")
      .eq("facture_id", facture.id)
      .order("ordre", { ascending: true });
    setEcheances((data ?? []) as FactureEcheance[]);
    setLoading(false);
  };

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facture.id]);

  const totalDevise = echeances
    .filter((e) => e.statut !== "annule")
    .reduce((s, e) => s + Number(e.montant_devise), 0);
  const totalEUR = echeances
    .filter((e) => e.statut !== "annule")
    .reduce((s, e) => s + Number(e.montant_eur), 0);

  const factureMontantDevise = Number(facture.montant_devise ?? facture.montant);
  const reste = factureMontantDevise - totalDevise;

  const addEcheance = async (type: EcheanceType) => {
    if (!user) return;
    setAdding(true);
    const ordre = echeances.length + 1;
    const montantDevise = Math.max(0, Number(reste.toFixed(2)));
    const taux = Number(facture.taux_change) || 1;
    const { data, error } = await supabase
      .from("facture_echeances")
      .insert({
        user_id: user.id,
        facture_id: facture.id,
        ordre,
        type,
        devise: facture.devise,
        montant_devise: montantDevise,
        taux_change: taux,
        montant_eur: montantDevise * taux,
        fx_source: facture.fx_source,
        date_echeance: facture.date_echeance,
      })
      .select()
      .single();
    setAdding(false);
    if (error) return toast.error(error.message);
    await logAudit({
      userId: user.id,
      entity: "facture_echeance",
      entityId: data.id,
      action: "create",
      description: `Échéance ${ECHEANCE_TYPE_LABELS[type]} ajoutée`,
      newValue: data,
    });
    refetch();
  };

  const removeEcheance = async (id: string) => {
    if (!user) return;
    if (!confirm("Supprimer cette échéance ?")) return;
    // Annuler d'abord les réservations actives liées
    const linked = reservations.filter((r) => r.echeance_id === id && r.statut === "active");
    for (const r of linked) {
      await cancelReservation({ userId: user.id, reservationId: r.id });
    }
    const { error } = await supabase.from("facture_echeances").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logAudit({
      userId: user.id,
      entity: "facture_echeance",
      entityId: id,
      action: "delete",
      description: "Échéance supprimée",
    });
    refetchRes();
    refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-display text-lg">Échéances</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Découpez la facture en acomptes et solde, avec couverture FX par échéance.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Select onValueChange={(v) => addEcheance(v as EcheanceType)} disabled={adding}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="+ Ajouter échéance" />
            </SelectTrigger>
            <SelectContent>
              {(["acompte_1", "acompte_2", "acompte_3", "solde", "autre"] as EcheanceType[]).map((t) => (
                <SelectItem key={t} value={t}>{ECHEANCE_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs">
        <SummaryBox label="Total facture" value={formatMoney(factureMontantDevise, facture.devise)} />
        <SummaryBox label="Total échéances" value={formatMoney(totalDevise, facture.devise)} sub={formatEUR(totalEUR)} />
        <SummaryBox
          label="Reste à découper"
          value={formatMoney(reste, facture.devise)}
          tone={Math.abs(reste) < 0.01 ? "ok" : reste < 0 ? "alert" : "warn"}
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Chargement…</p>
      ) : echeances.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border/60 rounded-md">
          Aucune échéance. Ajoutez un acompte ou un solde ci-dessus.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Montant ({facture.devise})</TableHead>
              <TableHead className="text-right">Taux</TableHead>
              <TableHead className="text-right">EUR</TableHead>
              <TableHead>Couverture</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {echeances.map((e) => (
              <EcheanceRow
                key={e.id}
                echeance={e}
                facture={facture}
                coverages={coverages}
                reservations={reservations}
                onChanged={() => { refetch(); refetchRes(); refetchCov(); }}
                onRemove={() => removeEcheance(e.id)}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function SummaryBox({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" | "alert" }) {
  const cls =
    tone === "ok" ? "text-emerald-600 dark:text-emerald-400" :
    tone === "warn" ? "text-orange-600 dark:text-orange-400" :
    tone === "alert" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-md border border-border/60 bg-secondary/20 p-3">
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
      <div className={`mt-1 tabular-nums font-medium ${cls}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function EcheanceRow({
  echeance, facture, coverages, reservations, onChanged, onRemove,
}: {
  echeance: FactureEcheance;
  facture: Facture;
  coverages: FxCoverage[];
  reservations: FxReservation[];
  onChanged: () => void;
  onRemove: () => void;
}) {
  const { user } = useAuth();
  const isEUR = echeance.devise === "EUR";
  const reservation = reservations.find(
    (r) => r.echeance_id === echeance.id && r.statut === "active",
  );
  const coverage = reservation
    ? coverages.find((c) => c.id === reservation.coverage_id)
    : echeance.coverage_id
    ? coverages.find((c) => c.id === echeance.coverage_id)
    : null;

  const eligibleCoverages = coverages.filter(
    (c) => c.devise === echeance.devise &&
           (c.statut === "ouverte" || c.statut === "reservee") &&
           availableOnCoverage(c, reservations) >= Number(echeance.montant_devise),
  );

  const reserve = async (coverageId: string) => {
    if (!user) return;
    const cov = coverages.find((c) => c.id === coverageId);
    if (!cov) return;
    const { data: res, error } = await createReservation({
      userId: user.id,
      coverageId,
      montantDevise: Number(echeance.montant_devise),
      tauxChange: Number(cov.taux_change),
      echeanceId: echeance.id,
    });
    if (error) return toast.error(error);
    // Mettre à jour l'échéance avec le nouveau taux issu de la couverture
    const newEur = Number(echeance.montant_devise) * Number(cov.taux_change);
    await supabase.from("facture_echeances").update({
      coverage_id: coverageId,
      taux_change: Number(cov.taux_change),
      montant_eur: newEur,
      fx_source: "couverture",
    }).eq("id", echeance.id);
    toast.success("Couverture réservée");
    onChanged();
  };

  const unreserve = async () => {
    if (!user || !reservation) return;
    const { error } = await cancelReservation({
      userId: user.id,
      reservationId: reservation.id,
    });
    if (error) return toast.error(error);
    await supabase.from("facture_echeances").update({
      coverage_id: null,
      fx_source: "taux_du_jour",
    }).eq("id", echeance.id);
    toast.success("Réservation annulée");
    onChanged();
  };

  const updateStatut = async (statut: EcheanceStatut) => {
    if (!user) return;
    const { error } = await supabase.from("facture_echeances").update({ statut }).eq("id", echeance.id);
    if (error) return toast.error(error.message);
    onChanged();
  };

  const updateField = async (patch: Partial<FactureEcheance>) => {
    if (!user) return;
    const next = { ...echeance, ...patch };
    if (patch.montant_devise !== undefined || patch.taux_change !== undefined) {
      next.montant_eur = Number(next.montant_devise) * Number(next.taux_change);
    }
    const { error } = await supabase.from("facture_echeances").update({
      montant_devise: next.montant_devise,
      taux_change: next.taux_change,
      montant_eur: next.montant_eur,
      date_echeance: next.date_echeance,
    }).eq("id", echeance.id);
    if (error) return toast.error(error.message);
    onChanged();
  };

  return (
    <TableRow>
      <TableCell className="font-medium">
        {ECHEANCE_TYPE_LABELS[echeance.type]}
      </TableCell>
      <TableCell>
        <Input
          type="date"
          value={echeance.date_echeance ?? ""}
          onChange={(e) => updateField({ date_echeance: e.target.value || null })}
          className="h-8 w-[140px]"
        />
      </TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          step="0.01"
          value={echeance.montant_devise}
          onChange={(e) => updateField({ montant_devise: Number(e.target.value) })}
          className="h-8 w-[110px] text-right tabular-nums ml-auto"
        />
      </TableCell>
      <TableCell className="text-right">
        {isEUR ? (
          <span className="text-muted-foreground text-xs">—</span>
        ) : (
          <Input
            type="number"
            step="0.0001"
            value={echeance.taux_change}
            onChange={(e) => updateField({ taux_change: Number(e.target.value) })}
            disabled={!!reservation}
            className="h-8 w-[90px] text-right tabular-nums ml-auto"
          />
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums font-medium">
        {formatEUR(Number(echeance.montant_eur))}
      </TableCell>
      <TableCell>
        {isEUR ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : reservation && coverage ? (
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] gap-1">
              <ShieldCheck className="h-3 w-3 text-emerald-600" />
              {coverage.reference || `Couv ${coverage.devise}`}
            </Badge>
            <Button size="sm" variant="ghost" onClick={unreserve} title="Annuler la réservation">
              <ShieldOff className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Select onValueChange={reserve}>
            <SelectTrigger className="h-8 w-[170px] text-xs">
              <SelectValue placeholder={eligibleCoverages.length === 0 ? "Aucune dispo" : "Réserver…"} />
            </SelectTrigger>
            <SelectContent>
              {eligibleCoverages.length === 0 && (
                <div className="px-2 py-2 text-xs text-muted-foreground">
                  Aucune couverture éligible
                </div>
              )}
              {eligibleCoverages.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.reference || `${c.devise}`} — dispo {formatMoney(availableOnCoverage(c, reservations), c.devise)} @ {Number(c.taux_change).toFixed(4)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </TableCell>
      <TableCell>
        <Select value={echeance.statut} onValueChange={(v) => updateStatut(v as EcheanceStatut)}>
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["a_payer", "paye", "en_retard", "annule"] as EcheanceStatut[]).map((s) => (
              <SelectItem key={s} value={s}>{ECHEANCE_STATUT_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Button size="sm" variant="ghost" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

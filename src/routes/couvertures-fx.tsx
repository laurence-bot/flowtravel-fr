import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useTable } from "@/hooks/use-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatDate, formatEUR } from "@/lib/format";
import {
  DEVISES, DEVISE_LABELS, FX_STATUT_COLORS, FX_STATUT_LABELS,
  coverageBalance, formatMoney,
  type DeviseCode, type FxCoverage, type FxCoverageStatut, type FxReservation,
} from "@/lib/fx";
import { computeCoverageUsage, computeFxPnl } from "@/lib/fx-pnl";
import type { FactureEcheance, Paiement } from "@/hooks/use-data";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Plus, Shield, ShieldAlert, ShieldCheck, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/couvertures-fx")({
  component: () => (
    <RequireAuth>
      <CouverturesFXPage />
    </RequireAuth>
  ),
});

const coverageSchema = z.object({
  reference: z.string().trim().max(80).optional(),
  devise: z.enum(["USD","GBP","ZAR","CHF","CAD","AUD","JPY","AED","MAD","TND"]),
  montant_devise: z.number().positive("Montant > 0"),
  taux_change: z.number().positive("Taux > 0"),
  date_ouverture: z.string().min(1),
  date_echeance: z.string().min(1),
  notes: z.string().max(500).optional(),
}).refine((d) => d.date_echeance >= d.date_ouverture, {
  path: ["date_echeance"],
  message: "L'échéance doit être ≥ ouverture",
});

function CouverturesFXPage() {
  const { user } = useAuth();
  const { data: coverages, loading, refetch } = useTable<FxCoverage>("fx_coverages");
  const { data: reservations } = useTable<FxReservation>("fx_coverage_reservations");
  const { data: echeances } = useTable<FactureEcheance>("facture_echeances");
  const { data: paiements } = useTable<Paiement>("paiements");

  const totalEUR = coverages.reduce(
    (s, c) => s + Number(c.montant_devise) * Number(c.taux_change), 0,
  );
  const ouvertes = coverages.filter((c) => c.statut === "ouverte").length;
  const reservees = coverages.filter((c) => c.statut === "reservee").length;
  const anomalies = coverages.filter((c) => c.statut === "anomalie" || c.statut === "expiree").length;
  const fxPnl = computeFxPnl({ echeances, paiements, reservations });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Couvertures FX"
        description="Pilotez vos couvertures de change Ebury et leur utilisation par devise"
        action={<NewCoverageDialog userId={user?.id} onDone={refetch} />}
      />

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Couvertures actives" value={`${coverages.length}`} icon={Shield} hint={`${ouvertes} ouverte(s)`} />
        <KPI label="Exposition couverte (EUR)" value={formatEUR(totalEUR)} icon={TrendingUp} />
        <KPI label="Réservées" value={`${reservees}`} icon={ShieldCheck} hint="Affectées à des factures" />
        <KPI label="Alertes" value={`${anomalies}`} icon={ShieldAlert} hint="Expirées ou en anomalie" tone="alert" />
      </section>

      <Card className="border-border/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-border/60">
          <h2 className="font-display text-lg">Liste des couvertures</h2>
        </div>
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : coverages.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="Aucune couverture FX"
            description="Créez votre première couverture de change pour sécuriser un taux."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Devise</TableHead>
                <TableHead className="text-right">Montant devise</TableHead>
                <TableHead className="text-right">Taux</TableHead>
                <TableHead className="text-right">Équivalent EUR</TableHead>
                <TableHead className="text-right">Réservé</TableHead>
                <TableHead className="text-right">Disponible</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coverages.map((c) => {
                const { reserve, disponible } = coverageBalance(c, reservations);
                const eur = Number(c.montant_devise) * Number(c.taux_change);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.reference || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">{c.devise}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(c.montant_devise, c.devise)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {Number(c.taux_change).toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatEUR(eur)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatMoney(reserve, c.devise)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatMoney(disponible, c.devise)}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(c.date_echeance)}</TableCell>
                    <TableCell>
                      <StatutBadge statut={c.statut} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Impact change global */}
      {fxPnl.entries.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-lg flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Impact change (gain / perte FX)
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPI label="Exposition totale" value={formatEUR(fxPnl.expositionEUR)} icon={TrendingUp} hint={`${fxPnl.entries.length} mouvement(s)`} />
            <KPI label="Couvert" value={formatEUR(fxPnl.couvert)} icon={ShieldCheck} hint="via couvertures" />
            <KPI label="Non couvert" value={formatEUR(fxPnl.nonCouvert)} icon={ShieldAlert} hint="exposé taux du jour" tone={fxPnl.nonCouvert > 0 ? "alert" : undefined} />
            <KPI
              label="Écart net vs marché"
              value={`${fxPnl.net >= 0 ? "+" : ""}${formatEUR(fxPnl.net)}`}
              icon={fxPnl.net >= 0 ? TrendingUp : TrendingDown}
              tone={fxPnl.net < 0 ? "alert" : undefined}
              hint={`Gain ${formatEUR(fxPnl.gainTotal)} / Perte ${formatEUR(fxPnl.perteTotal)}`}
            />
          </div>
        </section>
      )}

      {/* Détail utilisation par couverture */}
      {coverages.length > 0 && (
        <Card className="border-border/60 overflow-hidden">
          <div className="px-6 py-4 border-b border-border/60">
            <h2 className="font-display text-lg">Utilisation et écart par couverture</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Comparaison du taux couvert vs taux de marché de référence sur la portion engagée.
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Devise</TableHead>
                <TableHead className="text-right">Taux couvert</TableHead>
                <TableHead className="text-right">Réservé</TableHead>
                <TableHead className="text-right">Utilisé</TableHead>
                <TableHead className="text-right">Disponible</TableHead>
                <TableHead className="text-right">Écart EUR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coverages.map((c) => {
                const u = computeCoverageUsage(c, reservations);
                const ecartTone = u.ecart === 0 ? "" : u.ecart > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive";
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.reference || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">{c.devise}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{Number(c.taux_change).toFixed(4)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(u.reserveActif, c.devise)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(u.utilise, c.devise)}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">{formatMoney(u.disponible, c.devise)}</TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${ecartTone}`}>
                      {u.ecart === 0 ? "—" : `${u.ecart > 0 ? "+" : ""}${formatEUR(u.ecart)}`}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function StatutBadge({ statut }: { statut: FxCoverageStatut }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium ${FX_STATUT_COLORS[statut]}`}>
      {FX_STATUT_LABELS[statut]}
    </span>
  );
}

function KPI({
  label, value, icon: Icon, hint, tone,
}: {
  label: string; value: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  tone?: "alert";
}) {
  return (
    <Card className="p-5 border-border/60">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
          <div className={`mt-1 text-2xl font-display ${tone === "alert" ? "text-destructive" : ""}`}>{value}</div>
          {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
        </div>
        <div className={`h-9 w-9 rounded-md flex items-center justify-center ${tone === "alert" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

function NewCoverageDialog({ userId, onDone }: { userId?: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    reference: "",
    devise: "USD" as Exclude<DeviseCode, "EUR">,
    montant_devise: "",
    taux_change: "",
    date_ouverture: new Date().toISOString().slice(0, 10),
    date_echeance: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!userId) return;
    const parsed = coverageSchema.safeParse({
      reference: form.reference || undefined,
      devise: form.devise,
      montant_devise: Number(form.montant_devise),
      taux_change: Number(form.taux_change),
      date_ouverture: form.date_ouverture,
      date_echeance: form.date_echeance,
      notes: form.notes || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Champs invalides");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.from("fx_coverages").insert({
      user_id: userId,
      reference: parsed.data.reference ?? null,
      devise: parsed.data.devise,
      montant_devise: parsed.data.montant_devise,
      taux_change: parsed.data.taux_change,
      date_ouverture: parsed.data.date_ouverture,
      date_echeance: parsed.data.date_echeance,
      notes: parsed.data.notes ?? null,
    }).select("id").single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit({
      userId,
      entity: "fx_coverage",
      entityId: data?.id,
      action: "create",
      description: `Couverture FX ${parsed.data.devise} ${parsed.data.montant_devise} @ ${parsed.data.taux_change}`,
    });
    toast.success("Couverture créée");
    setOpen(false);
    setForm({ ...form, reference: "", montant_devise: "", taux_change: "", notes: "" });
    onDone();
  };

  const devisesEtrangeres = DEVISES.filter((d) => d.code !== "EUR");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle couverture
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle couverture FX</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Référence (optionnel)</Label>
            <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Ebury #12345" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Devise</Label>
              <Select value={form.devise} onValueChange={(v) => setForm({ ...form, devise: v as Exclude<DeviseCode, "EUR"> })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {devisesEtrangeres.map((d) => (
                    <SelectItem key={d.code} value={d.code}>{d.code} — {DEVISE_LABELS[d.code]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Montant en devise</Label>
              <Input type="number" step="0.01" value={form.montant_devise} onChange={(e) => setForm({ ...form, montant_devise: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Taux vers EUR (1 {form.devise} = X EUR)</Label>
            <Input type="number" step="0.0001" value={form.taux_change} onChange={(e) => setForm({ ...form, taux_change: e.target.value })} placeholder="0.92" />
            {form.montant_devise && form.taux_change && (
              <p className="text-xs text-muted-foreground mt-1">
                Équivaut à {formatEUR(Number(form.montant_devise) * Number(form.taux_change))}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date d'ouverture</Label>
              <Input type="date" value={form.date_ouverture} onChange={(e) => setForm({ ...form, date_ouverture: e.target.value })} />
            </div>
            <div>
              <Label>Date d'échéance</Label>
              <Input type="date" value={form.date_echeance} onChange={(e) => setForm({ ...form, date_echeance: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Créer"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

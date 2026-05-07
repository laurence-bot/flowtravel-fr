import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useTable,
  type Compte,
  type Transfert,
  type Paiement,
  type CompteBanque,
  type CompteCategorie,
  BANQUE_LABELS,
  CATEGORIE_LABELS,
} from "@/hooks/use-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatEUR, formatDate } from "@/lib/format";
import { computeComptesSoldes, computeTresorerieGlobale } from "@/lib/finance";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Plus, Landmark, ArrowRightLeft, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/comptes")({
  component: () => (
    <RequireAuth>
      <ComptesPage />
    </RequireAuth>
  ),
});

const compteSchema = z.object({
  nom: z.string().trim().min(1, "Nom requis").max(80),
  banque: z.enum(["sg", "cic", "ebury", "autre"]),
  categorie: z.enum(["gestion", "anticipation", "clients", "fournisseurs", "plateforme"]),
  solde_initial: z.number().finite(),
});

const transfertSchema = z.object({
  compte_source_id: z.string().uuid("Compte source requis"),
  compte_destination_id: z.string().uuid("Compte destination requis"),
  montant: z.number().positive("Montant > 0"),
  date: z.string().min(1, "Date requise"),
  libelle: z.string().max(120).optional(),
}).refine((d) => d.compte_source_id !== d.compte_destination_id, {
  message: "Les comptes doivent être différents",
  path: ["compte_destination_id"],
});

function ComptesPage() {
  const { user } = useAuth();
  const { data: comptes, loading, refetch: refetchComptes } = useTable<Compte>("comptes");
  const { data: transferts, refetch: refetchTransferts } = useTable<Transfert>("transferts");
  const { data: paiements } = useTable<Paiement>("paiements");

  const soldes = computeComptesSoldes(comptes, paiements, transferts);
  const tresorerie = computeTresorerieGlobale(soldes);

  const Header = (
    <div className="flex flex-wrap gap-2">
      <NewTransfertDialog comptes={comptes} userId={user?.id} onDone={() => { refetchTransferts(); }} />
      <NewCompteDialog userId={user?.id} onDone={() => refetchComptes()} />
    </div>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Comptes & Trésorerie"
        description="Pilotez vos comptes internes et les transferts entre banques"
        action={Header}
      />

      {/* KPIs trésorerie globale */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Trésorerie totale" value={formatEUR(tresorerie.soldeTotal)} icon={Wallet} tone="cash" hint={`${tresorerie.nbComptes} compte${tresorerie.nbComptes > 1 ? "s" : ""}`} />
        <KPI label="Total encaissé" value={formatEUR(tresorerie.totalEntrees)} icon={TrendingUp} tone="revenue" />
        <KPI label="Total décaissé" value={formatEUR(tresorerie.totalSorties)} icon={TrendingDown} tone="cost" />
        <KPI label="Transferts internes" value={`${transferts.length}`} icon={ArrowRightLeft} tone="margin" hint="Neutres pour la trésorerie globale" />
      </section>

      {/* Liste comptes */}
      <Card className="border-border/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-border/60">
          <h2 className="font-display text-lg">Comptes financiers</h2>
        </div>
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : comptes.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="Aucun compte configuré"
            description="Créez vos comptes (SG gestion, CIC anticipation, Ebury…) pour suivre votre trésorerie réelle."
            action={<NewCompteDialog userId={user?.id} onDone={() => refetchComptes()} />}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                <TableHead>Compte</TableHead>
                <TableHead>Banque</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead className="text-right">Entrées</TableHead>
                <TableHead className="text-right">Sorties</TableHead>
                <TableHead className="text-right">Solde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {soldes.map((s) => (
                <TableRow key={s.compte.id}>
                  <TableCell className="font-medium">{s.compte.nom}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                      {BANQUE_LABELS[s.compte.banque]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground capitalize">{CATEGORIE_LABELS[s.compte.categorie]}</TableCell>
                  <TableCell className="text-right tabular text-[color:var(--revenue)]">+{formatEUR(s.entrees)}</TableCell>
                  <TableCell className="text-right tabular text-[color:var(--cost)]">−{formatEUR(s.sorties)}</TableCell>
                  <TableCell className={`text-right tabular font-semibold ${s.solde >= 0 ? "" : "text-destructive"}`}>
                    {formatEUR(s.solde)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Historique transferts */}
      <Card className="border-border/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
          <h2 className="font-display text-lg flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
            Transferts internes
          </h2>
          <span className="text-xs text-muted-foreground">N'impactent pas la trésorerie globale</span>
        </div>
        {transferts.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            Aucun transfert enregistré.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                <TableHead>Date</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transferts.map((t) => {
                const src = comptes.find((c) => c.id === t.compte_source_id);
                const dst = comptes.find((c) => c.id === t.compte_destination_id);
                return (
                  <TableRow key={t.id}>
                    <TableCell>{formatDate(t.date)}</TableCell>
                    <TableCell className="text-muted-foreground">{src?.nom ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{dst?.nom ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{t.libelle ?? "—"}</TableCell>
                    <TableCell className="text-right tabular font-medium">{formatEUR(t.montant)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function KPI({
  label,
  value,
  icon: Icon,
  tone,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "revenue" | "cost" | "margin" | "cash";
  hint?: string;
}) {
  const colorVar = `var(--${tone})`;
  return (
    <Card className="p-5 relative overflow-hidden border-border/60">
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ backgroundColor: colorVar }} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
          <div className="mt-2.5 text-2xl font-semibold tabular">{value}</div>
          {hint && <div className="text-xs text-muted-foreground mt-1.5">{hint}</div>}
        </div>
        <div
          className="h-10 w-10 rounded-md flex items-center justify-center shrink-0"
          style={{ backgroundColor: `color-mix(in oklab, ${colorVar} 12%, transparent)`, color: colorVar }}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function NewCompteDialog({ userId, onDone }: { userId?: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    nom: "",
    banque: "sg" as CompteBanque,
    categorie: "gestion" as CompteCategorie,
    solde_initial: "0",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    const parsed = compteSchema.safeParse({
      nom: form.nom,
      banque: form.banque,
      categorie: form.categorie,
      solde_initial: Number(form.solde_initial),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSubmitting(true);
    const { data: inserted, error } = await supabase.from("comptes").insert({
      user_id: userId,
      ...parsed.data,
    }).select().single();
    setSubmitting(false);
    if (error) return toast.error(error.message);
    await logAudit({
      userId,
      entity: "compte",
      action: "create",
      entityId: inserted?.id,
      description: `Compte créé : ${parsed.data.nom} (${parsed.data.banque}, solde initial ${parsed.data.solde_initial} €)`,
      newValue: inserted,
    });
    toast.success("Compte créé");
    setOpen(false);
    setForm({ nom: "", banque: "sg", categorie: "gestion", solde_initial: "0" });
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau compte
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Nouveau compte</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nom</Label>
            <Input autoFocus required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="SG Gestion, CIC Anticipation…" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Banque</Label>
              <Select value={form.banque} onValueChange={(v: CompteBanque) => setForm({ ...form, banque: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(BANQUE_LABELS) as CompteBanque[]).map((b) => (
                    <SelectItem key={b} value={b}>{BANQUE_LABELS[b]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select value={form.categorie} onValueChange={(v: CompteCategorie) => setForm({ ...form, categorie: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORIE_LABELS) as CompteCategorie[]).map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORIE_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Solde initial (€)</Label>
            <Input type="number" step="0.01" value={form.solde_initial} onChange={(e) => setForm({ ...form, solde_initial: e.target.value })} />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Création…" : "Créer le compte"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewTransfertDialog({
  comptes,
  userId,
  onDone,
}: {
  comptes: Compte[];
  userId?: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    compte_source_id: "",
    compte_destination_id: "",
    montant: "",
    date: today,
    libelle: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    const parsed = transfertSchema.safeParse({
      compte_source_id: form.compte_source_id,
      compte_destination_id: form.compte_destination_id,
      montant: Number(form.montant),
      date: form.date,
      libelle: form.libelle || undefined,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSubmitting(true);
    const { data: inserted, error } = await supabase.from("transferts").insert({
      user_id: userId,
      ...parsed.data,
      libelle: parsed.data.libelle ?? null,
    }).select().single();
    setSubmitting(false);
    if (error) return toast.error(error.message);
    await logAudit({
      userId,
      entity: "transfert",
      action: "create",
      entityId: inserted?.id,
      description: `Transfert interne de ${parsed.data.montant} €${parsed.data.libelle ? ` — ${parsed.data.libelle}` : ""}`,
      newValue: inserted,
    });
    toast.success("Transfert enregistré");
    setOpen(false);
    setForm({ ...form, montant: "", libelle: "" });
    onDone();
  };

  const disabled = comptes.length < 2;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled} title={disabled ? "Créez au moins 2 comptes" : ""}>
          <ArrowRightLeft className="h-4 w-4 mr-2" />
          Transfert interne
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Transfert interne</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Compte source</Label>
            <Select value={form.compte_source_id} onValueChange={(v) => setForm({ ...form, compte_source_id: v })}>
              <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
              <SelectContent>
                {comptes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Compte destination</Label>
            <Select value={form.compte_destination_id} onValueChange={(v) => setForm({ ...form, compte_destination_id: v })}>
              <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
              <SelectContent>
                {comptes.filter((c) => c.id !== form.compte_source_id).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Montant (€)</Label>
              <Input type="number" step="0.01" min="0.01" required value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Libellé (optionnel)</Label>
            <Input value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} placeholder="Ex: réapprovisionnement Ebury" />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Enregistrement…" : "Enregistrer le transfert"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

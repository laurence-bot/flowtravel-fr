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
import { useTable, type Contact, type Dossier, type Paiement, type Compte } from "@/hooks/use-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatEUR, formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/fx";
import { paiementEUR } from "@/lib/finance";
import { FxFieldGroup, fxValueToDb, emptyFxValue, type FxFieldValue } from "@/components/fx-field-group";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Plus, Wallet, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/paiements")({
  component: () => (
    <RequireAuth>
      <PaiementsPage />
    </RequireAuth>
  ),
});

const paiementSchema = z.object({
  type: z.enum(["paiement_client", "paiement_fournisseur"]),
  date: z.string().min(1, "Date requise"),
  methode: z.enum(["virement", "carte", "especes"]),
  source: z.enum(["banque", "manuel"]),
  dossier_id: z.string().uuid().optional().or(z.literal("")),
  personne_id: z.string().uuid().optional().or(z.literal("")),
  compte_id: z.string().uuid("Compte requis"),
});

function PaiementsPage() {
  const { data: paiements, loading, refetch } = useTable<Paiement>("paiements");
  const { data: dossiers } = useTable<Dossier>("dossiers");
  const { data: contacts } = useTable<Contact>("contacts");
  const { data: comptes } = useTable<Compte>("comptes");
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<"all" | "paiement_client" | "paiement_fournisseur">("all");

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    type: "paiement_client" as Paiement["type"],
    date: today,
    methode: "virement" as Paiement["methode"],
    source: "manuel" as Paiement["source"],
    dossier_id: "",
    personne_id: "",
    compte_id: "",
  });
  const [fx, setFx] = useState<FxFieldValue>(emptyFxValue());

  const filtered = paiements.filter((p) => filter === "all" || p.type === filter);
  const totalEncaisse = paiements
    .filter((p) => p.type === "paiement_client")
    .reduce((s, p) => s + paiementEUR(p), 0);
  const totalDecaisse = paiements
    .filter((p) => p.type === "paiement_fournisseur")
    .reduce((s, p) => s + paiementEUR(p), 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = paiementSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const fxDb = fxValueToDb(fx);
    if (!(fxDb.montant_devise > 0)) {
      toast.error("Montant invalide");
      return;
    }
    setSubmitting(true);
    const { data: inserted, error } = await supabase.from("paiements").insert({
      user_id: user.id,
      type: parsed.data.type,
      date: parsed.data.date,
      methode: parsed.data.methode,
      source: parsed.data.source,
      dossier_id: parsed.data.dossier_id || null,
      personne_id: parsed.data.personne_id || null,
      compte_id: parsed.data.compte_id,
      ...fxDb,
    }).select().single();
    setSubmitting(false);
    if (error) return toast.error(error.message);
    await logAudit({
      userId: user.id,
      entity: "paiement",
      action: "create",
      entityId: inserted?.id,
      description: `${parsed.data.type === "paiement_client" ? "Encaissement" : "Paiement fournisseur"} ${formatMoney(fxDb.montant_devise, fxDb.devise)}${fxDb.devise !== "EUR" ? ` (${formatEUR(fxDb.montant_eur)})` : ""}`,
      newValue: inserted,
    });
    toast.success("Paiement enregistré");
    setOpen(false);
    setForm({ ...form, dossier_id: "", personne_id: "" });
    setFx(emptyFxValue());
    refetch();
  };

  const personnesFiltrees = contacts.filter((c) =>
    form.type === "paiement_client" ? c.type === "client" : c.type === "fournisseur",
  );
  const dossierTitre = (id: string | null) => dossiers.find((d) => d.id === id)?.titre ?? "—";
  const personneNom = (id: string | null) => contacts.find((c) => c.id === id)?.nom ?? "—";
  const compteNom = (id: string | null) => comptes.find((c) => c.id === id)?.nom ?? "—";

  const NewPaiementButton = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau paiement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Enregistrer un paiement</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          {/* Type — toggle visuel */}
          <div className="space-y-2">
            <Label>Type de flux</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, type: "paiement_client", personne_id: "" })}
                className={`flex items-center gap-2 px-3 py-3 rounded-md border text-sm transition-all ${
                  form.type === "paiement_client"
                    ? "border-[color:var(--revenue)] bg-[color:var(--revenue)]/10 text-[color:var(--revenue)] font-medium"
                    : "border-border text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                <ArrowDownLeft className="h-4 w-4" />
                Encaissement client
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, type: "paiement_fournisseur", personne_id: "" })}
                className={`flex items-center gap-2 px-3 py-3 rounded-md border text-sm transition-all ${
                  form.type === "paiement_fournisseur"
                    ? "border-[color:var(--cost)] bg-[color:var(--cost)]/10 text-[color:var(--cost)] font-medium"
                    : "border-border text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                <ArrowUpRight className="h-4 w-4" />
                Paiement fournisseur
              </button>
            </div>
          </div>

          <FxFieldGroup value={fx} onChange={setFx} amountLabel="Montant" />

          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Méthode</Label>
              <Select value={form.methode} onValueChange={(v: Paiement["methode"]) => setForm({ ...form, methode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="virement">Virement</SelectItem>
                  <SelectItem value="carte">Carte</SelectItem>
                  <SelectItem value="especes">Espèces</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={(v: Paiement["source"]) => setForm({ ...form, source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manuel">Saisie manuelle</SelectItem>
                  <SelectItem value="banque">Banque</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{form.type === "paiement_client" ? "Client" : "Fournisseur"}</Label>
            <Select value={form.personne_id} onValueChange={(v) => setForm({ ...form, personne_id: v })}>
              <SelectTrigger><SelectValue placeholder="Optionnel" /></SelectTrigger>
              <SelectContent>
                {personnesFiltrees.length === 0 && (
                  <div className="px-2 py-2 text-sm text-muted-foreground">
                    Aucun {form.type === "paiement_client" ? "client" : "fournisseur"}.
                  </div>
                )}
                {personnesFiltrees.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Dossier rattaché</Label>
            <Select value={form.dossier_id} onValueChange={(v) => setForm({ ...form, dossier_id: v })}>
              <SelectTrigger><SelectValue placeholder="Optionnel" /></SelectTrigger>
              <SelectContent>
                {dossiers.length === 0 && (
                  <div className="px-2 py-2 text-sm text-muted-foreground">Aucun dossier.</div>
                )}
                {dossiers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.titre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Compte impacté <span className="text-destructive">*</span></Label>
            <Select value={form.compte_id} onValueChange={(v) => setForm({ ...form, compte_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder={comptes.length === 0 ? "Créez d'abord un compte" : "Choisir le compte"} />
              </SelectTrigger>
              <SelectContent>
                {comptes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {comptes.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Rendez-vous dans <span className="font-medium">Comptes & Trésorerie</span> pour créer vos comptes.
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Enregistrement…" : "Enregistrer le paiement"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Paiements"
        description="Tous les flux financiers entrants et sortants"
        action={NewPaiementButton}
      />

      {/* Résumé */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 border-border/60">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Encaissements</div>
          <div className="mt-2 text-xl font-semibold tabular text-[color:var(--revenue)]">+{formatEUR(totalEncaisse)}</div>
        </Card>
        <Card className="p-5 border-border/60">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Décaissements</div>
          <div className="mt-2 text-xl font-semibold tabular text-[color:var(--cost)]">−{formatEUR(totalDecaisse)}</div>
        </Card>
        <Card className="p-5 border-border/60">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Solde</div>
          <div className="mt-2 text-xl font-semibold tabular">{formatEUR(totalEncaisse - totalDecaisse)}</div>
        </Card>
      </section>

      <div className="flex gap-2">
        {(["all", "paiement_client", "paiement_fournisseur"] as const).map((t) => (
          <Button
            key={t}
            variant={filter === t ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(t)}
          >
            {t === "all" ? "Tous" : t === "paiement_client" ? "Encaissements" : "Décaissements"}
          </Button>
        ))}
      </div>

      <Card className="border-border/60 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={paiements.length === 0 ? "Aucun paiement" : "Aucun résultat"}
            description={
              paiements.length === 0
                ? "Enregistrez votre premier flux financier pour suivre votre trésorerie."
                : "Modifiez le filtre pour voir d'autres paiements."
            }
            action={paiements.length === 0 ? NewPaiementButton : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Personne</TableHead>
                <TableHead>Dossier</TableHead>
                <TableHead>Compte</TableHead>
                <TableHead>Méthode</TableHead>
                <TableHead>Rapprochement</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDate(p.date)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        p.type === "paiement_client"
                          ? "bg-[color:var(--revenue)]/10 text-[color:var(--revenue)] border-[color:var(--revenue)]/20"
                          : "bg-[color:var(--cost)]/10 text-[color:var(--cost)] border-[color:var(--cost)]/20"
                      }
                    >
                      {p.type === "paiement_client" ? "Encaissement" : "Décaissement"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{personneNom(p.personne_id)}</TableCell>
                  <TableCell className="text-muted-foreground">{dossierTitre(p.dossier_id)}</TableCell>
                  <TableCell className="text-muted-foreground">{compteNom(p.compte_id)}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{p.methode}</TableCell>
                  <TableCell>
                    {p.statut_rapprochement === "rapproche" ? (
                      <Badge variant="outline" className="bg-[color:var(--margin)]/12 text-[color:var(--margin)] border-[color:var(--margin)]/25">
                        Rapproché
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted text-muted-foreground border-transparent">
                        En attente
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular font-medium ${
                      p.type === "paiement_client" ? "text-[color:var(--revenue)]" : "text-[color:var(--cost)]"
                    }`}
                  >
                    <div>
                      {p.type === "paiement_client" ? "+" : "−"}
                      {formatEUR(paiementEUR(p))}
                    </div>
                    {p.devise !== "EUR" && (
                      <div className="text-[11px] text-muted-foreground font-normal mt-0.5">
                        {formatMoney(p.montant_devise ?? 0, p.devise)} @ {Number(p.taux_change).toFixed(4)}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

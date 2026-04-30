import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTable, type Contact, type Dossier } from "@/hooks/use-data";
import { useAgents, agentLabel } from "@/hooks/use-agents";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatEUR } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatutBadge } from "@/components/statut-badge";
import { Plus, FolderOpen, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/dossiers")({
  component: DossiersRoute,
});

function DossiersRoute() {
  const location = useLocation();
  if (location.pathname !== "/dossiers") return <Outlet />;
  return (
    <RequireAuth>
      <DossiersPage />
    </RequireAuth>
  );
}

const dossierSchema = z.object({
  titre: z.string().trim().min(1, "Le titre est requis").max(200),
  client_id: z.string().uuid().optional().or(z.literal("")),
  statut: z.enum(["brouillon", "confirme", "cloture"]),
  prix_vente: z.number().min(0, "Le prix doit être positif"),
  cout_total: z.number().min(0, "Le coût doit être positif"),
  taux_tva_marge: z.number().min(0, "Taux invalide").max(99, "Taux invalide"),
});

function DossiersPage() {
  const { data: dossiers, loading, refetch } = useTable<Dossier>("dossiers");
  const { data: contacts } = useTable<Contact>("contacts");
  const { agents } = useAgents();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [form, setForm] = useState({
    titre: "",
    client_id: "",
    agent_id: "",
    statut: "brouillon" as Dossier["statut"],
    prix_vente: "",
    cout_total: "",
    taux_tva_marge: "20",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = dossierSchema.safeParse({
      titre: form.titre,
      client_id: form.client_id,
      statut: form.statut,
      prix_vente: Number(form.prix_vente) || 0,
      cout_total: Number(form.cout_total) || 0,
      taux_tva_marge: Number(form.taux_tva_marge) || 0,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { data: inserted, error } = await supabase.from("dossiers").insert({
      user_id: user.id,
      agent_id: form.agent_id || user.id,
      titre: parsed.data.titre,
      client_id: parsed.data.client_id || null,
      statut: parsed.data.statut,
      prix_vente: parsed.data.prix_vente,
      cout_total: parsed.data.cout_total,
      taux_tva_marge: parsed.data.taux_tva_marge,
    }).select().single();
    setSubmitting(false);
    if (error) return toast.error(error.message);
    await logAudit({
      userId: user.id,
      entity: "dossier",
      action: "create",
      entityId: inserted?.id,
      description: `Dossier créé : ${parsed.data.titre} (${parsed.data.prix_vente} €)`,
      newValue: inserted,
    });
    toast.success("Dossier créé");
    setOpen(false);
    setForm({ titre: "", client_id: "", agent_id: "", statut: "brouillon", prix_vente: "", cout_total: "", taux_tva_marge: "20" });
    refetch();
  };

  const clientList = contacts.filter((c) => c.type === "client");
  const clientName = (id: string | null) => contacts.find((c) => c.id === id)?.nom ?? "—";

  const NewDossierButton = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau dossier
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Nouveau dossier</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Titre du voyage</Label>
            <Input
              required
              value={form.titre}
              onChange={(e) => setForm({ ...form, titre: e.target.value })}
              placeholder="Ex. Safari Tanzanie · Dupont"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {clientList.length === 0 && (
                    <div className="px-2 py-2 text-sm text-muted-foreground">Aucun client. Ajoutez-en un.</div>
                  )}
                  {clientList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={form.statut} onValueChange={(v: Dossier["statut"]) => setForm({ ...form, statut: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="brouillon">Brouillon</SelectItem>
                  <SelectItem value="confirme">Confirmé</SelectItem>
                  <SelectItem value="cloture">Clôturé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Prix de vente (€)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.prix_vente}
                onChange={(e) => setForm({ ...form, prix_vente: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Coût total (€)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.cout_total}
                onChange={(e) => setForm({ ...form, cout_total: e.target.value })}
                placeholder="0,00"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Taux de TVA sur marge (%)</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="99"
              value={form.taux_tva_marge}
              onChange={(e) => setForm({ ...form, taux_tva_marge: e.target.value })}
              placeholder="20"
            />
            <p className="text-[11px] text-muted-foreground">
              Régime spécifique des agences de voyages. 20 % par défaut.
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Enregistrement…" : "Enregistrer le dossier"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dossiers"
        description="Voyages vendus, coûts et marges"
        action={NewDossierButton}
      />

      <Card className="border-border/60 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : dossiers.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="Aucun dossier"
            description="Créez votre premier dossier de voyage pour suivre sa rentabilité."
            action={NewDossierButton}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                <TableHead>Dossier</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Prix de vente</TableHead>
                <TableHead className="text-right">Coût</TableHead>
                <TableHead className="text-right">Marge</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {dossiers.map((d) => {
                const prix = Number(d.prix_vente);
                const cout = Number(d.cout_total);
                const marge = prix - cout;
                const margePct = prix > 0 ? (marge / prix) * 100 : 0;
                return (
                  <TableRow key={d.id} className="cursor-pointer group">
                    <TableCell className="font-medium">
                      <Link to="/dossiers/$id" params={{ id: d.id }} className="hover:text-[color:var(--gold)] transition-colors">
                        {d.titre}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{clientName(d.client_id)}</TableCell>
                    <TableCell><StatutBadge statut={d.statut} /></TableCell>
                    <TableCell className="text-right tabular">{formatEUR(prix)}</TableCell>
                    <TableCell className="text-right tabular text-muted-foreground">{formatEUR(cout)}</TableCell>
                    <TableCell className="text-right tabular">
                      <div className={marge >= 0 ? "text-[color:var(--margin)] font-medium" : "text-destructive font-medium"}>
                        {formatEUR(marge)}
                      </div>
                      {prix > 0 && (
                        <div className="text-[11px] text-muted-foreground">{margePct.toFixed(1)}%</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link to="/dossiers/$id" params={{ id: d.id }} className="text-muted-foreground group-hover:text-foreground">
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </TableCell>
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

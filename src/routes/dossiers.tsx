import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTable, type Contact, type Dossier } from "@/hooks/use-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatEUR } from "@/lib/format";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dossiers")({
  component: () => (
    <RequireAuth>
      <DossiersPage />
    </RequireAuth>
  ),
});

const statutLabel = { brouillon: "Brouillon", confirme: "Confirmé", cloture: "Clôturé" } as const;
const statutVariant = { brouillon: "secondary", confirme: "default", cloture: "outline" } as const;

function DossiersPage() {
  const { data: dossiers, loading, refetch } = useTable<Dossier>("dossiers");
  const { data: clients } = useTable<Contact>("contacts");
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    titre: "",
    client_id: "",
    statut: "brouillon" as Dossier["statut"],
    prix_vente: "",
    cout_total: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("dossiers").insert({
      user_id: user.id,
      titre: form.titre,
      client_id: form.client_id || null,
      statut: form.statut,
      prix_vente: Number(form.prix_vente) || 0,
      cout_total: Number(form.cout_total) || 0,
    });
    if (error) return toast.error(error.message);
    toast.success("Dossier créé");
    setOpen(false);
    setForm({ titre: "", client_id: "", statut: "brouillon", prix_vente: "", cout_total: "" });
    refetch();
  };

  const clientList = clients.filter((c) => c.type === "client");
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.nom ?? "—";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dossiers</h1>
          <p className="text-sm text-muted-foreground mt-1">Voyages vendus et leur rentabilité</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nouveau dossier</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouveau dossier</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Titre du voyage</Label>
                <Input required value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                  <SelectContent>
                    {clientList.length === 0 && <div className="px-2 py-1 text-sm text-muted-foreground">Aucun client</div>}
                    {clientList.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Prix de vente (€)</Label>
                  <Input type="number" step="0.01" value={form.prix_vente} onChange={(e) => setForm({ ...form, prix_vente: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Coût total (€)</Label>
                  <Input type="number" step="0.01" value={form.cout_total} onChange={(e) => setForm({ ...form, cout_total: e.target.value })} />
                </div>
              </div>
              <Button type="submit" className="w-full">Enregistrer</Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titre</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Prix de vente</TableHead>
              <TableHead className="text-right">Coût</TableHead>
              <TableHead className="text-right">Marge</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Chargement…</TableCell></TableRow>
            ) : dossiers.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun dossier pour le moment.</TableCell></TableRow>
            ) : (
              dossiers.map((d) => {
                const marge = Number(d.prix_vente) - Number(d.cout_total);
                return (
                  <TableRow key={d.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link to="/dossiers/$id" params={{ id: d.id }} className="hover:underline">{d.titre}</Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{clientName(d.client_id)}</TableCell>
                    <TableCell>
                      <Badge variant={statutVariant[d.statut]}>{statutLabel[d.statut]}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular">{formatEUR(d.prix_vente)}</TableCell>
                    <TableCell className="text-right tabular text-muted-foreground">{formatEUR(d.cout_total)}</TableCell>
                    <TableCell className={`text-right tabular font-medium ${marge >= 0 ? "text-[color:var(--margin)]" : "text-destructive"}`}>
                      {formatEUR(marge)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
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
import { useTable, type Contact, type Dossier, type Paiement } from "@/hooks/use-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatEUR, formatDate } from "@/lib/format";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/paiements")({
  component: () => (
    <RequireAuth>
      <PaiementsPage />
    </RequireAuth>
  ),
});

function PaiementsPage() {
  const { data: paiements, loading, refetch } = useTable<Paiement>("paiements");
  const { data: dossiers } = useTable<Dossier>("dossiers");
  const { data: contacts } = useTable<Contact>("contacts");
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    type: "paiement_client" as Paiement["type"],
    montant: "",
    date: today,
    methode: "virement" as Paiement["methode"],
    source: "manuel" as Paiement["source"],
    dossier_id: "",
    personne_id: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const montant = Number(form.montant);
    if (!montant || montant <= 0) return toast.error("Montant invalide");
    const { error } = await supabase.from("paiements").insert({
      user_id: user.id,
      type: form.type,
      montant,
      date: form.date,
      methode: form.methode,
      source: form.source,
      dossier_id: form.dossier_id || null,
      personne_id: form.personne_id || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Paiement enregistré");
    setOpen(false);
    setForm({ ...form, montant: "", dossier_id: "", personne_id: "" });
    refetch();
  };

  const personnesFiltrees = contacts.filter((c) =>
    form.type === "paiement_client" ? c.type === "client" : c.type === "fournisseur",
  );
  const dossierTitre = (id: string | null) => dossiers.find((d) => d.id === id)?.titre ?? "—";
  const personneNom = (id: string | null) => contacts.find((c) => c.id === id)?.nom ?? "—";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Paiements</h1>
          <p className="text-sm text-muted-foreground mt-1">Tous les flux financiers entrants et sortants</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nouveau paiement</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouveau paiement</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Type de flux</Label>
                <Select value={form.type} onValueChange={(v: Paiement["type"]) => setForm({ ...form, type: v, personne_id: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paiement_client">Encaissement client</SelectItem>
                    <SelectItem value="paiement_fournisseur">Paiement fournisseur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Montant (€)</Label>
                  <Input type="number" step="0.01" required value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
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
                      <SelectItem value="manuel">Manuel</SelectItem>
                      <SelectItem value="banque">Banque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Personne ({form.type === "paiement_client" ? "client" : "fournisseur"})</Label>
                <Select value={form.personne_id} onValueChange={(v) => setForm({ ...form, personne_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Optionnel" /></SelectTrigger>
                  <SelectContent>
                    {personnesFiltrees.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Dossier rattaché</Label>
                <Select value={form.dossier_id} onValueChange={(v) => setForm({ ...form, dossier_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Optionnel" /></SelectTrigger>
                  <SelectContent>
                    {dossiers.map((d) => <SelectItem key={d.id} value={d.id}>{d.titre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">Enregistrer le paiement</Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Personne</TableHead>
              <TableHead>Dossier</TableHead>
              <TableHead>Méthode</TableHead>
              <TableHead className="text-right">Montant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Chargement…</TableCell></TableRow>
            ) : paiements.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun paiement enregistré.</TableCell></TableRow>
            ) : (
              paiements.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDate(p.date)}</TableCell>
                  <TableCell>
                    <Badge variant={p.type === "paiement_client" ? "default" : "secondary"}>
                      {p.type === "paiement_client" ? "Encaissement" : "Décaissement"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{personneNom(p.personne_id)}</TableCell>
                  <TableCell className="text-muted-foreground">{dossierTitre(p.dossier_id)}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{p.methode}</TableCell>
                  <TableCell className={`text-right tabular font-medium ${p.type === "paiement_client" ? "text-[color:var(--revenue)]" : "text-[color:var(--cost)]"}`}>
                    {p.type === "paiement_client" ? "+" : "−"}{formatEUR(p.montant)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

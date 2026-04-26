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
import { useTable, type Contact } from "@/hooks/use-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Mail, Phone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/contacts")({
  component: () => (
    <RequireAuth>
      <ContactsPage />
    </RequireAuth>
  ),
});

function ContactsPage() {
  const { data, loading, refetch } = useTable<Contact>("contacts");
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "client" | "fournisseur">("all");
  const [form, setForm] = useState({ nom: "", type: "client" as Contact["type"], email: "", telephone: "" });

  const filtered = data.filter((c) => filter === "all" || c.type === filter);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("contacts").insert({
      user_id: user.id,
      nom: form.nom,
      type: form.type,
      email: form.email || null,
      telephone: form.telephone || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Contact créé");
    setOpen(false);
    setForm({ nom: "", type: "client", email: "", telephone: "" });
    refetch();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Clients & Fournisseurs</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestion de vos partenaires</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nouveau contact</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouveau contact</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v: Contact["type"]) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="fournisseur">Fournisseur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
              </div>
              <Button type="submit" className="w-full">Enregistrer</Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex gap-2">
        {(["all", "client", "fournisseur"] as const).map((t) => (
          <Button key={t} variant={filter === t ? "default" : "outline"} size="sm" onClick={() => setFilter(t)}>
            {t === "all" ? "Tous" : t === "client" ? "Clients" : "Fournisseurs"}
          </Button>
        ))}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Téléphone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Chargement…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucun contact pour le moment.</TableCell></TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nom}</TableCell>
                  <TableCell>
                    <Badge variant={c.type === "client" ? "default" : "secondary"}>
                      {c.type === "client" ? "Client" : "Fournisseur"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.email && <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{c.email}</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.telephone && <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{c.telephone}</span>}
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

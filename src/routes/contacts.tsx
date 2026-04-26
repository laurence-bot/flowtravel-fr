import { createFileRoute, Link } from "@tanstack/react-router";
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
import { useTable, type Contact } from "@/hooks/use-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Plus, Mail, Phone, Users, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/contacts")({
  component: () => (
    <RequireAuth>
      <ContactsPage />
    </RequireAuth>
  ),
});

const contactSchema = z.object({
  nom: z.string().trim().min(1, "Le nom est requis").max(120),
  type: z.enum(["client", "fournisseur"]),
  email: z.string().trim().email("Email invalide").max(255).optional().or(z.literal("")),
  telephone: z.string().trim().max(40).optional().or(z.literal("")),
});

function ContactsPage() {
  const { data, loading, refetch } = useTable<Contact>("contacts");
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "client" | "fournisseur">("all");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ nom: "", type: "client" as Contact["type"], email: "", telephone: "" });

  const filtered = data.filter((c) => filter === "all" || c.type === filter);
  const clientsCount = data.filter((c) => c.type === "client").length;
  const fournisseursCount = data.filter((c) => c.type === "fournisseur").length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { data: inserted, error } = await supabase.from("contacts").insert({
      user_id: user.id,
      nom: parsed.data.nom,
      type: parsed.data.type,
      email: parsed.data.email || null,
      telephone: parsed.data.telephone || null,
    }).select().single();
    setSubmitting(false);
    if (error) return toast.error(error.message);
    // Pas dans la liste audit officielle mais on trace la création de contact via "dossier" non — on ignore: pas demandé
    void inserted;
    toast.success("Contact créé");
    setOpen(false);
    setForm({ nom: "", type: "client", email: "", telephone: "" });
    refetch();
  };

  const NewContactButton = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau contact
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Nouveau contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nom</Label>
            <Input required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Nom du client ou fournisseur" />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="optionnel" />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="optionnel" />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Clients & Fournisseurs"
        description={`${clientsCount} client${clientsCount > 1 ? "s" : ""} · ${fournisseursCount} fournisseur${fournisseursCount > 1 ? "s" : ""}`}
        action={NewContactButton}
      />

      <div className="flex gap-2">
        {(["all", "client", "fournisseur"] as const).map((t) => (
          <Button
            key={t}
            variant={filter === t ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(t)}
          >
            {t === "all" ? `Tous (${data.length})` : t === "client" ? `Clients (${clientsCount})` : `Fournisseurs (${fournisseursCount})`}
          </Button>
        ))}
      </div>

      <Card className="border-border/60 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={data.length === 0 ? "Aucun contact" : "Aucun résultat"}
            description={
              data.length === 0
                ? "Ajoutez un client ou un fournisseur pour commencer."
                : "Modifiez le filtre pour voir d'autres contacts."
            }
            action={data.length === 0 ? NewContactButton : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                <TableHead>Nom</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-secondary/40">
                  <TableCell className="font-medium">
                    <Link to="/contacts/$id" params={{ id: c.id }} className="hover:underline">
                      {c.nom}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.type === "client" ? "default" : "secondary"}>
                      {c.type === "client" ? "Client" : "Fournisseur"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.email ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {c.email}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.telephone ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        {c.telephone}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Link to="/contacts/$id" params={{ id: c.id }} className="text-muted-foreground hover:text-foreground inline-flex">
                      <ArrowRight className="h-4 w-4" />
                    </Link>
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

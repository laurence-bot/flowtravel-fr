import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTable, type Contact } from "@/hooks/use-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePageWriteAccess } from "@/hooks/use-page-write-access";
import { formatEUR } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { logAudit } from "@/lib/audit";
import {
  COTATION_STATUT_LABELS,
  COTATION_STATUT_TONES,
  computeCotationFinance,
  type Cotation,
  type CotationLigne,
  type CotationStatut,
} from "@/lib/cotations";
import { FileText, Plus, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/cotations")({
  component: () => (
    <RequireAuth>
      <CotationsPage />
    </RequireAuth>
  ),
});

const newSchema = z.object({
  titre: z.string().trim().min(1, "Titre requis").max(200),
  client_id: z.string().uuid().optional().or(z.literal("")),
  destination: z.string().trim().max(200).optional().or(z.literal("")),
  nombre_pax: z.number().min(1).max(999),
});

const TONE_CLASS: Record<string, string> = {
  neutral: "bg-secondary text-muted-foreground border-border",
  info: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  primary: "bg-primary/15 text-primary border-primary/30",
  muted: "bg-muted text-muted-foreground border-border",
};

function StatutPill({ statut }: { statut: CotationStatut }) {
  const tone = COTATION_STATUT_TONES[statut];
  return (
    <Badge variant="outline" className={TONE_CLASS[tone]}>
      {COTATION_STATUT_LABELS[statut]}
    </Badge>
  );
}

function CotationsPage() {
  const { user } = useAuth();
  const { canWrite } = usePageWriteAccess();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cotations, loading, refetch } = useTable<Cotation>("cotations" as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lignes } = useTable<CotationLigne>("cotation_lignes_fournisseurs" as any);
  const { data: contacts } = useTable<Contact>("contacts");

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    titre: "",
    client_id: "",
    destination: "",
    nombre_pax: "1",
  });

  const [filtreStatut, setFiltreStatut] = useState<string>("tous");
  const [filtreClient, setFiltreClient] = useState<string>("tous");
  const [filtreDest, setFiltreDest] = useState<string>("");
  const [filtreDu, setFiltreDu] = useState<string>("");
  const [filtreAu, setFiltreAu] = useState<string>("");

  const clients = contacts.filter((c) => c.type === "client");

  // garde uniquement la dernière version par group_id
  const lastByGroup = useMemo(() => {
    const map = new Map<string, Cotation>();
    for (const c of cotations) {
      const cur = map.get(c.group_id);
      if (!cur || c.version_number > cur.version_number) map.set(c.group_id, c);
    }
    return Array.from(map.values());
  }, [cotations]);

  const filtered = lastByGroup.filter((c) => {
    if (filtreStatut !== "tous" && c.statut !== filtreStatut) return false;
    if (filtreClient !== "tous" && c.client_id !== filtreClient) return false;
    if (
      filtreDest.trim() &&
      !(c.destination ?? "").toLowerCase().includes(filtreDest.toLowerCase())
    )
      return false;
    if (filtreDu && (!c.date_depart || c.date_depart < filtreDu)) return false;
    if (filtreAu && (!c.date_depart || c.date_depart > filtreAu)) return false;
    return true;
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = newSchema.safeParse({
      titre: form.titre,
      client_id: form.client_id,
      destination: form.destination,
      nombre_pax: Number(form.nombre_pax) || 1,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error } = await (supabase as any)
      .from("cotations")
      .insert({
        user_id: user.id,
        titre: parsed.data.titre,
        client_id: parsed.data.client_id || null,
        destination: parsed.data.destination || null,
        nombre_pax: parsed.data.nombre_pax,
        statut: "brouillon",
      })
      .select()
      .single();
    setSubmitting(false);
    if (error || !created) {
      toast.error(error?.message ?? "Création impossible.");
      return;
    }
    await logAudit({
      userId: user.id,
      entity: "cotation",
      entityId: created.id,
      action: "create",
      description: `Cotation créée : ${parsed.data.titre}`,
    });
    setOpen(false);
    setForm({ titre: "", client_id: "", destination: "", nombre_pax: "1" });
    toast.success("Cotation créée.");
    refetch();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cotations"
        description="Devis commerciaux : du prospect à la cotation validée."
        action={
          canWrite && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" /> Nouvelle cotation
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nouvelle cotation</DialogTitle>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-4">
                  <div>
                    <Label>Titre *</Label>
                    <Input
                      value={form.titre}
                      onChange={(e) => setForm({ ...form, titre: e.target.value })}
                      placeholder="Voyage de noces – Bali"
                      required
                    />
                  </div>
                  <div>
                    <Label>Client</Label>
                    <Select
                      value={form.client_id}
                      onValueChange={(v) => setForm({ ...form, client_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Destination</Label>
                      <Input
                        value={form.destination}
                        onChange={(e) =>
                          setForm({ ...form, destination: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Nombre de pax</Label>
                      <Input
                        type="number"
                        min={1}
                        value={form.nombre_pax}
                        onChange={(e) =>
                          setForm({ ...form, nombre_pax: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={submitting} className="w-full">
                    {submitting ? "Création…" : "Créer"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />

      <Card className="p-4 grid md:grid-cols-5 gap-3">
        <div>
          <Label className="text-xs">Statut</Label>
          <Select value={filtreStatut} onValueChange={setFiltreStatut}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous</SelectItem>
              {(Object.keys(COTATION_STATUT_LABELS) as CotationStatut[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {COTATION_STATUT_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Client</Label>
          <Select value={filtreClient} onValueChange={setFiltreClient}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Destination</Label>
          <Input
            placeholder="Filtrer…"
            value={filtreDest}
            onChange={(e) => setFiltreDest(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Départ du</Label>
          <Input type="date" value={filtreDu} onChange={(e) => setFiltreDu(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Départ au</Label>
          <Input type="date" value={filtreAu} onChange={(e) => setFiltreAu(e.target.value)} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-10 text-sm text-muted-foreground text-center">Chargement…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Aucune cotation"
            description="Créez votre première cotation pour démarrer."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Titre</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead className="text-right">Prix vente</TableHead>
                <TableHead className="text-right">Coût</TableHead>
                <TableHead className="text-right">Marge brute</TableHead>
                <TableHead className="text-right">Marge nette</TableHead>
                <TableHead className="text-right">% marge</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>v.</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const fin = computeCotationFinance(c, lignes);
                const client = contacts.find((x) => x.id === c.client_id);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{client?.nom ?? "—"}</TableCell>
                    <TableCell className="font-medium">{c.titre}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.destination ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.date_depart ? `${c.date_depart}${c.date_retour ? ` → ${c.date_retour}` : ""}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {formatEUR(fin.prixVente)}
                    </TableCell>
                    <TableCell className="text-right tabular text-[color:var(--cost)]">
                      {formatEUR(fin.coutTotal)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular ${fin.margeBrute >= 0 ? "" : "text-destructive"}`}
                    >
                      {formatEUR(fin.margeBrute)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular ${fin.margeNette >= 0 ? "text-[color:var(--margin)]" : "text-destructive"}`}
                    >
                      {formatEUR(fin.margeNette)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular text-xs ${fin.margeNettePct < 0 ? "text-destructive" : fin.margeNettePct < 10 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}
                    >
                      {fin.margeNettePct.toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      <StatutPill statut={c.statut} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      v{c.version_number}
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/cotations/$id" params={{ id: c.id }}>
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
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

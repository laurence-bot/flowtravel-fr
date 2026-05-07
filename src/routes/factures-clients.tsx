import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatEUR, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { AlertTriangle, Receipt, ExternalLink } from "lucide-react";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";

export const Route = createFileRoute("/factures-clients")({
  component: () => (
    <RequireAuth>
      <FacturesClientsPage />
    </RequireAuth>
  ),
});

type FactureClient = {
  id: string;
  numero: string;
  client_id: string | null;
  cotation_id: string | null;
  dossier_id: string | null;
  date_emission: string;
  date_echeance: string | null;
  montant_ht: number;
  montant_ttc: number;
  montant_tva: number;
  statut: "brouillon" | "emise" | "payee" | "annulee";
  type_facture: "acompte_1" | "acompte_2" | "solde" | "globale";
};

const TYPE_LABEL: Record<string, string> = {
  acompte_1: "Acompte 1",
  acompte_2: "Acompte 2",
  solde: "Solde",
  globale: "Globale",
};

const STATUT_LABELS: Record<FactureClient["statut"], string> = {
  brouillon: "Brouillon",
  emise: "Émise",
  payee: "Payée",
  annulee: "Annulée",
};

const STATUT_COLORS: Record<FactureClient["statut"], string> = {
  brouillon: "bg-zinc-100 text-zinc-600",
  emise: "bg-blue-100 text-blue-700",
  payee: "bg-emerald-100 text-emerald-700",
  annulee: "bg-red-100 text-red-600",
};

function FacturesClientsPage() {
  const { user } = useAuth();
  const [list, setList] = useState<FactureClient[]>([]);
  const [contacts, setContacts] = useState<Array<{ id: string; nom: string }>>([]);
  const [filterStatut, setFilterStatut] = useState<string>("tous");
  const [filterDossier, setFilterDossier] = useState<string>("");

  const refetch = async () => {
    const { data } = await supabase.from("factures_clients").select("*").order("date_emission", { ascending: false });
    setList((data ?? []) as FactureClient[]);
  };

  useEffect(() => {
    refetch();
    supabase
      .from("contacts")
      .select("id,nom")
      .then(({ data }) => setContacts(data ?? []));
  }, []);

  const setStatut = async (id: string, statut: FactureClient["statut"], current: FactureClient["statut"]) => {
    // Confirmation pour les actions irréversibles
    if (statut === "annulee" && !confirm("Annuler cette facture ? Cette action ne peut pas être annulée.")) return;
    if (statut === "payee" && current !== "payee" && !confirm("Marquer cette facture comme payée ?")) return;
    const { error } = await supabase.from("factures_clients").update({ statut }).eq("id", id);
    if (error) return toast.error(error.message);
    await logAudit({
      userId: user?.id,
      entity: "dossier",
      entityId: id,
      action: "update",
      description: `Facture client — statut : ${STATUT_LABELS[current]} → ${STATUT_LABELS[statut]}`,
    });
    toast.success(`Facture ${STATUT_LABELS[statut].toLowerCase()}`);
    refetch();
  };

  const today = new Date().toISOString().slice(0, 10);
  const filtered = list.filter((f) => {
    if (filterStatut !== "tous" && f.statut !== filterStatut) return false;
    if (filterDossier.trim() && !f.numero.toLowerCase().includes(filterDossier.toLowerCase())) return false;
    return true;
  });

  const totalEmises = list.filter((f) => f.statut === "emise").reduce((s, f) => s + Number(f.montant_ttc), 0);
  const totalPayees = list.filter((f) => f.statut === "payee").reduce((s, f) => s + Number(f.montant_ttc), 0);
  const impayees = list.filter((f) => f.statut === "emise" && f.date_echeance && f.date_echeance < today);
  const clientLabel = (id: string | null) => contacts.find((c) => c.id === id)?.nom ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader title="Factures clients" description="Générées automatiquement à la signature des bulletins." />

      {impayees.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="font-medium">
            {impayees.length} facture{impayees.length > 1 ? "s" : ""} en retard de paiement
          </span>
          <button onClick={() => setFilterStatut("emise")} className="underline ml-auto">
            Voir →
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Total émis</div>
          <div className="text-2xl font-semibold tabular-nums mt-1">{formatEUR(totalEmises)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Total encaissé</div>
          <div className="text-2xl font-semibold tabular-nums mt-1 text-emerald-600">{formatEUR(totalPayees)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Reste à encaisser</div>
          <div
            className={`text-2xl font-semibold tabular-nums mt-1 ${totalEmises - totalPayees > 0 ? "text-amber-600" : "text-muted-foreground"}`}
          >
            {formatEUR(totalEmises - totalPayees)}
          </div>
        </Card>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 items-center">
        {(["tous", "brouillon", "emise", "payee", "annulee"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatut(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              filterStatut === s
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {s === "tous" ? "Toutes" : STATUT_LABELS[s as FactureClient["statut"]]}
            {s !== "tous" && ` (${list.filter((f) => f.statut === s).length})`}
          </button>
        ))}
        <input
          type="text"
          placeholder="Rechercher par n°…"
          value={filterDossier}
          onChange={(e) => setFilterDossier(e.target.value)}
          className="ml-auto h-8 px-3 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">HT</TableHead>
              <TableHead className="text-right">TVA</TableHead>
              <TableHead className="text-right">TTC</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  {list.length === 0 ? "Aucune facture pour l'instant" : "Aucune facture pour ce filtre"}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((f) => {
              const enRetard = f.statut === "emise" && f.date_echeance && f.date_echeance < today;
              return (
                <TableRow
                  key={f.id}
                  className={`hover:bg-muted/30 ${enRetard ? "bg-red-50/50 dark:bg-red-950/10" : ""}`}
                >
                  <TableCell className="font-mono text-sm">
                    <Link
                      to="/factures-clients/$id"
                      params={{ id: f.id }}
                      className="hover:underline inline-flex items-center gap-1"
                    >
                      {f.numero} <ExternalLink className="h-3 w-3 opacity-40" />
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{TYPE_LABEL[f.type_facture] ?? f.type_facture}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(f.date_emission)}</TableCell>
                  <TableCell>
                    {clientLabel(f.client_id)}
                    {enRetard && (
                      <div className="text-xs text-red-600 mt-0.5">
                        Échéance dépassée · {formatDate(f.date_echeance!)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatEUR(f.montant_ht)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatEUR(f.montant_tva)}</TableCell>
                  <TableCell className="text-right font-medium">{formatEUR(f.montant_ttc)}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_COLORS[f.statut]}`}>
                      {STATUT_LABELS[f.statut]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={f.statut}
                      onValueChange={(v) => setStatut(f.id, v as FactureClient["statut"], f.statut)}
                    >
                      <SelectTrigger className="w-28 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="brouillon">Brouillon</SelectItem>
                        <SelectItem value="emise">Émise</SelectItem>
                        <SelectItem value="payee">Payée</SelectItem>
                        <SelectItem value="annulee">Annulée</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

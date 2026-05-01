import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatEUR, formatDate } from "@/lib/format";
import { Receipt } from "lucide-react";
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
};

function FacturesClientsPage() {
  const [list, setList] = useState<FactureClient[]>([]);
  const [contacts, setContacts] = useState<Array<{ id: string; nom: string }>>([]);

  const refetch = async () => {
    const { data } = await supabase.from("factures_clients").select("*").order("date_emission", { ascending: false });
    setList((data ?? []) as FactureClient[]);
  };

  useEffect(() => {
    refetch();
    supabase.from("contacts").select("id,nom").then(({ data }) => setContacts(data ?? []));
  }, []);

  const setStatut = async (id: string, statut: FactureClient["statut"]) => {
    const { error } = await supabase.from("factures_clients").update({ statut }).eq("id", id);
    if (error) return toast.error(error.message);
    refetch();
  };

  const totalEmises = list.filter((f) => f.statut === "emise").reduce((s, f) => s + Number(f.montant_ttc), 0);
  const totalPayees = list.filter((f) => f.statut === "payee").reduce((s, f) => s + Number(f.montant_ttc), 0);
  const clientLabel = (id: string | null) => contacts.find((c) => c.id === id)?.nom ?? "—";

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-serif">Factures clients</h1>
        <p className="text-sm text-muted-foreground">Générées automatiquement à la signature des bulletins.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4"><div className="text-xs uppercase text-muted-foreground">Total émis</div><div className="text-2xl font-serif">{formatEUR(totalEmises)}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase text-muted-foreground">Total encaissé</div><div className="text-2xl font-serif text-emerald-700">{formatEUR(totalPayees)}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase text-muted-foreground">Nombre de factures</div><div className="text-2xl font-serif">{list.length}</div></Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">HT</TableHead>
              <TableHead className="text-right">TVA</TableHead>
              <TableHead className="text-right">TTC</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                <Receipt className="w-8 h-8 mx-auto mb-2 opacity-50" />Aucune facture pour l'instant
              </TableCell></TableRow>
            )}
            {list.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-mono text-sm">{f.numero}</TableCell>
                <TableCell>{formatDate(f.date_emission)}</TableCell>
                <TableCell>{clientLabel(f.client_id)}</TableCell>
                <TableCell className="text-right">{formatEUR(f.montant_ht)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatEUR(f.montant_tva)}</TableCell>
                <TableCell className="text-right font-medium">{formatEUR(f.montant_ttc)}</TableCell>
                <TableCell>
                  <Select value={f.statut} onValueChange={(v) => setStatut(f.id, v as FactureClient["statut"])}>
                    <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brouillon">Brouillon</SelectItem>
                      <SelectItem value="emise">Émise</SelectItem>
                      <SelectItem value="payee">Payée</SelectItem>
                      <SelectItem value="annulee">Annulée</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTable, type Contact, type Dossier, type Paiement, type Facture } from "@/hooks/use-data";
import { supabase } from "@/integrations/supabase/client";
import { formatEUR, formatDate } from "@/lib/format";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dossiers/$id")({
  component: () => (
    <RequireAuth>
      <DossierDetail />
    </RequireAuth>
  ),
});

const statutLabel = { brouillon: "Brouillon", confirme: "Confirmé", cloture: "Clôturé" } as const;

function DossierDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const { data: contacts } = useTable<Contact>("contacts");
  const { data: paiements } = useTable<Paiement>("paiements");
  const { data: factures } = useTable<Facture>("factures_fournisseurs");

  useEffect(() => {
    supabase.from("dossiers").select("*").eq("id", id).single().then(({ data }) => {
      setDossier(data as Dossier | null);
    });
  }, [id]);

  if (!dossier) {
    return <div className="text-muted-foreground text-sm">Chargement du dossier…</div>;
  }

  const client = contacts.find((c) => c.id === dossier.client_id);
  const paiementsDossier = paiements.filter((p) => p.dossier_id === dossier.id);
  const facturesDossier = factures.filter((f) => f.dossier_id === dossier.id);

  const encaisse = paiementsDossier.filter((p) => p.type === "paiement_client").reduce((s, p) => s + Number(p.montant), 0);
  const decaisse = paiementsDossier.filter((p) => p.type === "paiement_fournisseur").reduce((s, p) => s + Number(p.montant), 0);
  const marge = Number(dossier.prix_vente) - Number(dossier.cout_total);
  const reste = Number(dossier.prix_vente) - encaisse;

  const supprimer = async () => {
    if (!confirm("Supprimer ce dossier ?")) return;
    const { error } = await supabase.from("dossiers").delete().eq("id", dossier.id);
    if (error) return toast.error(error.message);
    toast.success("Dossier supprimé");
    navigate({ to: "/dossiers" });
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/dossiers" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft className="h-4 w-4" />Retour aux dossiers
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{dossier.titre}</h1>
            <Badge variant="secondary">{statutLabel[dossier.statut]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Client : {client?.nom ?? "—"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={supprimer}>
          <Trash2 className="h-4 w-4 mr-2" />Supprimer
        </Button>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Prix de vente</div>
          <div className="mt-1 text-xl font-semibold tabular">{formatEUR(dossier.prix_vente)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Coût total</div>
          <div className="mt-1 text-xl font-semibold tabular text-[color:var(--cost)]">{formatEUR(dossier.cout_total)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Marge</div>
          <div className={`mt-1 text-xl font-semibold tabular ${marge >= 0 ? "text-[color:var(--margin)]" : "text-destructive"}`}>{formatEUR(marge)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Reste à encaisser</div>
          <div className="mt-1 text-xl font-semibold tabular">{formatEUR(reste)}</div>
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="font-semibold">Résumé financier</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between border-b py-2">
              <dt className="text-muted-foreground">Total encaissé client</dt>
              <dd className="tabular text-[color:var(--revenue)] font-medium">{formatEUR(encaisse)}</dd>
            </div>
            <div className="flex justify-between border-b py-2">
              <dt className="text-muted-foreground">Total payé fournisseurs</dt>
              <dd className="tabular text-[color:var(--cost)] font-medium">−{formatEUR(decaisse)}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="font-medium">Solde de trésorerie du dossier</dt>
              <dd className="tabular font-semibold">{formatEUR(encaisse - decaisse)}</dd>
            </div>
          </dl>
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold">Factures fournisseurs</h2>
          {facturesDossier.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-3">Aucune facture liée.</p>
          ) : (
            <ul className="mt-3 divide-y">
              {facturesDossier.map((f) => {
                const fournisseur = contacts.find((c) => c.id === f.fournisseur_id);
                return (
                  <li key={f.id} className="py-2 flex justify-between text-sm">
                    <div>
                      <div className="font-medium">{fournisseur?.nom ?? "Fournisseur"}</div>
                      <div className="text-xs text-muted-foreground">Échéance : {formatDate(f.date_echeance)}</div>
                    </div>
                    <div className="text-right">
                      <div className="tabular font-medium">{formatEUR(f.montant)}</div>
                      <Badge variant={f.paye ? "default" : "outline"} className="mt-1">{f.paye ? "Payée" : "À payer"}</Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      <Card>
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold">Paiements liés</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Méthode</TableHead>
              <TableHead className="text-right">Montant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paiementsDossier.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Aucun paiement.</TableCell></TableRow>
            ) : (
              paiementsDossier.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDate(p.date)}</TableCell>
                  <TableCell>
                    <Badge variant={p.type === "paiement_client" ? "default" : "secondary"}>
                      {p.type === "paiement_client" ? "Encaissement client" : "Paiement fournisseur"}
                    </Badge>
                  </TableCell>
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

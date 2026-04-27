import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  useTable, type Contact, type Dossier, type Facture,
} from "@/hooks/use-data";
import { formatEUR, formatDate } from "@/lib/format";
import { formatMoney, FX_SOURCE_LABELS } from "@/lib/fx";
import { factureEUR } from "@/lib/finance";
import { EcheancesEditor } from "@/components/echeances-editor";
import { ArrowLeft, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/factures/$id")({
  component: () => (
    <RequireAuth>
      <FactureDetail />
    </RequireAuth>
  ),
});

function FactureDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [facture, setFacture] = useState<Facture | null>(null);
  const [notFound, setNotFound] = useState(false);
  const { data: contacts } = useTable<Contact>("contacts");
  const { data: dossiers } = useTable<Dossier>("dossiers");

  useEffect(() => {
    supabase.from("factures_fournisseurs").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      if (!data) setNotFound(true);
      else setFacture(data as Facture);
    });
  }, [id]);

  if (notFound) {
    return (
      <div className="text-center py-20">
        <h2 className="font-display text-2xl">Facture introuvable</h2>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/dossiers">Retour</Link>
        </Button>
      </div>
    );
  }
  if (!facture) return <div className="text-muted-foreground text-sm">Chargement…</div>;

  const fournisseur = contacts.find((c) => c.id === facture.fournisseur_id);
  const dossier = dossiers.find((d) => d.id === facture.dossier_id);

  const supprimer = async () => {
    if (!confirm("Supprimer cette facture et ses échéances ?")) return;
    const { error } = await supabase.from("factures_fournisseurs").delete().eq("id", facture.id);
    if (error) return toast.error(error.message);
    await logAudit({
      userId: user?.id,
      entity: "facture_fournisseur",
      entityId: facture.id,
      action: "delete",
      description: `Facture supprimée`,
      oldValue: facture,
    });
    toast.success("Facture supprimée");
    if (dossier) navigate({ to: "/dossiers/$id", params: { id: dossier.id } });
    else navigate({ to: "/dossiers" });
  };

  return (
    <div className="space-y-8">
      {dossier ? (
        <Link
          to="/dossiers/$id"
          params={{ id: dossier.id }}
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au dossier
        </Link>
      ) : (
        <Link to="/dossiers" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
      )}

      <header className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-3xl md:text-4xl text-foreground inline-flex items-center gap-3">
              <FileText className="h-7 w-7 text-muted-foreground" />
              Facture {fournisseur?.nom ?? "fournisseur"}
            </h1>
            <Badge variant={facture.paye ? "default" : "outline"}>
              {facture.paye ? "Payée" : "À payer"}
            </Badge>
          </div>
          {dossier && (
            <p className="text-sm text-muted-foreground mt-2">
              Dossier : <Link to="/dossiers/$id" params={{ id: dossier.id }} className="hover:text-foreground underline-offset-4 hover:underline">{dossier.titre}</Link>
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={supprimer}>
          <Trash2 className="h-4 w-4 mr-2" />
          Supprimer
        </Button>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Montant en devise" value={formatMoney(facture.montant_devise ?? 0, facture.devise)} />
        <KPI label="Taux appliqué" value={Number(facture.taux_change).toFixed(4)} hint={FX_SOURCE_LABELS[facture.fx_source]} />
        <KPI label="Équivalent EUR" value={formatEUR(factureEUR(facture))} />
        <KPI label="Échéance globale" value={facture.date_echeance ? formatDate(facture.date_echeance) : "—"} />
      </section>

      <Card className="p-6 border-border/60">
        <EcheancesEditor facture={facture} />
      </Card>
    </div>
  );
}

function KPI({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-5 border-border/60">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

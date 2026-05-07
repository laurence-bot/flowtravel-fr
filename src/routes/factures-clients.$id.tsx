import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatEUR, formatDate } from "@/lib/format";
import { ArrowLeft, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/factures-clients/$id")({
  component: () => (
    <RequireAuth>
      <FactureClientDetail />
    </RequireAuth>
  ),
});

// Labels longs pour l'impression — distincts des labels courts de la liste
const TYPE_LABEL: Record<string, string> = {
  acompte_1: "Facture d'acompte n°1",
  acompte_2: "Facture d'acompte n°2",
  solde: "Facture de solde",
  globale: "Facture",
};

function FactureClientDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [facture, setFacture] = useState<any | null>(null);
  const [client, setClient] = useState<any | null>(null);
  const [cotation, setCotation] = useState<any | null>(null);
  const [agency, setAgency] = useState<any | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("factures_clients").select("*").eq("id", id).maybeSingle();
      if (!data) return setNotFound(true);
      setFacture(data);
      const [c, co, ag] = await Promise.all([
        data.client_id
          ? supabase.from("contacts").select("*").eq("id", data.client_id).maybeSingle()
          : Promise.resolve({ data: null }),
        data.cotation_id
          ? supabase.from("cotations").select("*").eq("id", data.cotation_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("agency_settings").select("*").eq("user_id", data.user_id).maybeSingle(),
      ]);
      setClient(c.data);
      setCotation(co.data);
      setAgency(ag.data);
    })();
  }, [id]);

  if (notFound) {
    return (
      <div className="text-center py-20">
        <h2 className="font-display text-2xl">Facture introuvable</h2>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/factures-clients">Retour</Link>
        </Button>
      </div>
    );
  }
  if (!facture) return <div className="text-muted-foreground text-sm p-8">Chargement…</div>;

  const supprimer = async () => {
    if (!confirm("Supprimer cette facture ?")) return;
    const { error } = await supabase.from("factures_clients").delete().eq("id", facture.id);
    if (error) return toast.error(error.message);
    toast.success("Facture supprimée");
    navigate({ to: "/factures-clients" });
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link
          to="/factures-clients"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={supprimer}>
            <Trash2 className="h-4 w-4 mr-2" /> Supprimer
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" /> Imprimer / PDF
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-md p-10 print:bg-white print:border-0 print:p-0 print:shadow-none">
        {/* En-tête */}
        <div className="flex justify-between items-start mb-10">
          <div>
            {agency?.logo_url && <img src={agency.logo_url} alt="" className="h-16 mb-3 object-contain" />}
            <div className="font-medium text-lg">{agency?.legal_name || agency?.agency_name || ""}</div>
            <div className="text-xs text-muted-foreground whitespace-pre-line">
              {agency?.address}
              {agency?.address && (agency?.city || agency?.country) ? "\n" : ""}
              {[agency?.city, agency?.country].filter(Boolean).join(", ")}
              {agency?.siret ? `\nSIRET : ${agency.siret}` : ""}
              {agency?.vat_number ? `\nTVA : ${agency.vat_number}` : ""}
              {agency?.immat_atout_france ? `\nAtout France : ${agency.immat_atout_france}` : ""}
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-serif">{TYPE_LABEL[facture.type_facture] || "Facture"}</h1>
            <div className="font-mono text-sm mt-2">N° {facture.numero}</div>
            <div className="text-xs text-muted-foreground mt-1">Émise le {formatDate(facture.date_emission)}</div>
            {facture.date_echeance && (
              <div className="text-xs text-muted-foreground">Échéance : {formatDate(facture.date_echeance)}</div>
            )}
            <Badge className="mt-3" variant={facture.statut === "payee" ? "default" : "outline"}>
              {facture.statut === "brouillon"
                ? "Brouillon"
                : facture.statut === "emise"
                  ? "Émise"
                  : facture.statut === "payee"
                    ? "Payée"
                    : "Annulée"}
            </Badge>
          </div>
        </div>

        {/* Client */}
        <div className="mb-8">
          <div className="text-xs uppercase tracking-wider text-stone-500 mb-1">Facturé à</div>
          <div className="font-medium">{client?.nom || "—"}</div>
          {client?.contact_principal && <div className="text-sm">{client.contact_principal}</div>}
          <div className="text-xs text-muted-foreground whitespace-pre-line">
            {client?.adresse}
            {client?.adresse && (client?.code_postal || client?.ville) ? "\n" : ""}
            {[client?.code_postal, client?.ville].filter(Boolean).join(" ")}
            {client?.pays ? `\n${client.pays}` : ""}
          </div>
        </div>

        {/* Lignes */}
        <table className="w-full text-sm mb-8">
          <thead className="border-b border-border">
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-2">Désignation</th>
              <th className="py-2 text-right">Quote-part</th>
              <th className="py-2 text-right">HT</th>
              <th className="py-2 text-right">TVA</th>
              <th className="py-2 text-right">TTC</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/60">
              <td className="py-3">
                <div className="font-medium">{cotation?.titre || "Voyage"}</div>
                {cotation?.destination && <div className="text-xs text-muted-foreground">{cotation.destination}</div>}
                {cotation?.date_depart && (
                  <div className="text-xs text-muted-foreground">
                    Du {formatDate(cotation.date_depart)}
                    {cotation.date_retour ? ` au ${formatDate(cotation.date_retour)}` : ""}
                  </div>
                )}
              </td>
              <td className="py-3 text-right">{Number(facture.pct_applique).toFixed(0)} %</td>
              <td className="py-3 text-right">{formatEUR(Number(facture.montant_ht))}</td>
              <td className="py-3 text-right">{formatEUR(Number(facture.montant_tva))}</td>
              <td className="py-3 text-right">{formatEUR(Number(facture.montant_ttc))}</td>
            </tr>
          </tbody>
        </table>

        {/* Totaux */}
        <div className="flex justify-end mb-8">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total HT</span>
              <span>{formatEUR(Number(facture.montant_ht))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">TVA ({Number(facture.taux_tva)} %)</span>
              <span>{formatEUR(Number(facture.montant_tva))}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 font-medium text-base">
              <span>Total TTC</span>
              <span>{formatEUR(Number(facture.montant_ttc))}</span>
            </div>
            {facture.regime_tva && (
              <div className="text-xs text-muted-foreground mt-2">
                Régime TVA : {facture.regime_tva.replace("_", " ")}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {agency?.pdf_footer_text && (
          <div className="text-xs text-muted-foreground border-t pt-4 whitespace-pre-line">
            {agency.pdf_footer_text}
          </div>
        )}
      </div>

      <style>{`
        @media print {
          body { background: white; }
          @page { margin: 1.5cm; }
        }
      `}</style>
    </div>
  );
}

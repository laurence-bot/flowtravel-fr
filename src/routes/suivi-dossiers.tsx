import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, AlertTriangle, Clock, CheckCircle2, FileSignature, Wallet } from "lucide-react";
import { formatEUR } from "@/lib/format";

export const Route = createFileRoute("/suivi-dossiers")({
  component: () => (
    <RequireAuth>
      <SuiviDossiersPage />
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Suivi des dossiers" }] }),
});

interface DossierRow {
  id: string;
  titre: string;
  statut: string;
  prix_vente: number;
  client_nom: string | null;
  cotation_id: string | null;
  cotation_titre: string | null;
  link_accepted_at: string | null;
  bulletin_statut: string | null;
  bulletin_signed_at: string | null;
  factures_total: number;
  factures_payees: number;
}

interface CotationRow {
  id: string;
  titre: string;
  client_id: string | null;
  client_nom: string | null;
  link_accepted_at: string | null;
}

function SuiviDossiersPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [enAttentePaiement, setEnAttentePaiement] = useState<CotationRow[]>([]);
  const [enAttenteSignature, setEnAttenteSignature] = useState<DossierRow[]>([]);
  const [enCours, setEnCours] = useState<DossierRow[]>([]);
  const [complets, setComplets] = useState<DossierRow[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);

      // Cotations validées par client mais pas encore transformées en bulletin signé
      // → "en attente paiement / signature acompte"
      const { data: cotsRaw } = await supabase
        .from("cotations")
        .select(
          "id, titre, client_id, statut, dossier_id, contacts:client_id(nom), quote_public_links(accepted_at, expires_at)",
        )
        .eq("user_id", user.id)
        .in("statut", ["envoyee", "validee"])
        .order("updated_at", { ascending: false });

      const enAttPay: CotationRow[] = [];
      for (const c of (cotsRaw ?? []) as any[]) {
        const link = (c.quote_public_links ?? []).find((l: any) => l.accepted_at);
        // Cotation acceptée mais pas encore de bulletin signé
        if (link?.accepted_at && c.statut !== "transformee_en_dossier") {
          // vérifier qu'il n'y a pas déjà un bulletin signé
          const { data: bul } = await supabase
            .from("bulletins")
            .select("id, statut")
            .eq("cotation_id", c.id)
            .eq("statut", "signe")
            .maybeSingle();
          if (!bul) {
            enAttPay.push({
              id: c.id,
              titre: c.titre,
              client_id: c.client_id,
              client_nom: c.contacts?.nom ?? null,
              link_accepted_at: link.accepted_at,
            });
          }
        }
      }
      setEnAttentePaiement(enAttPay);

      // Dossiers : on enrichit avec bulletin + factures
      const { data: dossiers } = await supabase
        .from("dossiers")
        .select("id, titre, statut, prix_vente, client_id, contacts:client_id(nom)")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      const sig: DossierRow[] = [];
      const cours: DossierRow[] = [];
      const done: DossierRow[] = [];

      for (const d of (dossiers ?? []) as any[]) {
        const [{ data: bulletin }, { data: factures }] = await Promise.all([
          supabase
            .from("bulletins")
            .select("statut, signed_at")
            .eq("dossier_id", d.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from("factures_clients").select("id, statut").eq("dossier_id", d.id),
        ]);

        const facturesTotal = (factures ?? []).length;
        const facturesPayees = (factures ?? []).filter((f: any) => f.statut === "payee").length;

        const row: DossierRow = {
          id: d.id,
          titre: d.titre,
          statut: d.statut,
          prix_vente: Number(d.prix_vente ?? 0),
          client_nom: d.contacts?.nom ?? null,
          cotation_id: null,
          cotation_titre: null,
          link_accepted_at: null,
          bulletin_statut: bulletin?.statut ?? null,
          bulletin_signed_at: bulletin?.signed_at ?? null,
          factures_total: facturesTotal,
          factures_payees: facturesPayees,
        };

        if (!bulletin || bulletin.statut === "a_signer") {
          sig.push(row);
        } else if (facturesTotal > 0 && facturesPayees === facturesTotal) {
          done.push(row);
        } else {
          cours.push(row);
        }
      }

      setEnAttenteSignature(sig);
      setEnCours(cours);
      setComplets(done);
      setLoading(false);
    })();
  }, [user?.id]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const stats = [
    { label: "En attente paiement", value: enAttentePaiement.length, icon: Wallet, tone: "amber" },
    { label: "En attente signature", value: enAttenteSignature.length, icon: FileSignature, tone: "blue" },
    { label: "Dossiers en cours", value: enCours.length, icon: Clock, tone: "neutral" },
    { label: "Complets", value: complets.length, icon: CheckCircle2, tone: "emerald" },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Suivi des dossiers"
        description="Vue synthétique du parcours client : paiement → signature → facturation."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-semibold">{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                </div>
                <s.icon className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Section
        title="En attente de paiement de l'acompte"
        description="Le client a validé son devis. À vérifier dans vos comptes bancaires."
        emptyText="Aucune cotation en attente."
      >
        {enAttentePaiement.map((c) => (
          <Link
            key={c.id}
            to="/cotations/$id"
            params={{ id: c.id }}
            className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 border-b last:border-b-0"
          >
            <div>
              <div className="font-medium text-sm">{c.titre}</div>
              <div className="text-xs text-muted-foreground">
                {c.client_nom ?? "—"} · validé{" "}
                {c.link_accepted_at ? new Date(c.link_accepted_at).toLocaleDateString("fr-FR") : ""}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </Section>

      <Section
        title="En attente de signature du bulletin"
        description="Le bulletin a été (ou doit être) envoyé pour signature au client."
        emptyText="Aucun bulletin en attente."
      >
        {enAttenteSignature.map((d) => (
          <Link
            key={d.id}
            to="/dossiers/$id"
            params={{ id: d.id }}
            className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 border-b last:border-b-0"
          >
            <div>
              <div className="font-medium text-sm">{d.titre}</div>
              <div className="text-xs text-muted-foreground">
                {d.client_nom ?? "—"} · {formatEUR(d.prix_vente)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {d.bulletin_statut === "a_signer" ? (
                <Badge variant="secondary">À signer</Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500 text-amber-700">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Bulletin non envoyé
                </Badge>
              )}
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>
        ))}
      </Section>

      <Section
        title="Dossiers en cours"
        description="Bulletin signé, factures émises ou partiellement réglées."
        emptyText="Aucun dossier en cours."
      >
        {enCours.map((d) => (
          <Link
            key={d.id}
            to="/dossiers/$id"
            params={{ id: d.id }}
            className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 border-b last:border-b-0"
          >
            <div>
              <div className="font-medium text-sm">{d.titre}</div>
              <div className="text-xs text-muted-foreground">
                {d.client_nom ?? "—"} · {formatEUR(d.prix_vente)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {d.factures_payees}/{d.factures_total} factures payées
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>
        ))}
      </Section>

      <Section
        title="Dossiers complets"
        description="Toutes les factures sont réglées."
        emptyText="Aucun dossier finalisé."
      >
        {complets.map((d) => (
          <Link
            key={d.id}
            to="/dossiers/$id"
            params={{ id: d.id }}
            className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 border-b last:border-b-0"
          >
            <div>
              <div className="font-medium text-sm">{d.titre}</div>
              <div className="text-xs text-muted-foreground">
                {d.client_nom ?? "—"} · {formatEUR(d.prix_vente)}
              </div>
            </div>
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Complet
            </Badge>
          </Link>
        ))}
      </Section>
    </AppLayout>
  );
}

function Section({
  title,
  description,
  children,
  emptyText,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  emptyText: string;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {hasChildren ? (
          <div className="border-t">{children}</div>
        ) : (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground border-t">{emptyText}</div>
        )}
      </CardContent>
    </Card>
  );
}

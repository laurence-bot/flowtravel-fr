import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTable, type Dossier, type Paiement, type Facture, type Compte, type Transfert, type BankTransaction, BANQUE_LABELS } from "@/hooks/use-data";
import { formatEUR, formatPercent, formatDate } from "@/lib/format";
import { computeGlobalFinance, computeComptesSoldes } from "@/lib/finance";
import { PageHeader } from "@/components/page-header";
import { TrendingUp, TrendingDown, Wallet, PiggyBank, ArrowRight, Receipt, Landmark, Percent, Link2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: () => (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  ),
});

function KPI({
  label,
  value,
  icon: Icon,
  tone,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "revenue" | "cost" | "margin" | "cash";
  hint?: string;
}) {
  const colorVar = `var(--${tone})`;
  return (
    <Card className="p-6 relative overflow-hidden border-border/60 hover:border-border transition-colors">
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ backgroundColor: colorVar }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </div>
          <div className="mt-3 text-2xl md:text-[28px] font-semibold tabular text-foreground">
            {value}
          </div>
          {hint && (
            <div className="text-xs text-muted-foreground mt-1.5">{hint}</div>
          )}
        </div>
        <div
          className="h-10 w-10 rounded-md flex items-center justify-center shrink-0"
          style={{ backgroundColor: `color-mix(in oklab, ${colorVar} 12%, transparent)`, color: colorVar }}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function Dashboard() {
  const { data: dossiers } = useTable<Dossier>("dossiers");
  const { data: paiements } = useTable<Paiement>("paiements");
  const { data: factures } = useTable<Facture>("factures_fournisseurs");
  const { data: comptes } = useTable<Compte>("comptes");
  const { data: transferts } = useTable<Transfert>("transferts");
  const { data: bankTx } = useTable<BankTransaction>("bank_transactions");

  const f = computeGlobalFinance(dossiers, paiements, factures);
  const soldes = computeComptesSoldes(comptes, paiements, transferts);
  const tresorerieReelle = soldes.reduce((s, c) => s + c.solde, 0);
  const txARapprocher = bankTx.filter((t) => t.statut === "nouveau").length;
  const recentDossiers = dossiers.slice(0, 5);
  const recentPaiements = paiements.slice(0, 5);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Tableau de bord"
        description="Vision financière consolidée de l'agence"
      />

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI
          label="Chiffre d'affaires"
          value={formatEUR(f.ca)}
          icon={TrendingUp}
          tone="revenue"
          hint={`${dossiers.length} dossier${dossiers.length > 1 ? "s" : ""}`}
        />
        <KPI
          label="Coûts fournisseurs"
          value={formatEUR(f.couts)}
          icon={TrendingDown}
          tone="cost"
        />
        <KPI
          label="Marge brute"
          value={formatEUR(f.marge)}
          icon={PiggyBank}
          tone="margin"
          hint={f.ca > 0 ? `${formatPercent(f.margePct)} du CA` : "—"}
        />
        <KPI
          label="Trésorerie réelle"
          value={formatEUR(comptes.length > 0 ? tresorerieReelle : f.tresorerie)}
          icon={Wallet}
          tone="cash"
          hint={comptes.length > 0 ? `${comptes.length} compte${comptes.length > 1 ? "s" : ""}` : "Configurez vos comptes"}
        />
      </section>

      {/* TVA sur marge — vision agence de voyages */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 border-border/60">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <PiggyBank className="h-3.5 w-3.5" />
            Marge brute
          </div>
          <div className={`mt-2 text-xl font-semibold tabular ${f.marge >= 0 ? "" : "text-destructive"}`}>
            {formatEUR(f.marge)}
          </div>
        </Card>
        <Card className="p-5 border-border/60">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Percent className="h-3.5 w-3.5" />
            TVA sur marge
          </div>
          <div className="mt-2 text-xl font-semibold tabular text-[color:var(--cost)]">
            −{formatEUR(f.tvaSurMarge)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">Régime agences de voyages</div>
        </Card>
        <Card className="p-5 border-border/60 bg-secondary/30">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <PiggyBank className="h-3.5 w-3.5" />
            Marge nette
          </div>
          <div className={`mt-2 text-xl font-semibold tabular ${f.margeNette >= 0 ? "text-[color:var(--margin)]" : "text-destructive"}`}>
            {formatEUR(f.margeNette)}
          </div>
          {f.ca > 0 && (
            <div className="text-[11px] text-muted-foreground mt-1">{formatPercent(f.margeNettePct)} du CA</div>
          )}
        </Card>
      </section>

      {/* Trésorerie par compte */}
      {comptes.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl flex items-center gap-2">
              <Landmark className="h-5 w-5 text-muted-foreground" />
              Trésorerie par compte
            </h2>
            <Link to="/comptes" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Détails <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {soldes.map((s) => (
              <Card key={s.compte.id} className="p-4 border-border/60">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{s.compte.nom}</div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mt-0.5">
                      {BANQUE_LABELS[s.compte.banque]}
                    </div>
                  </div>
                  <div className={`tabular text-lg font-semibold ${s.solde >= 0 ? "" : "text-destructive"}`}>
                    {formatEUR(s.solde)}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 border-border/60">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">Flux financiers</h2>
            <Link to="/paiements" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Tout voir <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between items-center border-b border-border/60 pb-3">
              <dt className="text-muted-foreground">Total encaissé clients</dt>
              <dd className="tabular text-[color:var(--revenue)] font-medium">
                +{formatEUR(f.encaisse)}
              </dd>
            </div>
            <div className="flex justify-between items-center border-b border-border/60 pb-3">
              <dt className="text-muted-foreground">Total payé fournisseurs</dt>
              <dd className="tabular text-[color:var(--cost)] font-medium">
                −{formatEUR(f.decaisse)}
              </dd>
            </div>
            <div className="flex justify-between items-center pt-1">
              <dt className="font-medium text-foreground">Trésorerie nette</dt>
              <dd className="tabular text-lg font-semibold text-foreground">
                {formatEUR(f.tresorerie)}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="p-6 border-border/60">
          <h2 className="font-display text-xl">Engagements à venir</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between items-center border-b border-border/60 pb-3">
              <dt className="text-muted-foreground inline-flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Factures fournisseurs non payées
              </dt>
              <dd className="tabular font-medium">{f.facturesNonPayees}</dd>
            </div>
            <div className="flex justify-between items-center pt-1">
              <dt className="font-medium text-foreground">Reste à payer</dt>
              <dd className="tabular text-lg font-semibold text-[color:var(--cost)]">
                {formatEUR(f.resteAPayerFournisseurs)}
              </dd>
            </div>
          </dl>
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/60 overflow-hidden">
          <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
            <h2 className="font-display text-lg">Derniers dossiers</h2>
            <Link to="/dossiers" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Tout voir <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentDossiers.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              Aucun dossier pour le moment.
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {recentDossiers.map((d) => {
                const marge = Number(d.prix_vente) - Number(d.cout_total);
                return (
                  <li key={d.id}>
                    <Link
                      to="/dossiers/$id"
                      params={{ id: d.id }}
                      className="px-6 py-3.5 flex items-center justify-between gap-3 hover:bg-secondary/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{d.titre}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatEUR(d.prix_vente)} · marge{" "}
                          <span className={marge >= 0 ? "text-[color:var(--margin)]" : "text-destructive"}>
                            {formatEUR(marge)}
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className="capitalize text-[10px]">
                        {d.statut === "confirme" ? "Confirmé" : d.statut === "cloture" ? "Clôturé" : "Brouillon"}
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="border-border/60 overflow-hidden">
          <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
            <h2 className="font-display text-lg">Derniers paiements</h2>
            <Link to="/paiements" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Tout voir <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentPaiements.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              Aucun paiement enregistré.
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {recentPaiements.map((p) => (
                <li key={p.id} className="px-6 py-3.5 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">
                      {p.type === "paiement_client" ? "Encaissement client" : "Paiement fournisseur"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 capitalize">
                      {formatDate(p.date)} · {p.methode}
                    </div>
                  </div>
                  <div
                    className={`tabular font-medium ${
                      p.type === "paiement_client"
                        ? "text-[color:var(--revenue)]"
                        : "text-[color:var(--cost)]"
                    }`}
                  >
                    {p.type === "paiement_client" ? "+" : "−"}
                    {formatEUR(p.montant)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {dossiers.length === 0 && (
        <Card className="p-8 border-dashed border-border bg-secondary/30 text-center">
          <h3 className="font-display text-xl">Bienvenue sur Cashflow Travel</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Commencez par créer un client, puis enregistrez votre premier dossier de voyage.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Button asChild variant="outline">
              <Link to="/contacts">Ajouter un contact</Link>
            </Button>
            <Button asChild>
              <Link to="/dossiers">Créer un dossier</Link>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { useTable, type Dossier, type Paiement, type Facture } from "@/hooks/use-data";
import { formatEUR } from "@/lib/format";
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";

export const Route = createFileRoute("/")({
  component: DashboardRoute,
});

function DashboardRoute() {
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}

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
  const toneClass = {
    revenue: "text-[color:var(--revenue)] bg-[color:var(--revenue)]/10",
    cost: "text-[color:var(--cost)] bg-[color:var(--cost)]/10",
    margin: "text-[color:var(--margin)] bg-[color:var(--margin)]/10",
    cash: "text-[color:var(--cash)] bg-[color:var(--cash)]/10",
  }[tone];
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-2 text-2xl font-semibold tabular">{value}</div>
          {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
        </div>
        <div className={`h-10 w-10 rounded-md flex items-center justify-center ${toneClass}`}>
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

  const ca = dossiers.reduce((s, d) => s + Number(d.prix_vente), 0);
  const couts = dossiers.reduce((s, d) => s + Number(d.cout_total), 0);
  const marge = ca - couts;

  const encaisse = paiements
    .filter((p) => p.type === "paiement_client")
    .reduce((s, p) => s + Number(p.montant), 0);
  const decaisse = paiements
    .filter((p) => p.type === "paiement_fournisseur")
    .reduce((s, p) => s + Number(p.montant), 0);
  const tresorerie = encaisse - decaisse;

  const facturesNonPayees = factures.filter((f) => !f.paye);
  const aPayer = facturesNonPayees.reduce((s, f) => s + Number(f.montant), 0);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vision financière consolidée de l'agence
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Chiffre d'affaires" value={formatEUR(ca)} icon={TrendingUp} tone="revenue" hint={`${dossiers.length} dossier(s)`} />
        <KPI label="Coûts fournisseurs" value={formatEUR(couts)} icon={TrendingDown} tone="cost" />
        <KPI label="Marge brute" value={formatEUR(marge)} icon={PiggyBank} tone="margin" hint={ca > 0 ? `${((marge / ca) * 100).toFixed(1)}% du CA` : undefined} />
        <KPI label="Trésorerie nette" value={formatEUR(tresorerie)} icon={Wallet} tone="cash" hint={`${formatEUR(encaisse)} encaissés`} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-base font-semibold">Flux financiers</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2">
              <dt className="text-muted-foreground">Total encaissé clients</dt>
              <dd className="tabular text-[color:var(--revenue)] font-medium">{formatEUR(encaisse)}</dd>
            </div>
            <div className="flex justify-between border-b pb-2">
              <dt className="text-muted-foreground">Total payé fournisseurs</dt>
              <dd className="tabular text-[color:var(--cost)] font-medium">−{formatEUR(decaisse)}</dd>
            </div>
            <div className="flex justify-between pt-1">
              <dt className="font-medium">Trésorerie nette</dt>
              <dd className="tabular font-semibold">{formatEUR(tresorerie)}</dd>
            </div>
          </dl>
        </Card>
        <Card className="p-6">
          <h2 className="text-base font-semibold">Engagements à venir</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Factures fournisseurs non payées</span>
              <span className="tabular font-medium">{facturesNonPayees.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reste à payer</span>
              <span className="tabular font-semibold text-[color:var(--cost)]">{formatEUR(aPayer)}</span>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import {
  useTable,
  type Compte,
  type Paiement,
  type Transfert,
  type Dossier,
  type Facture,
  type Contact,
} from "@/hooks/use-data";
import { computeCashForecast, type ForecastPoint } from "@/lib/cash-forecast";
import { formatEUR, formatDate } from "@/lib/format";
import { TrendingUp, TrendingDown, AlertTriangle, Wallet, LineChart, ArrowDownRight, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/previsions")({
  component: () => (
    <RequireAuth>
      <PrevisionsPage />
    </RequireAuth>
  ),
});

type Period = 7 | 30 | 90;

function PrevisionsPage() {
  const { data: comptes } = useTable<Compte>("comptes");
  const { data: paiements } = useTable<Paiement>("paiements");
  const { data: transferts } = useTable<Transfert>("transferts");
  const { data: dossiers } = useTable<Dossier>("dossiers");
  const { data: factures } = useTable<Facture>("factures_fournisseurs");
  const { data: contacts } = useTable<Contact>("contacts");
  const [period, setPeriod] = useState<Period>(30);

  const forecast = useMemo(
    () =>
      computeCashForecast(period, {
        comptes,
        paiements,
        transferts,
        dossiers,
        factures,
        contacts,
      }),
    [period, comptes, paiements, transferts, dossiers, factures, contacts],
  );

  const hasData = comptes.length > 0 || dossiers.length > 0 || factures.length > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Prévision de trésorerie"
        description="Projection des entrées et sorties d'argent à venir"
        action={
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            {([7, 30, 90] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 text-xs font-medium transition-colors ${
                  period === p
                    ? "bg-foreground text-background"
                    : "bg-background text-muted-foreground hover:bg-secondary"
                }`}
              >
                {p} jours
              </button>
            ))}
          </div>
        }
      />

      {!hasData ? (
        <Card className="border-border/60">
          <EmptyState
            icon={LineChart}
            title="Pas encore de données à projeter"
            description="Ajoutez des comptes bancaires, des dossiers et des factures fournisseurs pour activer la prévision de trésorerie."
          />
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ForecastKPI
              label="Trésorerie actuelle"
              value={formatEUR(forecast.soldeInitial)}
              tone={forecast.soldeInitial >= 0 ? "neutral" : "negative"}
              icon={Wallet}
            />
            <ForecastKPI
              label="Encaissements prévus"
              value={`+${formatEUR(forecast.totalEntrees)}`}
              tone="positive"
              icon={ArrowUpRight}
            />
            <ForecastKPI
              label="Décaissements prévus"
              value={`−${formatEUR(forecast.totalSorties)}`}
              tone="cost"
              icon={ArrowDownRight}
            />
            <ForecastKPI
              label={`Solde à ${period} j`}
              value={formatEUR(forecast.soldeFinal)}
              tone={
                forecast.soldeFinal < 0
                  ? "negative"
                  : forecast.soldeFinal < forecast.soldeInitial * 0.3
                    ? "warning"
                    : "positive"
              }
              icon={forecast.soldeFinal >= forecast.soldeInitial ? TrendingUp : TrendingDown}
            />
          </section>

          {/* Alertes */}
          {forecast.alertes.length > 0 && (
            <Card className="p-5 border-destructive/30 bg-destructive/5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-sm">
                    {forecast.alertes.length} alerte{forecast.alertes.length > 1 ? "s" : ""} de
                    trésorerie
                  </h3>
                  <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                    {dedupeAlerts(forecast.alertes).slice(0, 5).map((a, i) => (
                      <li key={i} className="flex items-center justify-between gap-2">
                        <span>
                          <span className="text-foreground font-medium">{formatDate(a.date)}</span>{" "}
                          · {a.message}
                        </span>
                        <span
                          className={`tabular font-medium ${
                            a.type === "tresorerie_negative"
                              ? "text-destructive"
                              : "text-[color:var(--cost)]"
                          }`}
                        >
                          {a.type === "tresorerie_negative" ? "" : "−"}
                          {formatEUR(Math.abs(a.montant))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          )}

          {/* Courbe */}
          <Card className="p-6 border-border/60">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg">Évolution prévisionnelle du cash</h2>
              {forecast.pointBas && (
                <div className="text-xs text-muted-foreground">
                  Point bas :{" "}
                  <span
                    className={`tabular font-medium ${
                      forecast.pointBas.solde < 0 ? "text-destructive" : "text-foreground"
                    }`}
                  >
                    {formatEUR(forecast.pointBas.solde)}
                  </span>{" "}
                  le {formatDate(forecast.pointBas.date)}
                </div>
              )}
            </div>
            <ForecastChart points={forecast.points} />
          </Card>

          {/* Table des évènements */}
          <Card className="border-border/60 overflow-hidden">
            <div className="px-6 py-4 border-b border-border/60">
              <h2 className="font-display text-lg">Évènements à venir</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Encaissements et décaissements projetés sur {period} jours
              </p>
            </div>
            <ForecastEvents points={forecast.points} />
          </Card>
        </>
      )}
    </div>
  );
}

function ForecastKPI({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "warning" | "neutral" | "cost";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const colorMap: Record<typeof tone, string> = {
    positive: "var(--margin)",
    negative: "var(--destructive)",
    warning: "var(--gold)",
    neutral: "var(--cash)",
    cost: "var(--cost)",
  };
  const color = colorMap[tone];
  return (
    <Card className="p-5 border-border/60 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ backgroundColor: color }} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </div>
          <div className="mt-2 text-xl font-semibold tabular" style={{ color }}>
            {value}
          </div>
        </div>
        <div
          className="h-9 w-9 rounded-md flex items-center justify-center shrink-0"
          style={{
            backgroundColor: `color-mix(in oklab, ${color} 12%, transparent)`,
            color,
          }}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

function ForecastChart({ points }: { points: ForecastPoint[] }) {
  if (points.length === 0) return null;
  const W = 800;
  const H = 220;
  const PAD = { l: 10, r: 10, t: 10, b: 24 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const soldes = points.map((p) => p.solde);
  const min = Math.min(0, ...soldes);
  const max = Math.max(0, ...soldes);
  const range = max - min || 1;
  const x = (i: number) => PAD.l + (i / Math.max(1, points.length - 1)) * innerW;
  const y = (v: number) => PAD.t + (1 - (v - min) / range) * innerH;
  const zeroY = y(0);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.solde)}`).join(" ");
  const area = `${line} L ${x(points.length - 1)} ${y(min)} L ${x(0)} ${y(min)} Z`;

  // Couleur selon point final
  const final = points[points.length - 1].solde;
  const stroke = final < 0 ? "var(--destructive)" : final < points[0].solde * 0.3 ? "var(--gold)" : "var(--margin)";

  // Étiquettes : début, milieu, fin
  const labels = [0, Math.floor(points.length / 2), points.length - 1];

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[220px] min-w-[600px]">
        <defs>
          <linearGradient id="forecastGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Ligne zéro */}
        <line
          x1={PAD.l}
          x2={W - PAD.r}
          y1={zeroY}
          y2={zeroY}
          stroke="var(--border)"
          strokeDasharray="4 4"
        />
        {/* Aire */}
        <path d={area} fill="url(#forecastGrad)" />
        {/* Ligne */}
        <path d={line} fill="none" stroke={stroke} strokeWidth="2" />
        {/* Points alertes */}
        {points.map((p, i) =>
          p.solde < 0 ? (
            <circle key={i} cx={x(i)} cy={y(p.solde)} r="3" fill="var(--destructive)" />
          ) : null,
        )}
        {/* Étiquettes X */}
        {labels.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 6}
            textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
            className="fill-muted-foreground"
            fontSize="10"
          >
            {formatDate(points[i].date)}
          </text>
        ))}
      </svg>
    </div>
  );
}

function ForecastEvents({ points }: { points: ForecastPoint[] }) {
  const daysWithEvents = points.filter((p) => p.evenements.length > 0);
  if (daysWithEvents.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-sm text-muted-foreground">
        Aucun encaissement ou décaissement projeté sur cette période.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border/60">
      {daysWithEvents.slice(0, 30).map((p) => (
        <li key={p.date} className="px-6 py-3.5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {formatDate(p.date)}
            </div>
            <div
              className={`tabular text-xs font-medium ${
                p.solde < 0 ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              Solde projeté : {formatEUR(p.solde)}
            </div>
          </div>
          <ul className="space-y-1">
            {p.evenements.map((e, i) => (
              <li key={i} className="flex items-center justify-between text-sm gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${
                      e.type === "encaissement"
                        ? "border-[color:var(--revenue)]/40 text-[color:var(--revenue)]"
                        : "border-[color:var(--cost)]/40 text-[color:var(--cost)]"
                    }`}
                  >
                    {e.type === "encaissement" ? "Entrée" : "Sortie"}
                  </Badge>
                  <span className="truncate">{e.label}</span>
                </div>
                <span
                  className={`tabular font-medium shrink-0 ${
                    e.type === "encaissement"
                      ? "text-[color:var(--revenue)]"
                      : "text-[color:var(--cost)]"
                  }`}
                >
                  {e.type === "encaissement" ? "+" : "−"}
                  {formatEUR(e.montant)}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function dedupeAlerts<T extends { date: string; type: string }>(alerts: T[]): T[] {
  const seen = new Set<string>();
  return alerts.filter((a) => {
    const key = `${a.date}:${a.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

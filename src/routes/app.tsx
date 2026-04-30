import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTable, type Dossier, type Paiement, type Facture, type Compte, type Transfert, type BankTransaction, type Contact, BANQUE_LABELS } from "@/hooks/use-data";
import { formatEUR, formatPercent, formatDate } from "@/lib/format";
import { computeGlobalFinance, computeComptesSoldes } from "@/lib/finance";
import { computeCashForecast } from "@/lib/cash-forecast";
import { PageHeader } from "@/components/page-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  PRIORITE_TONE,
  STATUT_TONE,
  isAujourdhui,
  isEnRetard,
  sortByUrgence,
  type DossierTask,
} from "@/lib/dossier-tasks";
import { TrendingUp, TrendingDown, Wallet, PiggyBank, ArrowRight, Receipt, Landmark, Percent, Link2, LineChart, AlertTriangle, CheckSquare, Flame, Clock, Mail, Plane } from "lucide-react";
import { deadlineUrgence, type FournisseurOption, type FlightOption } from "@/lib/options";

export const Route = createFileRoute("/app")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase.from("user_profiles").select("is_super_admin").eq("user_id", session.user.id).maybeSingle();
      if (data?.is_super_admin) {
        throw redirect({ to: "/admin-dashboard" });
      }
    }
  },
  component: () => (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  ),
  head: () => ({
    meta: [
      { title: "Tableau de bord — FlowTravel" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
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
  const { data: contacts } = useTable<Contact>("contacts");
  const { user } = useAuth();
  const [tasks, setTasks] = useState<DossierTask[]>([]);
  const [foOpts, setFoOpts] = useState<FournisseurOption[]>([]);
  const [flOpts, setFlOpts] = useState<FlightOption[]>([]);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("dossier_tasks")
      .select("*")
      .neq("statut", "termine")
      .then(({ data }: { data: DossierTask[] | null }) => setTasks(data ?? []));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("fournisseur_options")
      .select("*")
      .not("statut", "in", "(annulee,option_refusee,confirmee)")
      .then(({ data }: { data: FournisseurOption[] | null }) => setFoOpts(data ?? []));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("flight_options")
      .select("*")
      .eq("statut", "en_option")
      .then(({ data }: { data: FlightOption[] | null }) => setFlOpts(data ?? []));
  }, [user, dossiers.length]);

  const f = computeGlobalFinance(dossiers, paiements, factures);
  const soldes = computeComptesSoldes(comptes, paiements, transferts);
  const tresorerieReelle = soldes.reduce((s, c) => s + c.solde, 0);
  const txARapprocher = bankTx.filter((t) => t.statut === "nouveau").length;
  const forecast = computeCashForecast(30, { comptes, paiements, transferts, dossiers, factures, contacts });
  const recentDossiers = dossiers.slice(0, 5);
  const recentPaiements = paiements.slice(0, 5);

  const tasksRetard = tasks.filter(isEnRetard);
  const tasksToday = tasks.filter(isAujourdhui);
  const tasksCritiques = tasks.filter((t) => t.priorite === "critique");
  const tasksUrgentes = [...tasksRetard, ...tasksToday, ...tasksCritiques]
    .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i)
    .sort(sortByUrgence)
    .slice(0, 6);

  // --- Options fournisseurs / vols : alertes deadlines ---
  const allOptDeadlines = [
    ...foOpts.map((o) => ({
      id: o.id,
      kind: "fournisseur" as const,
      label: o.nom_fournisseur,
      cotation_id: o.cotation_id,
      urg: deadlineUrgence(o.deadline_option_date, o.deadline_option_time),
    })),
    ...flOpts.map((f) => ({
      id: f.id,
      kind: "vol" as const,
      label: `${f.compagnie} ${f.routing}`,
      cotation_id: f.cotation_id,
      urg: deadlineUrgence(f.deadline_option_date, f.deadline_option_time),
    })),
  ];
  const optExpired = allOptDeadlines.filter((d) => d.urg === "expired");
  const optCritical = allOptDeadlines.filter((d) => d.urg === "critical");
  const optSansReponse = foOpts.filter((o) => o.statut === "demandee" && deadlineUrgence(o.deadline_option_date, o.deadline_option_time) === "ok");

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

      {txARapprocher > 0 && (
        <Link
          to="/rapprochement"
          className="block group"
        >
          <Card className="p-4 border-[color:var(--gold)]/30 bg-[color:var(--gold)]/8 hover:bg-[color:var(--gold)]/12 transition-colors flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-md flex items-center justify-center bg-[color:var(--gold)]/20 text-[color:var(--gold)] shrink-0">
                <Link2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-medium text-sm">
                  {txARapprocher} transaction{txARapprocher > 1 ? "s" : ""} bancaire{txARapprocher > 1 ? "s" : ""} à rapprocher
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Validez les suggestions automatiques pour fiabiliser votre trésorerie.
                </div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
          </Card>
        </Link>
      )}

      {/* Tâches opérationnelles */}
      {tasks.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-muted-foreground" />
              Tâches opérationnelles
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <Card className="p-5 border-border/60">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" /> En retard
              </div>
              <div className={`mt-2 text-2xl font-semibold tabular ${tasksRetard.length > 0 ? "text-destructive" : ""}`}>
                {tasksRetard.length}
              </div>
            </Card>
            <Card className="p-5 border-border/60">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Aujourd'hui
              </div>
              <div className="mt-2 text-2xl font-semibold tabular text-blue-600 dark:text-blue-400">
                {tasksToday.length}
              </div>
            </Card>
            <Card className="p-5 border-border/60">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <Flame className="h-3.5 w-3.5" /> Critiques
              </div>
              <div className={`mt-2 text-2xl font-semibold tabular ${tasksCritiques.length > 0 ? "text-destructive" : ""}`}>
                {tasksCritiques.length}
              </div>
            </Card>
          </div>
          {tasksUrgentes.length > 0 && (
            <Card className="border-border/60 overflow-hidden">
              <ul className="divide-y divide-border/60">
                {tasksUrgentes.map((t) => {
                  const dossier = dossiers.find((d) => d.id === t.dossier_id);
                  const late = isEnRetard(t);
                  return (
                    <li key={t.id}>
                      <Link
                        to="/dossiers/$id"
                        params={{ id: t.dossier_id }}
                        className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-secondary/40 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{t.titre}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">
                            {dossier?.titre ?? "Dossier"}
                            {t.date_echeance && ` · ${t.date_echeance}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {late && (
                            <Badge variant="outline" className="text-[10px] bg-destructive/15 text-destructive border-destructive/30">
                              En retard
                            </Badge>
                          )}
                          {t.priorite !== "normale" && (
                            <Badge variant="outline" className={`text-[10px] ${PRIORITE_TONE[t.priorite]}`}>
                              {t.priorite === "critique" ? "Critique" : "Importante"}
                            </Badge>
                          )}
                          <Badge variant="outline" className={`text-[10px] ${STATUT_TONE[t.statut]}`}>
                            {t.statut === "en_cours" ? "En cours" : "À faire"}
                          </Badge>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </section>
      )}

      {/* Alertes options fournisseurs / vols */}
      {(optExpired.length > 0 || optCritical.length > 0 || optSansReponse.length > 0) && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl flex items-center gap-2">
              <Mail className="h-5 w-5 text-muted-foreground" />
              Options &amp; deadlines fournisseurs
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <Card className="p-5 border-border/60">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" /> Expirées
              </div>
              <div className={`mt-2 text-2xl font-semibold tabular ${optExpired.length > 0 ? "text-destructive" : ""}`}>
                {optExpired.length}
              </div>
            </Card>
            <Card className="p-5 border-border/60">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> &lt; 24h
              </div>
              <div className={`mt-2 text-2xl font-semibold tabular ${optCritical.length > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
                {optCritical.length}
              </div>
            </Card>
            <Card className="p-5 border-border/60">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <Plane className="h-3.5 w-3.5" /> Sans réponse fournisseur
              </div>
              <div className="mt-2 text-2xl font-semibold tabular">
                {optSansReponse.length}
              </div>
            </Card>
          </div>
          {(optExpired.length > 0 || optCritical.length > 0) && (
            <Card className="border-border/60 overflow-hidden">
              <ul className="divide-y divide-border/60">
                {[...optExpired, ...optCritical].slice(0, 8).map((d) => (
                  <li key={`${d.kind}-${d.id}`}>
                    <Link
                      to="/cotations/$id"
                      params={{ id: d.cotation_id }}
                      className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-secondary/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{d.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {d.kind === "fournisseur" ? "Option fournisseur" : "Option vol"}
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${d.urg === "expired" ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"}`}>
                        {d.urg === "expired" ? "Expirée" : "< 24h"}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      )}

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

      {/* Prévision de trésorerie 30 jours */}
      {(comptes.length > 0 || dossiers.length > 0 || factures.length > 0) && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl flex items-center gap-2">
              <LineChart className="h-5 w-5 text-muted-foreground" />
              Prévision de trésorerie · 30 jours
            </h2>
            <Link to="/previsions" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Voir le détail <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <Card className="p-5 border-border/60">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Aujourd'hui</div>
                <div className="mt-1.5 text-xl font-semibold tabular">{formatEUR(forecast.soldeInitial)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Solde projeté à 30 j</div>
                <div className={`mt-1.5 text-xl font-semibold tabular ${forecast.soldeFinal < 0 ? "text-destructive" : forecast.soldeFinal < forecast.soldeInitial * 0.3 ? "text-[color:var(--gold)]" : "text-[color:var(--margin)]"}`}>
                  {formatEUR(forecast.soldeFinal)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  +{formatEUR(forecast.totalEntrees)} / −{formatEUR(forecast.totalSorties)}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Point bas</div>
                <div className={`mt-1.5 text-xl font-semibold tabular ${forecast.pointBas && forecast.pointBas.solde < 0 ? "text-destructive" : ""}`}>
                  {forecast.pointBas ? formatEUR(forecast.pointBas.solde) : "—"}
                </div>
                {forecast.pointBas && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">{formatDate(forecast.pointBas.date)}</div>
                )}
              </div>
            </div>
            {forecast.alertes.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/60 flex items-start gap-2 text-xs">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="text-muted-foreground">
                  <span className="text-destructive font-medium">{forecast.alertes.length} alerte{forecast.alertes.length > 1 ? "s" : ""}</span> de trésorerie sur les 30 prochains jours.
                </div>
              </div>
            )}
          </Card>
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
          <h3 className="font-display text-xl">Bienvenue sur FlowTravel</h3>
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useTable,
  type Dossier,
  type Paiement,
  type Facture,
  type FactureEcheance,
  type Compte,
  type Transfert,
  type BankTransaction,
  type Contact,
} from "@/hooks/use-data";
import { useAgents, agentLabel } from "@/hooks/use-agents";
import type { FxReservation } from "@/lib/fx";
import { formatEUR, formatPercent, formatDate } from "@/lib/format";
import {
  computeGlobalFinance,
  computeComptesSoldes,
  computeDossierFinance,
} from "@/lib/finance";
import { computeFxPnl } from "@/lib/fx-pnl";
import { computeCashForecast } from "@/lib/cash-forecast";
import { PageHeader } from "@/components/page-header";
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Percent,
  Wallet,
  AlertTriangle,
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  Trophy,
  Target,
  Link2,
  Receipt,
  LineChart,
  Shield,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/pilotage")({
  head: () => ({
    meta: [
      { title: "Pilotage dirigeant — FlowTravel" },
      {
        name: "description",
        content:
          "Tableau de bord stratégique : rentabilité, trésorerie, dossiers à risque et actions prioritaires.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <Pilotage />
    </RequireAuth>
  ),
});

type Action = {
  id: string;
  priorite: "haute" | "moyenne" | "info";
  type: "client" | "fournisseur" | "rapprochement" | "tresorerie" | "marge";
  label: string;
  detail: string;
  href: string;
  montant?: number;
};

function PrioBadge({ p }: { p: Action["priorite"] }) {
  const map = {
    haute: { cls: "bg-destructive/12 text-destructive border-destructive/30", label: "Urgent" },
    moyenne: { cls: "bg-[color:var(--gold)]/15 text-[color:var(--gold)] border-[color:var(--gold)]/30", label: "À traiter" },
    info: { cls: "bg-secondary text-muted-foreground border-border", label: "Info" },
  } as const;
  const v = map[p];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase tracking-wider border ${v.cls}`}>
      {v.label}
    </span>
  );
}

function Pilotage() {
  const { data: dossiers } = useTable<Dossier>("dossiers");
  const { data: paiements } = useTable<Paiement>("paiements");
  const { data: factures } = useTable<Facture>("factures_fournisseurs");
  const { data: comptes } = useTable<Compte>("comptes");
  const { data: transferts } = useTable<Transfert>("transferts");
  const { data: bankTx } = useTable<BankTransaction>("bank_transactions");
  const { data: contacts } = useTable<Contact>("contacts");
  const { data: echeances } = useTable<FactureEcheance>("facture_echeances");
  const { data: reservations } = useTable<FxReservation>("fx_coverage_reservations");
  const { agents } = useAgents();

  const f = computeGlobalFinance(dossiers, paiements, factures);
  const fxPnl = computeFxPnl({ echeances, paiements, reservations });
  const soldes = computeComptesSoldes(comptes, paiements, transferts);
  const tresorerieReelle = soldes.reduce((s, c) => s + c.solde, 0);
  const forecast = computeCashForecast(30, {
    comptes,
    paiements,
    transferts,
    dossiers,
    factures,
    contacts,
  });
  const txARapprocher = bankTx.filter((t) => t.statut === "nouveau").length;
  const paiementsNonRapproches = paiements.filter(
    (p) => p.statut_rapprochement === "non_rapproche",
  );
  const contactName = (id: string | null) =>
    contacts.find((c) => c.id === id)?.nom ?? "—";

  // Finance par dossier (hors clôturés pour le pilotage actif)
  const dossiersFin = dossiers
    .filter((d) => d.statut !== "cloture")
    .map((d) => ({ d, fin: computeDossierFinance(d, paiements, factures) }));

  // Top / Flop par marge nette
  const sortedByMargeNette = [...dossiersFin].sort(
    (a, b) => b.fin.margeNette - a.fin.margeNette,
  );
  const top = sortedByMargeNette.slice(0, 5);
  const flop = sortedByMargeNette.slice(-5).reverse();

  // Dossiers à risque
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in14 = new Date(today);
  in14.setDate(in14.getDate() + 14);

  const risques = dossiersFin
    .map(({ d, fin }) => {
      const reasons: { type: string; tone: "danger" | "warn" | "info"; label: string }[] = [];
      if (fin.marge < 0) reasons.push({ type: "marge_neg", tone: "danger", label: "Marge négative" });
      else if (fin.prixVente > 0 && fin.margeNettePct < 5)
        reasons.push({ type: "marge_faible", tone: "warn", label: "Marge nette faible" });

      if (fin.prixVente > 0) {
        const ratio = fin.encaisseClient / fin.prixVente;
        if (ratio < 0.5)
          reasons.push({
            type: "encaiss_faible",
            tone: "warn",
            label: `Encaissé ${formatPercent(ratio * 100, 0)}`,
          });
      }

      const echeances = factures.filter((fac) => {
        if (fac.dossier_id !== d.id || fac.paye) return false;
        if (!fac.date_echeance) return false;
        const due = new Date(fac.date_echeance);
        return due >= today && due <= in14;
      });
      if (echeances.length > 0)
        reasons.push({
          type: "fourn_proche",
          tone: "warn",
          label: `${echeances.length} facture(s) dues sous 14j`,
        });

      return { d, fin, reasons };
    })
    .filter((r) => r.reasons.length > 0)
    .sort((a, b) => {
      // Priorité : marge négative > faible > autres
      const score = (r: typeof a) =>
        r.reasons.some((x) => x.tone === "danger") ? 2 : 1;
      return score(b) - score(a);
    })
    .slice(0, 8);

  // Actions prioritaires
  const actions: Action[] = [];

  // Tension trésorerie
  if (forecast.soldeFinal < 0) {
    actions.push({
      id: "tres-neg",
      priorite: "haute",
      type: "tresorerie",
      label: "Trésorerie projetée négative à 30 jours",
      detail: `Solde prévu : ${formatEUR(forecast.soldeFinal)}`,
      href: "/previsions",
    });
  } else if (forecast.pointBas && forecast.pointBas.solde < 0) {
    actions.push({
      id: "tres-pb",
      priorite: "haute",
      type: "tresorerie",
      label: "Point bas négatif prévu",
      detail: `${formatEUR(forecast.pointBas.solde)} le ${formatDate(forecast.pointBas.date)}`,
      href: "/previsions",
    });
  } else if (forecast.alertes.length > 0) {
    actions.push({
      id: "tres-alert",
      priorite: "moyenne",
      type: "tresorerie",
      label: `${forecast.alertes.length} alerte(s) de trésorerie sur 30 j`,
      detail: "Pic de décaissement ou tension détectés",
      href: "/previsions",
    });
  }

  // Rapprochement
  if (txARapprocher > 0) {
    actions.push({
      id: "rappr",
      priorite: txARapprocher > 10 ? "haute" : "moyenne",
      type: "rapprochement",
      label: `${txARapprocher} transaction(s) bancaire(s) à rapprocher`,
      detail: "Validez les suggestions automatiques",
      href: "/rapprochement",
    });
  }
  if (paiementsNonRapproches.length > 0) {
    actions.push({
      id: "pai-nr",
      priorite: "info",
      type: "rapprochement",
      label: `${paiementsNonRapproches.length} paiement(s) non rapproché(s)`,
      detail: "Vérifiez la correspondance bancaire",
      href: "/paiements",
    });
  }

  // Relance clients : top 3 dossiers avec gros restes à encaisser
  const relances = dossiersFin
    .filter((x) => x.fin.resteAEncaisser > 0)
    .sort((a, b) => b.fin.resteAEncaisser - a.fin.resteAEncaisser)
    .slice(0, 3);
  for (const r of relances) {
    const client = contactName(r.d.client_id);
    actions.push({
      id: `relance-${r.d.id}`,
      priorite: r.fin.encaisseClient === 0 ? "moyenne" : "info",
      type: "client",
      label: `Relancer ${client}`,
      detail: `${r.d.titre} · reste ${formatEUR(r.fin.resteAEncaisser)}`,
      href: "/dossiers",
      montant: r.fin.resteAEncaisser,
    });
  }

  // Factures fournisseurs à payer sous 14j
  const facturesProches = factures
    .filter((fac) => {
      if (fac.paye || !fac.date_echeance) return false;
      const due = new Date(fac.date_echeance);
      return due <= in14;
    })
    .sort(
      (a, b) =>
        new Date(a.date_echeance!).getTime() -
        new Date(b.date_echeance!).getTime(),
    )
    .slice(0, 4);
  for (const fac of facturesProches) {
    const due = new Date(fac.date_echeance!);
    const enRetard = due < today;
    actions.push({
      id: `fac-${fac.id}`,
      priorite: enRetard ? "haute" : "moyenne",
      type: "fournisseur",
      label: `Payer ${contactName(fac.fournisseur_id)}`,
      detail: `${formatEUR(fac.montant)} · échéance ${formatDate(fac.date_echeance)}${enRetard ? " (en retard)" : ""}`,
      href: "/dossiers",
      montant: Number(fac.montant),
    });
  }

  // Marge faible alerte
  const margesFaibles = dossiersFin.filter((x) => x.fin.marge < 0).slice(0, 3);
  for (const m of margesFaibles) {
    actions.push({
      id: `marge-${m.d.id}`,
      priorite: "haute",
      type: "marge",
      label: `Marge négative : ${m.d.titre}`,
      detail: `Marge ${formatEUR(m.fin.marge)} · ${formatPercent(m.fin.margePct)}`,
      href: `/dossiers/${m.d.id}`,
    });
  }

  // Tri par priorité
  const prioRank = { haute: 0, moyenne: 1, info: 2 } as const;
  actions.sort((a, b) => prioRank[a.priorite] - prioRank[b.priorite]);

  const tresoTone =
    tresorerieReelle < 0
      ? "text-destructive"
      : forecast.soldeFinal < 0
        ? "text-[color:var(--gold)]"
        : "text-[color:var(--margin)]";

  return (
    <div className="space-y-10">
      <PageHeader
        title="Pilotage dirigeant"
        description="Synthèse stratégique pour décider rapidement"
      />

      {/* RENTABILITÉ */}
      <section>
        <h2 className="font-display text-xl mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          Rentabilité
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Card className="p-5 border-border/60">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">CA</div>
            <div className="mt-2 text-xl font-semibold tabular">{formatEUR(f.ca)}</div>
            <div className="text-[11px] text-muted-foreground mt-1">{dossiers.length} dossier(s)</div>
          </Card>
          <Card className="p-5 border-border/60">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Marge brute</div>
            <div className={`mt-2 text-xl font-semibold tabular ${f.marge < 0 ? "text-destructive" : ""}`}>
              {formatEUR(f.marge)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {f.ca > 0 ? formatPercent(f.margePct) : "—"}
            </div>
          </Card>
          <Card className="p-5 border-border/60">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-1">
              <Percent className="h-3 w-3" /> TVA sur marge
            </div>
            <div className="mt-2 text-xl font-semibold tabular text-[color:var(--cost)]">
              −{formatEUR(f.tvaSurMarge)}
            </div>
          </Card>
          <Card className="p-5 border-border/60 bg-secondary/30">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Marge nette</div>
            <div className={`mt-2 text-xl font-semibold tabular ${f.margeNette < 0 ? "text-destructive" : "text-[color:var(--margin)]"}`}>
              {formatEUR(f.margeNette)}
            </div>
          </Card>
          <Card className="p-5 border-border/60">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Taux marge nette</div>
            <div className={`mt-2 text-xl font-semibold tabular ${f.margeNettePct < 0 ? "text-destructive" : f.margeNettePct < 5 ? "text-[color:var(--gold)]" : "text-[color:var(--margin)]"}`}>
              {f.ca > 0 ? formatPercent(f.margeNettePct) : "—"}
            </div>
          </Card>
        </div>
      </section>

      {/* CA PAR AGENT */}
      {(() => {
        const byAgent = new Map<string, { ca: number; marge: number; count: number }>();
        for (const d of dossiers) {
          if (d.statut === "brouillon") continue;
          const key = d.agent_id ?? "—";
          const cur = byAgent.get(key) ?? { ca: 0, marge: 0, count: 0 };
          cur.ca += Number(d.prix_vente) || 0;
          cur.marge += (Number(d.prix_vente) || 0) - (Number(d.cout_total) || 0);
          cur.count += 1;
          byAgent.set(key, cur);
        }
        const rows = Array.from(byAgent.entries())
          .map(([agentId, v]) => {
            const a = agents.find((x) => x.user_id === agentId);
            return { agentId, name: a ? agentLabel(a) : "Non assigné", ...v };
          })
          .sort((a, b) => b.ca - a.ca);
        const totalCA = rows.reduce((s, r) => s + r.ca, 0);
        if (rows.length === 0) return null;
        return (
          <section>
            <h2 className="font-display text-xl mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              Chiffre d'affaires par agent
              <Badge variant="outline" className="text-[10px] ml-2">{rows.length}</Badge>
            </h2>
            <Card className="border-border/60 overflow-hidden">
              <div className="divide-y divide-border/60">
                {rows.map((r) => {
                  const pct = totalCA > 0 ? (r.ca / totalCA) * 100 : 0;
                  const margePct = r.ca > 0 ? (r.marge / r.ca) * 100 : 0;
                  return (
                    <div key={r.agentId} className="px-5 py-4">
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="font-medium text-sm truncate">{r.name}</div>
                          <Badge variant="outline" className="text-[10px]">{r.count} dossier{r.count > 1 ? "s" : ""}</Badge>
                        </div>
                        <div className="flex items-center gap-6 shrink-0 tabular text-sm">
                          <div className="text-right">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">CA</div>
                            <div className="font-semibold">{formatEUR(r.ca)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Marge brute</div>
                            <div className={`font-semibold ${r.marge < 0 ? "text-destructive" : "text-[color:var(--margin)]"}`}>
                              {formatEUR(r.marge)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">{formatPercent(margePct)}</div>
                          </div>
                          <div className="text-right w-14">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Part</div>
                            <div className="font-semibold">{pct.toFixed(0)}%</div>
                          </div>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full bg-[color:var(--gold)]"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
            <p className="text-[11px] text-muted-foreground mt-2">
              CA des dossiers confirmés et clôturés, regroupés par agent responsable.
            </p>
          </section>
        );
      })()}

      {/* TRÉSORERIE */}
      <section>
        <h2 className="font-display text-xl mb-4 flex items-center gap-2">
          <Wallet className="h-5 w-5 text-muted-foreground" />
          Trésorerie
        </h2>
        <Card className="p-5 border-border/60">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Aujourd'hui</div>
              <div className={`mt-1.5 text-2xl font-semibold tabular ${tresorerieReelle < 0 ? "text-destructive" : ""}`}>
                {formatEUR(tresorerieReelle)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{comptes.length} compte(s)</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">À 30 jours</div>
              <div className={`mt-1.5 text-2xl font-semibold tabular ${tresoTone}`}>
                {formatEUR(forecast.soldeFinal)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                +{formatEUR(forecast.totalEntrees)} / −{formatEUR(forecast.totalSorties)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Point bas</div>
              <div className={`mt-1.5 text-2xl font-semibold tabular ${forecast.pointBas && forecast.pointBas.solde < 0 ? "text-destructive" : ""}`}>
                {forecast.pointBas ? formatEUR(forecast.pointBas.solde) : "—"}
              </div>
              {forecast.pointBas && (
                <div className="text-[11px] text-muted-foreground mt-0.5">{formatDate(forecast.pointBas.date)}</div>
              )}
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Alertes</div>
              <div className={`mt-1.5 text-2xl font-semibold tabular ${forecast.alertes.length > 0 ? "text-destructive" : "text-[color:var(--margin)]"}`}>
                {forecast.alertes.length}
              </div>
              <Link to="/previsions" className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-0.5">
                Voir détail <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </Card>
      </section>

      {/* IMPACT FX */}
      {fxPnl.entries.length > 0 && (
        <section>
          <h2 className="font-display text-xl mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            Impact change (FX)
          </h2>
          <Card className="p-5 border-border/60">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Exposition</div>
                <div className="mt-1.5 text-2xl font-semibold tabular">{formatEUR(fxPnl.expositionEUR)}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{fxPnl.entries.length} mouvement(s)</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Couvert</div>
                <div className="mt-1.5 text-2xl font-semibold tabular text-[color:var(--margin)]">{formatEUR(fxPnl.couvert)}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">via couvertures FX</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Non couvert</div>
                <div className={`mt-1.5 text-2xl font-semibold tabular ${fxPnl.nonCouvert > 0 ? "text-[color:var(--gold)]" : ""}`}>
                  {formatEUR(fxPnl.nonCouvert)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">exposé au taux du jour</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Écart net</div>
                <div className={`mt-1.5 text-2xl font-semibold tabular ${fxPnl.net < 0 ? "text-destructive" : "text-[color:var(--margin)]"}`}>
                  {fxPnl.net >= 0 ? "+" : ""}{formatEUR(fxPnl.net)}
                </div>
                <Link to="/couvertures-fx" className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-0.5">
                  Détail FX <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </Card>
        </section>
      )}

      {/* ACTIONS PRIORITAIRES */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl flex items-center gap-2">
            <Target className="h-5 w-5 text-muted-foreground" />
            Actions prioritaires
          </h2>
          <Badge variant="outline" className="text-[10px]">{actions.length}</Badge>
        </div>
        <Card className="border-border/60 overflow-hidden">
          {actions.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              ✓ Aucune action urgente. Votre pilotage est à jour.
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {actions.slice(0, 12).map((a) => {
                const Icon =
                  a.type === "client" ? ArrowDownRight :
                  a.type === "fournisseur" ? ArrowUpRight :
                  a.type === "rapprochement" ? Link2 :
                  a.type === "tresorerie" ? Wallet :
                  AlertTriangle;
                return (
                  <li key={a.id}>
                    <Link
                      to={a.href}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-secondary/40 transition-colors"
                    >
                      <div className="h-9 w-9 rounded-md bg-secondary flex items-center justify-center shrink-0 text-muted-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <PrioBadge p={a.priorite} />
                          <span className="font-medium text-sm truncate">{a.label}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{a.detail}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      {/* DOSSIERS À RISQUE */}
      <section>
        <h2 className="font-display text-xl mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          Dossiers à risque
        </h2>
        <Card className="border-border/60 overflow-hidden">
          {risques.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              Aucun dossier à risque détecté.
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {risques.map(({ d, fin, reasons }) => (
                <li key={d.id}>
                  <Link
                    to="/dossiers/$id"
                    params={{ id: d.id }}
                    className="px-5 py-4 flex items-start justify-between gap-4 hover:bg-secondary/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{d.titre}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {contactName(d.client_id)} · {formatEUR(d.prix_vente)}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {reasons.map((r, i) => (
                          <span
                            key={i}
                            className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${
                              r.tone === "danger"
                                ? "bg-destructive/12 text-destructive border-destructive/30"
                                : r.tone === "warn"
                                  ? "bg-[color:var(--gold)]/12 text-[color:var(--gold)] border-[color:var(--gold)]/30"
                                  : "bg-secondary text-muted-foreground border-border"
                            }`}
                          >
                            {r.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`tabular text-sm font-semibold ${fin.margeNette < 0 ? "text-destructive" : ""}`}>
                        {formatEUR(fin.margeNette)}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">marge nette</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* TOP / FLOP */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[color:var(--margin)]" />
            <h3 className="font-display text-lg">Top dossiers</h3>
          </div>
          {top.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">Aucun dossier.</div>
          ) : (
            <ul className="divide-y divide-border/60">
              {top.map(({ d, fin }) => (
                <li key={d.id}>
                  <Link
                    to="/dossiers/$id"
                    params={{ id: d.id }}
                    className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-secondary/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{d.titre}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        CA {formatEUR(fin.prixVente)} · {fin.prixVente > 0 ? formatPercent(fin.margeNettePct) : "—"}
                      </div>
                    </div>
                    <div className="tabular text-sm font-semibold text-[color:var(--margin)]">
                      {formatEUR(fin.margeNette)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="border-border/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-destructive" />
            <h3 className="font-display text-lg">Flop dossiers</h3>
          </div>
          {flop.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">Aucun dossier.</div>
          ) : (
            <ul className="divide-y divide-border/60">
              {flop.map(({ d, fin }) => (
                <li key={d.id}>
                  <Link
                    to="/dossiers/$id"
                    params={{ id: d.id }}
                    className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-secondary/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{d.titre}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        CA {formatEUR(fin.prixVente)} · {fin.prixVente > 0 ? formatPercent(fin.margeNettePct) : "—"}
                      </div>
                    </div>
                    <div className={`tabular text-sm font-semibold ${fin.margeNette < 0 ? "text-destructive" : ""}`}>
                      {formatEUR(fin.margeNette)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* Raccourcis */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: "/dossiers", label: "Dossiers", icon: PiggyBank },
          { to: "/previsions", label: "Prévisions", icon: LineChart },
          { to: "/rapprochement", label: "Rapprochement", icon: Link2 },
          { to: "/paiements", label: "Paiements", icon: Receipt },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.to}
              to={s.to}
              className="group"
            >
              <Card className="p-4 border-border/60 hover:border-[color:var(--gold)]/50 transition-colors flex items-center gap-3">
                <div className="h-9 w-9 rounded-md bg-secondary flex items-center justify-center text-muted-foreground group-hover:text-[color:var(--gold)] transition-colors">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-sm font-medium">{s.label}</div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-auto group-hover:translate-x-0.5 transition-transform" />
              </Card>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import {
  listEmployees,
  listPlanning,
  listAbsences,
  listRecupDemandes,
  frenchHolidays,
  isJourOuvre,
  calcCompteurMensuel,
  heuresContractuellesParJour,
  basePaieMensuelle,
  planningEntryDays,
  planningEntryCoversDate,
  type Employee,
  type PlanningEntry,
  type Absence,
  type RecupDemande,
} from "@/lib/hr";
import { toast } from "sonner";

export const Route = createFileRoute("/ops/equipe/annee")({ component: AnneePage });

type EventType = "travail" | "teletravail" | "conge" | "absent" | "recup" | "formation" | "deplacement";
const COLORS: Record<EventType, string> = {
  travail: "bg-emerald-400",
  teletravail: "bg-sky-400",
  conge: "bg-violet-400",
  absent: "bg-orange-400",
  recup: "bg-purple-400",
  formation: "bg-amber-400",
  deplacement: "bg-pink-400",
};
const EVENT_LABELS: Record<EventType, string> = {
  travail: "Travail",
  teletravail: "Télétravail",
  conge: "Congé / RTT",
  absent: "Absence",
  recup: "Récupération",
  formation: "Formation",
  deplacement: "Déplacement",
};

function addMonths(yyyymm: string, n: number): string {
  const d = new Date(`${yyyymm}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}
function monthDays(yyyymm: string): string[] {
  const [y, m] = yyyymm.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const out: string[] = [];
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
function lastDayOfMonth(yyyymm: string): string {
  const days = monthDays(yyyymm);
  return days[days.length - 1];
}
const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

function fmtH(h: number): string {
  const sign = h < 0 ? "−" : h > 0 ? "+" : "";
  const abs = Math.abs(h);
  const hh = Math.floor(abs);
  const mm = Math.round((abs - hh) * 60);
  return `${sign}${hh}h${mm > 0 ? mm : ""}`;
}

function planningToEvent(t: string): EventType | null {
  if (t === "travail") return "travail";
  if (t === "teletravail") return "teletravail";
  if (t === "recuperation") return "recup";
  if (t === "formation") return "formation";
  if (t === "deplacement") return "deplacement";
  if (t === "reunion") return "travail";
  return null;
}
function absenceToEvent(t: string): EventType {
  if (["conge_paye", "rtt", "parental", "sans_solde"].includes(t)) return "conge";
  if (t === "recup") return "recup";
  if (t === "formation") return "formation";
  return "absent";
}

function AnneePage() {
  const [startMonth, setStartMonth] = useState("2026-05");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entries, setEntries] = useState<PlanningEntry[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [recups, setRecups] = useState<RecupDemande[]>([]);
  const [loading, setLoading] = useState(true);

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => addMonths(startMonth, i)),
    [startMonth],
  );
  const startDate = `${startMonth}-01`;
  const endDate = lastDayOfMonth(months[months.length - 1]);

  const load = async () => {
    setLoading(true);
    try {
      const [emps, plan, abs, recs] = await Promise.all([
        listEmployees(),
        listPlanning(startDate, endDate),
        listAbsences(),
        // Charge sur ~13 mois — la fonction prend "yyyy-mm", on agrège mois par mois côté liste
        Promise.all(months.map((m) => listRecupDemandes(m))).then((arr) => arr.flat()),
      ]);
      setEmployees(emps.filter((e) => e.actif));
      setEntries(plan);
      setAbsences(abs.filter((a) => a.statut === "approuvee" || a.statut === "signee"));
      setRecups(recs);
    } catch (e: any) {
      toast.error(e.message ?? "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startMonth]);

  // Cumul annuel par employé
  const cumulByEmp = useMemo(() => {
    const map = new Map<string, { heuresSup: number; soldeAnnuel: number; basePaie: number; baseReelle: number; congesPris: number; rttPris: number; rttAcquises: number }>();
    const yearStart = startDate;
    const yearEnd = endDate;
    for (const emp of employees) {
      const hParJour = heuresContractuellesParJour(emp);
      let heuresSup = 0;
      let soldeAnnuel = 0;
      let basePaieTotal = 0;
      let baseReelleTotal = 0;
      let rttAcquisesTotal = 0;
      const empAbs = absences.filter((a) => a.employee_id === emp.id);
      // Toutes les récups approuvées de l'employé (avec date) — on utilise les heures
      // réellement demandées, pas la durée de l'entrée planning liée.
      const empRecups = recups.filter(
        (r) => r.employee_id === emp.id && r.statut === "approuvee" && r.date_souhaitee,
      );
      // Entrées planning de récup déjà liées à une demande : à ignorer pour éviter le double comptage.
      const linkedRecupPlanningIds = new Set(
        empRecups.map((r) => (r as any).planning_entry_id).filter(Boolean),
      );
      const recupDatesByEmp = new Set(empRecups.map((r) => r.date_souhaitee!));

      // Congés / RTT pris (jours ouvrés sur la période)
      let congesPris = 0;
      let rttPris = 0;
      for (const a of empAbs) {
        if (a.type !== "conge_paye" && a.type !== "rtt") continue;
        const startD = a.date_debut > yearStart ? a.date_debut : yearStart;
        const endD = a.date_fin < yearEnd ? a.date_fin : yearEnd;
        if (startD > endD) continue;
        const s = new Date(`${startD}T00:00:00Z`);
        const e = new Date(`${endD}T00:00:00Z`);
        for (let dt = new Date(s); dt <= e; dt.setUTCDate(dt.getUTCDate() + 1)) {
          const iso = dt.toISOString().slice(0, 10);
          const yr = Number(iso.slice(0, 4));
          if (!isJourOuvre(iso, frenchHolidays(yr))) continue;
          if (a.type === "conge_paye") congesPris += 1;
          else rttPris += 1;
        }
      }

      for (const m of months) {
        const days = monthDays(m);
        const holidays = frenchHolidays(Number(m.slice(0, 4)));
        const ouvres = days.filter((d) => isJourOuvre(d, holidays));
        const ouvresSet = new Set(ouvres);
        const joursNeutralises: string[] = [];
        for (const a of empAbs) {
          if (!["conge_paye", "rtt", "parental", "sans_solde", "maladie"].includes(a.type)) continue;
          const start = new Date(`${a.date_debut}T00:00:00Z`);
          const end = new Date(`${a.date_fin}T00:00:00Z`);
          for (let dt = new Date(start); dt <= end; dt.setUTCDate(dt.getUTCDate() + 1)) {
            const iso = dt.toISOString().slice(0, 10);
            if (ouvresSet.has(iso)) joursNeutralises.push(iso);
          }
        }
        const empEntries = entries.filter(
          (e) =>
            e.employee_id === emp.id &&
            !linkedRecupPlanningIds.has(e.id) &&
            !(e.type === "recuperation" && planningEntryDays(e).some((d) => recupDatesByEmp.has(d))) &&
            planningEntryDays(e).some((d) => ouvresSet.has(d)),
        );
        const recupAsEntries = empRecups
          .filter((r) => r.date_souhaitee! >= days[0] && r.date_souhaitee! <= days[days.length - 1])
          .map((r) => ({
            id: r.id,
            employee_id: r.employee_id,
            agence_id: null,
            date_start: r.date_souhaitee!,
            date_end: r.date_souhaitee!,
            heure_debut: r.heure_debut ?? null,
            heure_fin: r.heure_fin ?? null,
            type: "recuperation" as const,
            note: null,
            group_id: null,
            pause_minutes: null,
            heures_recup: r.heures_demandees,
          }));
        const c = calcCompteurMensuel(
          [...empEntries, ...recupAsEntries],
          ouvres,
          hParJour,
          emp,
          undefined,
          joursNeutralises,
        );
        heuresSup += c.heuresSup;
        soldeAnnuel += c.solde;
        basePaieTotal += basePaieMensuelle(emp);
        baseReelleTotal += c.base;
        rttAcquisesTotal += c.rttAcquises ?? 0;
      }
      map.set(emp.id, {
        heuresSup: Math.round(heuresSup * 100) / 100,
        soldeAnnuel: Math.round(soldeAnnuel * 100) / 100,
        basePaie: Math.round(basePaieTotal * 100) / 100,
        baseReelle: Math.round(baseReelleTotal * 100) / 100,
        congesPris,
        rttPris,
        rttAcquises: Math.round(rttAcquisesTotal * 100) / 100,
      });
    }
    return map;
  }, [employees, entries, absences, recups, months, startDate, endDate]);

  // Détail mois par mois (solde + répartition par type d'événement en jours ouvrés)
  type MonthDetail = { solde: number; counts: Record<EventType, number>; ouvres: number };
  const monthDetailByEmp = useMemo(() => {
    const map = new Map<string, Map<string, MonthDetail>>();
    for (const emp of employees) {
      const hParJour = heuresContractuellesParJour(emp);
      const empAbs = absences.filter((a) => a.employee_id === emp.id);
      const empRecups = recups.filter(
        (r) => r.employee_id === emp.id && r.statut === "approuvee" && r.date_souhaitee && !(r as any).planning_entry_id,
      );
      const inner = new Map<string, MonthDetail>();
      for (const m of months) {
        const days = monthDays(m);
        const holidays = frenchHolidays(Number(m.slice(0, 4)));
        const ouvres = days.filter((d) => isJourOuvre(d, holidays));
        const ouvresSet = new Set(ouvres);
        const joursNeutralises: string[] = [];
        for (const a of empAbs) {
          if (!["conge_paye", "rtt", "parental", "sans_solde", "maladie"].includes(a.type)) continue;
          const s = new Date(`${a.date_debut}T00:00:00Z`);
          const e = new Date(`${a.date_fin}T00:00:00Z`);
          for (let dt = new Date(s); dt <= e; dt.setUTCDate(dt.getUTCDate() + 1)) {
            const iso = dt.toISOString().slice(0, 10);
            if (ouvresSet.has(iso)) joursNeutralises.push(iso);
          }
        }
        const empEntries = entries.filter(
          (e) => e.employee_id === emp.id && planningEntryDays(e).some((d) => ouvresSet.has(d)),
        );
        const recupAsEntries = empRecups
          .filter((r) => r.date_souhaitee! >= days[0] && r.date_souhaitee! <= days[days.length - 1])
          .map((r) => ({
            id: r.id, employee_id: r.employee_id, agence_id: null,
            date_start: r.date_souhaitee!, date_end: r.date_souhaitee!,
            heure_debut: r.heure_debut ?? null, heure_fin: r.heure_fin ?? null,
            type: "recuperation" as const, note: null, group_id: null,
            pause_minutes: null, heures_recup: r.heures_demandees,
          }));
        const c = calcCompteurMensuel(
          [...empEntries, ...recupAsEntries], ouvres, hParJour, emp, undefined, joursNeutralises,
        );
        const counts: Record<EventType, number> = {
          travail: 0, teletravail: 0, conge: 0, absent: 0, recup: 0, formation: 0, deplacement: 0,
        };
        for (const d of ouvres) {
          const abs = empAbs.find((a) => a.date_debut <= d && d <= a.date_fin);
          let ev: EventType | null = null;
          if (abs) ev = absenceToEvent(abs.type);
          else {
            const pe = entries.find((p) => p.employee_id === emp.id && planningEntryCoversDate(p, d));
            if (pe) ev = planningToEvent(pe.type);
          }
          if (ev) counts[ev] += 1;
        }
        inner.set(m, { solde: c.solde, counts, ouvres: ouvres.length });
      }
      map.set(emp.id, inner);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, entries, absences, recups, months]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vue annuelle"
        description="12 mois de planning consolidé par employé — congés, RTT, heures sup et solde"
        action={
          <Button asChild variant="outline">
            <Link to="/ops/equipe">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Link>
          </Button>
        }
      />

      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setStartMonth(addMonths(startMonth, -12))} title="Année précédente">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <label className="text-sm text-muted-foreground">Depuis</label>
        <Input
          type="month"
          value={startMonth}
          onChange={(e) => setStartMonth(e.target.value || "2026-05")}
          className="w-44"
        />
        <Button variant="outline" size="sm" onClick={() => setStartMonth(addMonths(startMonth, 12))} title="Année suivante">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground ml-2">
          {months[0]} → {months[months.length - 1]}
        </span>
        <div className="flex flex-wrap gap-2 ml-auto">
          {(Object.entries(EVENT_LABELS) as [EventType, string][]).map(([k, label]) => (
            <span key={k} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={`w-2.5 h-2.5 rounded-sm ${COLORS[k]}`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {loading ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Chargement…</Card>
      ) : employees.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Aucun employé actif</Card>
      ) : (
        <div className="space-y-4">
          {employees.map((emp) => {
            const cum = cumulByEmp.get(emp.id);
            const detail = monthDetailByEmp.get(emp.id);
            if (!cum || !detail) return null;
            const hasRtt = (emp.jours_rtt_par_an ?? 0) > 0;
            return (
              <Card key={emp.id} className="p-4 md:p-5">
                {/* En-tête : nom + KPIs */}
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b">
                  <div>
                    <Link
                      to="/ops/equipe/$id"
                      params={{ id: emp.id }}
                      className="text-lg font-display hover:underline"
                    >
                      {emp.prenom} {emp.nom}
                    </Link>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{heuresContractuellesParJour(emp)}h / jour</span>
                      {hasRtt && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase tracking-wide text-[10px] font-medium">
                          RTT
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    <KpiTile
                      label="Solde annuel"
                      value={fmtH(cum.soldeAnnuel)}
                      tone={cum.soldeAnnuel > 0 ? "positive" : cum.soldeAnnuel < 0 ? "negative" : "muted"}
                    />
                    <KpiTile
                      label="Heures sup"
                      value={`${cum.heuresSup}h`}
                      tone={cum.heuresSup > 0 ? "positive" : "muted"}
                    />
                    <KpiTile
                      label="Congés payés"
                      value={`${cum.congesPris}${(emp.jours_conges_par_an ?? 0) > 0 ? ` / ${emp.jours_conges_par_an}` : ""}`}
                      sub="jours"
                    />
                    <KpiTile
                      label="RTT"
                      value={hasRtt ? `${cum.rttPris} / ${emp.jours_rtt_par_an}` : "—"}
                      sub={hasRtt ? `${cum.rttAcquises}h acquises` : undefined}
                    />
                  </div>
                </div>

                {/* Bandeau 12 mois */}
                <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
                  {months.map((m) => {
                    const d = detail.get(m)!;
                    const total = d.ouvres || 1;
                    const monthLabel = MONTH_LABELS[Number(m.slice(5)) - 1];
                    const yr = m.slice(2, 4);
                    return (
                      <div
                        key={m}
                        className="rounded-md border bg-muted/20 p-2 hover:bg-muted/40 transition-colors"
                        title={
                          `${monthLabel} 20${yr}\n` +
                          (Object.entries(d.counts) as [EventType, number][])
                            .filter(([, n]) => n > 0)
                            .map(([k, n]) => `• ${EVENT_LABELS[k]} : ${n}j`)
                            .join("\n")
                        }
                      >
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
                          <span className="font-medium uppercase tracking-wide">{monthLabel}</span>
                          <span>{yr}</span>
                        </div>
                        {/* Barre empilée par type */}
                        <div className="flex h-1.5 rounded-full overflow-hidden bg-border/40">
                          {(Object.keys(d.counts) as EventType[]).map((k) => {
                            const n = d.counts[k];
                            if (!n) return null;
                            return (
                              <div
                                key={k}
                                className={COLORS[k]}
                                style={{ width: `${(n / total) * 100}%` }}
                              />
                            );
                          })}
                        </div>
                        <div className="mt-1.5 flex items-baseline justify-between gap-1">
                          <span className="text-[10px] text-muted-foreground">{d.ouvres}j ouvr.</span>
                          <span
                            className={
                              "text-xs tabular-nums font-medium " +
                              (d.solde > 0
                                ? "text-emerald-600"
                                : d.solde < 0
                                  ? "text-red-500"
                                  : "text-muted-foreground")
                            }
                          >
                            {fmtH(d.solde)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Chaque mois affiche la répartition des jours ouvrés par type d'activité et le solde d'heures
        (au-dessus ou en-dessous de la base contractuelle). Les heures sup cumulées sur l'année déclenchent
        les droits à rattrapage. Jours fériés, congés payés, RTT et arrêts maladie ne creusent pas le solde.
      </p>
    </div>
  );
}

function KpiTile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "positive" | "negative" | "muted";
}) {
  const toneCls =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-red-500"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div className="rounded-md border bg-background px-3 py-2 min-w-[110px]">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-display tabular-nums leading-tight ${toneCls}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

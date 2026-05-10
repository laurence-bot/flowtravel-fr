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
      const empRecups = recups.filter((r) => r.employee_id === emp.id && r.statut === "approuvee" && r.date_souhaitee);

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
          (e) => e.employee_id === emp.id && planningEntryDays(e).some((d) => ouvresSet.has(d)),
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

  // Agrège pour chaque jour le type d'événement le plus parlant.
  const cellEvent = (empId: string, date: string): EventType | null => {
    const abs = absences.find((a) => a.employee_id === empId && a.date_debut <= date && date <= a.date_fin);
    if (abs) return absenceToEvent(abs.type);
    const e = entries.find(
      (p) => p.employee_id === empId && planningEntryCoversDate(p, date),
    );
    if (e) return planningToEvent(e.type);
    return null;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vue annuelle"
        description="Planning consolidé sur 12 mois — heures sup à rattraper et solde de l'année"
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => setStartMonth(addMonths(startMonth, -12))}
          title="Année précédente"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <label className="text-sm text-muted-foreground">Depuis</label>
        <Input
          type="month"
          value={startMonth}
          onChange={(e) => setStartMonth(e.target.value || "2026-05")}
          className="w-44"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setStartMonth(addMonths(startMonth, 12))}
          title="Année suivante"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground ml-2">
          {months[0]} → {months[months.length - 1]}
        </span>
        <div className="flex flex-wrap gap-1.5 ml-auto">
          {(Object.entries(COLORS) as [EventType, string][]).map(([k, c]) => (
            <span key={k} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className={`w-2 h-2 rounded-sm ${c}`} />
              {k}
            </span>
          ))}
        </div>
      </div>

      <Card className="p-0 overflow-auto">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : (
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="bg-muted/30 border-b">
                <th className="text-left px-2 py-2 sticky left-0 bg-muted/30 z-10 min-w-[140px]">Employé</th>
                {months.map((m) => (
                  <th
                    key={m}
                    colSpan={monthDays(m).length}
                    className="text-center font-medium px-1 py-1 border-l text-muted-foreground"
                  >
                    {MONTH_LABELS[Number(m.slice(5)) - 1]} {m.slice(2, 4)}
                  </th>
                ))}
                <th className="px-2 py-1 border-l text-right min-w-[100px]">H. sup an.</th>
                <th className="px-2 py-1 border-l text-right min-w-[90px]">Solde an.</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 && (
                <tr>
                  <td colSpan={months.reduce((s, m) => s + monthDays(m).length, 0) + 3} className="text-center p-10 text-muted-foreground">
                    Aucun employé actif
                  </td>
                </tr>
              )}
              {employees.map((emp) => {
                const cum = cumulByEmp.get(emp.id);
                return (
                  <tr key={emp.id} className="border-b hover:bg-muted/10">
                    <td className="px-2 py-1 sticky left-0 bg-background z-10 font-medium whitespace-nowrap">
                      <Link to="/ops/equipe/$id" params={{ id: emp.id }} className="hover:underline">
                        {emp.prenom} {emp.nom}
                      </Link>
                      {(emp.jours_rtt_par_an ?? 0) > 0 && (
                        <span className="ml-1 text-[9px] uppercase text-muted-foreground">RTT</span>
                      )}
                    </td>
                    {months.map((m) => {
                      const days = monthDays(m);
                      return days.map((d) => {
                        const dt = new Date(`${d}T00:00:00Z`);
                        const dow = dt.getUTCDay();
                        const wk = dow === 0 || dow === 6;
                        const ev = !wk ? cellEvent(emp.id, d) : null;
                        const isFirstOfMonth = d.endsWith("-01");
                        return (
                          <td
                            key={d}
                            title={`${d}${ev ? " · " + ev : ""}`}
                            className={[
                              "p-0 align-middle",
                              isFirstOfMonth ? "border-l border-l-border/60" : "border-l border-border/10",
                              wk ? "bg-muted/30" : "",
                            ].join(" ")}
                            style={{ width: 6, minWidth: 6 }}
                          >
                            <Link
                              to="/ops/equipe/planning"
                              className="block w-full"
                              style={{ height: 18 }}
                            >
                              {ev && <div className={`w-full h-full ${COLORS[ev]}`} />}
                            </Link>
                          </td>
                        );
                      });
                    })}
                    <td className="px-2 py-1 border-l text-right tabular-nums font-medium">
                      {cum ? (
                        <span className={cum.heuresSup > 0 ? "text-emerald-600" : "text-muted-foreground"}>
                          {cum.heuresSup}h
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-2 py-1 border-l text-right tabular-nums font-medium">
                      {cum ? (
                        <span
                          className={
                            cum.soldeAnnuel > 0
                              ? "text-emerald-600"
                              : cum.soldeAnnuel < 0
                                ? "text-red-500"
                                : "text-muted-foreground"
                          }
                        >
                          {fmtH(cum.soldeAnnuel)}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        Les heures sup affichées correspondent au cumul, mois par mois, des heures réalisées au-dessus de
        la base contractuelle réelle. Elles déclenchent les droits à rattrapage en jours ou en heures.
        Les jours férié, congés payés, RTT et arrêts maladie ne creusent pas le solde.
      </p>
    </div>
  );
}

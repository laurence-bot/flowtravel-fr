import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Plus, Users, Settings as SettingsIcon, Download, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import {
  listEmployees,
  createEmployee,
  listAbsences,
  listPlanning,
  listCompteurs,
  listRecupDemandes,
  frenchHolidays,
  isJourOuvre,
  calcCompteurMensuel,
  heuresContractuellesParJour,
  basePaieMensuelle,
  planningEntryDays,
  deletePlanning,
  deleteAbsence,
  upsertCompteur,
  clearCompteursMois,
  CONTRACT_TYPE_LABELS,
  type Employee,
  type ContractType,
  type Absence,
  type PlanningEntry,
  type CompteurHeures,
  type RecupDemande,
} from "@/lib/hr";
import { toast } from "sonner";

export const Route = createFileRoute("/ops/equipe/")({
  component: EquipeIndex,
});

function daysInMonth(month: string): string[] {
  const d = new Date(`${month}-01`);
  const end = new Date(d);
  end.setMonth(end.getMonth() + 1);
  const out: string[] = [];
  for (let x = new Date(d); x < end; x.setDate(x.getDate() + 1)) out.push(x.toISOString().slice(0, 10));
  return out;
}

function isWeekend(d: string) {
  const day = new Date(d).getDay();
  return day === 0 || day === 6;
}
const DAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];

type EventType = "travail" | "teletravail" | "conge" | "absent" | "recup" | "formation" | "deplacement" | "autre";
const EVENT_COLORS: Record<EventType, { bg: string; text: string; label: string; abbr: string }> = {
  travail: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Travail", abbr: "TR" },
  teletravail: { bg: "bg-sky-100", text: "text-sky-700", label: "Télétravail", abbr: "TL" },
  conge: { bg: "bg-violet-100", text: "text-violet-700", label: "Congé", abbr: "CG" },
  absent: { bg: "bg-orange-100", text: "text-orange-700", label: "Absent", abbr: "AB" },
  recup: { bg: "bg-purple-100", text: "text-purple-700", label: "Récup", abbr: "RC" },
  formation: { bg: "bg-amber-100", text: "text-amber-700", label: "Formation", abbr: "FO" },
  deplacement: { bg: "bg-pink-100", text: "text-pink-700", label: "Déplacement", abbr: "DP" },
  autre: { bg: "bg-zinc-100", text: "text-zinc-600", label: "Autre", abbr: "AU" },
};

function absenceToEventType(type: string): EventType {
  if (["conge_paye", "rtt", "parental", "sans_solde"].includes(type)) return "conge";
  if (type === "recup") return "recup";
  if (type === "formation") return "formation";
  return "absent";
}
function planningToEventType(type: string): EventType {
  if (type === "travail") return "travail";
  if (type === "teletravail") return "teletravail";
  if (type === "recuperation") return "recup";
  if (type === "formation") return "formation";
  if (type === "deplacement") return "deplacement";
  return "autre";
}
function fmtH(h: number): string {
  const sign = h < 0 ? "−" : h > 0 ? "+" : "";
  const abs = Math.abs(h);
  const hh = Math.floor(abs);
  const mm = Math.round((abs - hh) * 60);
  return `${sign}${hh}h${mm > 0 ? mm : ""}`;
}

function EquipeIndex() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [planning, setPlanning] = useState<PlanningEntry[]>([]);
  const [compteurs, setCompteurs] = useState<CompteurHeures[]>([]);
  const [recups, setRecups] = useState<RecupDemande[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const days = useMemo(() => daysInMonth(month), [month]);
  const holidays = useMemo(() => frenchHolidays(Number(month.slice(0, 4))), [month]);
  const joursOuvres = useMemo(() => days.filter((d) => isJourOuvre(d, holidays)), [days, holidays]);

  const reload = async () => {
    setLoading(true);
    try {
      // Invalide les compteurs stockés du mois → force un recalcul propre
      // (sinon les soldes restent figés après une suppression de planning).
      await clearCompteursMois(month).catch(() => {});
      const [emps, abs, plan, recs] = await Promise.all([
        listEmployees(),
        listAbsences(),
        listPlanning(days[0], days[days.length - 1]),
        listRecupDemandes(month),
      ]);
      const actifs = emps.filter((e) => e.actif);
      const approvedAbs = abs.filter((a) => a.statut === "approuvee" || a.statut === "signee");
      // Recalcule les compteurs côté serveur (mêmes données que la vue planning)
      const ouvres = days.filter((d) => isJourOuvre(d, holidays));
      const ouvresSet = new Set(ouvres);
      const linkedRecupPlanningIds = new Set(recs.map((r) => r.planning_entry_id).filter(Boolean));
      const approvedRecupDatesByEmp = new Map<string, Set<string>>();
      for (const r of recs) {
        if (r.statut !== "approuvee" || !r.date_souhaitee) continue;
        const set = approvedRecupDatesByEmp.get(r.employee_id) ?? new Set<string>();
        set.add(r.date_souhaitee);
        approvedRecupDatesByEmp.set(r.employee_id, set);
      }
      await Promise.all(
        actifs.map(async (emp) => {
          const recupDates = approvedRecupDatesByEmp.get(emp.id) ?? new Set<string>();
          const empEntries = plan.filter(
            (e) =>
              e.employee_id === emp.id &&
              !linkedRecupPlanningIds.has(e.id) &&
              !(e.type === "recuperation" && planningEntryDays(e).some((d) => recupDates.has(d))),
          );
          const empAbs = approvedAbs.filter((a) => a.employee_id === emp.id);
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
          const empRecups = recs
            .filter((r) => r.employee_id === emp.id && r.statut === "approuvee" && r.date_souhaitee)
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
          const hParJour = heuresContractuellesParJour(emp);
          const c = calcCompteurMensuel(
            [...empEntries, ...empRecups],
            ouvres,
            hParJour,
            emp,
            undefined,
            joursNeutralises,
          );
          await upsertCompteur(emp.id, month, c.realisees, c.base);
        }),
      );
      const comps = await listCompteurs(month);
      setEmployees(actifs);
      setAbsences(approvedAbs);
      setPlanning(plan);
      setCompteurs(comps);
      setRecups(recs);
    } catch (e: any) {
      toast.error(e.message ?? "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, [month]);

  const prevMonth = () => {
    const d = new Date(`${month}-01`);
    d.setMonth(d.getMonth() - 1);
    setMonth(d.toISOString().slice(0, 7));
  };
  const nextMonth = () => {
    const d = new Date(`${month}-01`);
    d.setMonth(d.getMonth() + 1);
    setMonth(d.toISOString().slice(0, 7));
  };

  const cellEvent = (empId: string, date: string): EventType | null => {
    const absence = absences.find((a) => a.employee_id === empId && a.date_debut <= date && date <= a.date_fin);
    if (absence) return absenceToEventType(absence.type);
    const plan = planning.find((p) => p.employee_id === empId && p.date_start <= date && date <= p.date_end);
    if (plan) return planningToEventType(plan.type);
    return null;
  };

  // Source d'une cellule (pour suppression depuis la vue d'ensemble)
  type CellSource =
    | { kind: "absence"; id: string; label: string; range: string }
    | { kind: "planning"; id: string; label: string; range: string };
  const cellSource = (empId: string, date: string): CellSource | null => {
    const absence = absences.find((a) => a.employee_id === empId && a.date_debut <= date && date <= a.date_fin);
    if (absence) {
      return {
        kind: "absence",
        id: absence.id,
        label: `Absence : ${absence.type}${absence.motif ? " — " + absence.motif : ""}`,
        range:
          absence.date_debut === absence.date_fin ? absence.date_debut : `${absence.date_debut} → ${absence.date_fin}`,
      };
    }
    const plan = planning.find((p) => p.employee_id === empId && p.date_start <= date && date <= p.date_end);
    if (plan) {
      return {
        kind: "planning",
        id: plan.id,
        label: `Planning : ${plan.type}${plan.note ? " — " + plan.note : ""}`,
        range: plan.date_start === plan.date_end ? plan.date_start : `${plan.date_start} → ${plan.date_end}`,
      };
    }
    return null;
  };

  // État du dialog de suppression
  const [delTarget, setDelTarget] = useState<{ source: CellSource; empName: string; date: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!delTarget) return;
    setDeleting(true);
    try {
      if (delTarget.source.kind === "absence") {
        await deleteAbsence(delTarget.source.id);
      } else {
        await deletePlanning(delTarget.source.id);
      }
      toast.success("Entrée supprimée");
      setDelTarget(null);
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Suppression impossible");
    } finally {
      setDeleting(false);
    }
  };

  const recapRows = useMemo(
    () =>
      employees.map((emp) => {
        const compteur = compteurs.find((c) => c.employee_id === emp.id);
        const empAbs = absences.filter((a) => a.employee_id === emp.id);
        const joursConge = empAbs
          .filter((a) => ["conge_paye", "rtt", "parental", "sans_solde"].includes(a.type))
          .reduce((s, a) => s + (a.nb_jours ?? 0), 0);
        const joursMaladie = empAbs.filter((a) => a.type === "maladie").reduce((s, a) => s + (a.nb_jours ?? 0), 0);
        const heuresRecupPrises = recups
          .filter((r) => r.employee_id === emp.id && r.statut === "approuvee")
          .reduce((s, r) => s + (r.heures_demandees ?? 0), 0);
        const hParJour = heuresContractuellesParJour(emp);
        // Base = forfait mensualisé paie (jours rythme/sem × h/jour × 52/12)
        // Lisa 37h30 → 162,5h ; les fériés chômés sont neutralisés côté réalisé.
        const ouvresSet = new Set(joursOuvres);
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
        const linkedRecupPlanningIds = new Set(recups.map((r) => r.planning_entry_id).filter(Boolean));
        const approvedRecupDates = new Set(
          recups
            .filter((r) => r.employee_id === emp.id && r.statut === "approuvee" && r.date_souhaitee)
            .map((r) => r.date_souhaitee!),
        );
        const empPlanning = planning.filter(
          (p) =>
            p.employee_id === emp.id &&
            !linkedRecupPlanningIds.has(p.id) &&
            !(p.type === "recuperation" && planningEntryDays(p).some((d) => approvedRecupDates.has(d))),
        );
        // Injecte les récups approuvées comme entrées planning de type "recuperation"
        const empRecups = recups
          .filter((r) => r.employee_id === emp.id && r.statut === "approuvee" && r.date_souhaitee)
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
        const empPlanningAvecRecups = [...empPlanning, ...empRecups];
        const calc = calcCompteurMensuel(
          empPlanningAvecRecups,
          joursOuvres,
          hParJour,
          emp,
          undefined,
          joursNeutralises,
        );
        return {
          nom: `${emp.prenom} ${emp.nom}`,
          poste: emp.poste ?? "",
          contrat: emp.type_contrat,
          heures_contractuelles: compteur?.heures_contractuelles ?? 0,
          // H. réalisées = heures réellement saisies dans le planning.
          // Les jours fériés ne sont pas ajoutés ici.
          // Déplacement/formation sont visibles et comptés 7h max/jour.
          heures_realisees: Math.round((calc.travailReel + calc.depForm) * 100) / 100,
          // Solde = RTT/heures à récupérer - récupérations prises.
          solde: calc.solde,
          jours_conge: joursConge,
          jours_maladie: joursMaladie,
          // Colonne Récup (H) = heures disponibles à récupérer en fin de mois.
          heures_recup: Math.max(0, Math.round(calc.solde * 100) / 100),
          heures_recup_prises: heuresRecupPrises,
          rtt_acquises: calc.rttAcquises,
          // Contexte explicatif
          jours_ouvres: calc.joursRythme,
          h_par_jour: hParJour,
          heures_brutes: calc.base,
          base_paie: basePaieMensuelle(emp),
          a_rtt: (emp.jours_rtt_par_an ?? 0) > 0,
        };
      }),
    [employees, compteurs, absences, recups, joursOuvres, planning],
  );

  const exportRecap = () => {
    const header = "Nom,Poste,Contrat,H. contractuelles,H. réalisées,Solde,Jours congé,Jours maladie,H. récup\n";
    const rows = recapRows
      .map(
        (r) =>
          `"${r.nom}","${r.poste}","${r.contrat}",${r.heures_contractuelles},${r.heures_realisees},${r.solde},${r.jours_conge},${r.jours_maladie},${r.heures_recup}`,
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recap-rh-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pendingRecups = recups.filter((r) => r.statut === "demande").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Équipe RH"
        description="Calendrier consolidé, présences, absences et récap mensuel"
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/ops/equipe/annee">Vue annuelle</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/ops/equipe/parametres">
                <SettingsIcon className="h-4 w-4 mr-2" />
                Paramètres
              </Link>
            </Button>
            <NewEmployeeDialog open={open} onOpenChange={setOpen} onCreated={reload} />
          </div>
        }
      />

      {pendingRecups > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800">
          <span className="font-medium">
            {pendingRecups} demande{pendingRecups > 1 ? "s" : ""} de récupération en attente
          </span>
          <Link to="/ops/equipe/absences" className="underline ml-auto">
            Traiter →
          </Link>
        </div>
      )}

      <Tabs defaultValue="calendrier">
        <TabsList>
          <TabsTrigger value="calendrier">Calendrier consolidé</TabsTrigger>
          <TabsTrigger value="liste">Employés</TabsTrigger>
          <TabsTrigger value="recap">Récap mensuel</TabsTrigger>
        </TabsList>

        {/* Calendrier consolidé */}
        <TabsContent value="calendrier" className="space-y-4 mt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
            <Button variant="outline" size="sm" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="flex flex-wrap gap-1.5 ml-2">
              {(Object.entries(EVENT_COLORS) as [EventType, (typeof EVENT_COLORS)[EventType]][]).map(([k, v]) => (
                <span
                  key={k}
                  className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded ${v.bg} ${v.text}`}
                >
                  {v.label}
                </span>
              ))}
            </div>
          </div>

          <Card className="p-0 overflow-auto">
            {loading ? (
              <div className="p-10 text-center text-muted-foreground text-sm">Chargement…</div>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/30 border-b">
                    <th className="text-left px-3 py-2 sticky left-0 bg-muted/30 z-10 min-w-[130px]">Employé</th>
                    {days.map((d) => {
                      const dt = new Date(d);
                      const wk = isWeekend(d);
                      const ferie = holidays.has(d);
                      const today = d === new Date().toISOString().slice(0, 10);
                      return (
                        <th
                          key={d}
                          className={[
                            "px-0.5 py-1 font-normal w-[36px] min-w-[36px] max-w-[36px] border-l border-border/30 text-center",
                            wk || ferie ? "bg-muted/40 text-muted-foreground" : "",
                            today ? "bg-primary/10" : "",
                          ].join(" ")}
                        >
                          <div className={`text-[9px] uppercase ${today ? "text-primary font-semibold" : ""}`}>
                            {DAY_LABELS[dt.getDay()]}
                          </div>
                          <div
                            className={`text-[11px] font-medium ${today ? "text-primary" : ""} ${ferie ? "underline decoration-dotted" : ""}`}
                          >
                            {dt.getDate()}
                          </div>
                        </th>
                      );
                    })}
                    <th className="px-2 py-1 border-l text-right min-w-[58px]">Solde</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.length === 0 && (
                    <tr>
                      <td colSpan={days.length + 2} className="text-center p-10 text-muted-foreground">
                        Aucun employé actif
                      </td>
                    </tr>
                  )}
                  {employees.map((emp) => {
                    const compteur = compteurs.find((c) => c.employee_id === emp.id);
                    const solde = compteur?.solde ?? 0;
                    return (
                      <tr key={emp.id} className="border-b hover:bg-muted/10">
                        <td className="px-3 py-2 sticky left-0 bg-background z-10 font-medium whitespace-nowrap">
                          <Link to="/ops/equipe/$id" params={{ id: emp.id }} className="hover:underline">
                            {emp.prenom} {emp.nom}
                          </Link>
                          {emp.poste && <div className="text-[10px] text-muted-foreground">{emp.poste}</div>}
                        </td>
                        {days.map((d) => {
                          const wk = isWeekend(d);
                          const ferie = holidays.has(d);
                          const event = !ferie ? cellEvent(emp.id, d) : null;
                          const col = event ? EVENT_COLORS[event] : null;
                          const src = event ? cellSource(emp.id, d) : null;
                          return (
                            <td
                              key={d}
                              className={[
                                "border-l border-border/30 text-center py-1",
                                wk || ferie ? "bg-muted/20" : "",
                              ].join(" ")}
                            >
                              {col && src ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDelTarget({
                                      source: src,
                                      empName: `${emp.prenom} ${emp.nom}`,
                                      date: d,
                                    })
                                  }
                                  title={`${src.label} — cliquer pour supprimer`}
                                  className={`inline-block w-[26px] h-[18px] rounded text-[8px] font-bold leading-[18px] ${col.bg} ${col.text} hover:ring-2 hover:ring-destructive/60 transition`}
                                >
                                  {col.abbr}
                                </button>
                              ) : col ? (
                                <span
                                  className={`inline-block w-[26px] h-[18px] rounded text-[8px] font-bold leading-[18px] ${col.bg} ${col.text}`}
                                >
                                  {col.abbr}
                                </span>
                              ) : null}
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 border-l text-right font-medium tabular-nums">
                          {compteur ? (
                            <span
                              className={
                                solde > 0 ? "text-emerald-600" : solde < 0 ? "text-red-500" : "text-muted-foreground"
                              }
                            >
                              {fmtH(solde)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </TabsContent>

        {/* Liste employés */}
        <TabsContent value="liste" className="mt-4">
          <Card className="p-0 overflow-hidden overflow-x-auto">
            {loading ? (
              <div className="p-10 text-center text-sm text-muted-foreground">Chargement…</div>
            ) : employees.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Aucun employé"
                description="Ajoutez votre premier employé."
                action={
                  <Button onClick={() => setOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter
                  </Button>
                }
              />
            ) : (
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Nom</th>
                    <th className="text-left px-4 py-3">Poste</th>
                    <th className="text-left px-4 py-3">Contrat</th>
                    <th className="text-left px-4 py-3">Embauche</th>
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-right px-4 py-3">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr key={e.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link to="/ops/equipe/$id" params={{ id: e.id }} className="font-medium hover:underline">
                          {e.prenom} {e.nom}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{e.poste ?? "—"}</td>
                      <td className="px-4 py-3">{CONTRACT_TYPE_LABELS[e.type_contrat]}</td>
                      <td className="px-4 py-3 text-muted-foreground">{e.date_embauche ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{e.email ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs">
                          Actif
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </TabsContent>

        {/* Récap mensuel */}
        <TabsContent value="recap" className="space-y-4 mt-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
              <Button variant="outline" size="sm" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" onClick={exportRecap}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV paie
            </Button>
          </div>
          <Card className="p-0 overflow-auto">
            {loading ? (
              <div className="p-10 text-center text-muted-foreground text-sm">Chargement…</div>
            ) : (
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Employé</th>
                    <th className="text-right px-4 py-3">
                      <span title="Mensualisation paie 35h (152h pour un temps plein) — sert au bulletin">
                        Base paie
                      </span>
                    </th>
                    <th className="text-right px-4 py-3">
                      <span title="Forfait contractuel réel : jours rythme × h/jour — pilote les alertes heures sup">
                        Base réelle
                      </span>
                    </th>
                    <th className="text-right px-4 py-3">H. réalisées</th>
                    <th className="text-right px-4 py-3">Solde</th>
                    <th className="text-right px-4 py-3">Congés (j)</th>
                    <th className="text-right px-4 py-3">Maladie (j)</th>
                    <th className="text-right px-4 py-3">Récup (h)</th>
                  </tr>
                </thead>
                <tbody>
                  {recapRows.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-4 py-3 font-medium">
                        {r.nom}
                        {r.poste && <span className="ml-2 text-xs text-muted-foreground">{r.poste}</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className="font-medium">{r.base_paie}h</span>
                        {r.a_rtt && <div className="text-[10px] text-muted-foreground">RTT</div>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className="font-medium">{r.heures_brutes}h</span>
                        <div className="text-[11px] text-muted-foreground">
                          {r.jours_ouvres}j × {r.h_par_jour}h
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.heures_realisees}h</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        <span
                          className={
                            r.solde > 0 ? "text-emerald-600" : r.solde < 0 ? "text-red-500" : "text-muted-foreground"
                          }
                        >
                          {fmtH(r.solde)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.jours_conge > 0 ? r.jours_conge : "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {r.jours_maladie > 0 ? r.jours_maladie : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {r.heures_recup > 0 ? `${r.heures_recup}h` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-muted/20 text-xs font-medium">
                  <tr>
                    <td className="px-4 py-2 text-muted-foreground">Total équipe</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {recapRows.reduce((s, r) => s + r.base_paie, 0)}h
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {recapRows.reduce((s, r) => s + r.heures_brutes, 0)}h
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {recapRows.reduce((s, r) => s + r.heures_realisees, 0)}h
                    </td>
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {recapRows.reduce((s, r) => s + r.jours_conge, 0)}j
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {recapRows.reduce((s, r) => s + r.jours_maladie, 0)}j
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {recapRows.reduce((s, r) => s + r.heures_recup, 0)}h
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de suppression depuis le calendrier consolidé */}
      <Dialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer cette entrée ?</DialogTitle>
          </DialogHeader>
          {delTarget && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Employé : </span>
                <span className="font-medium">{delTarget.empName}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Date : </span>
                <span className="font-medium">{delTarget.date}</span>
                {delTarget.source.range !== delTarget.date && (
                  <span className="text-muted-foreground"> (série complète : {delTarget.source.range})</span>
                )}
              </p>
              <p>
                <span className="text-muted-foreground">Type : </span>
                <span className="font-medium">{delTarget.source.label}</span>
              </p>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                ⚠️ La suppression est définitive. Si l'entrée couvre plusieurs jours, toute la série sera supprimée.
                Pensez à cliquer sur « Forcer le recalcul » du planning ensuite.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelTarget(null)} disabled={deleting}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              <Trash2 className="h-4 w-4 mr-2" />
              {deleting ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewEmployeeDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    prenom: "",
    nom: "",
    email: "",
    poste: "",
    type_contrat: "cdi" as ContractType,
    date_embauche: "",
    salaire_brut_mensuel: "",
    jours_conges_par_an: "25",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.prenom || !form.nom) {
      toast.error("Prénom et nom requis");
      return;
    }
    setSaving(true);
    try {
      await createEmployee({
        prenom: form.prenom,
        nom: form.nom,
        email: form.email || null,
        poste: form.poste || null,
        type_contrat: form.type_contrat,
        date_embauche: form.date_embauche || null,
        salaire_brut_mensuel: form.salaire_brut_mensuel ? Number(form.salaire_brut_mensuel) : null,
        jours_conges_par_an: Number(form.jours_conges_par_an) || 25,
      });
      toast.success("Employé ajouté");
      onOpenChange(false);
      setForm({
        prenom: "",
        nom: "",
        email: "",
        poste: "",
        type_contrat: "cdi",
        date_embauche: "",
        salaire_brut_mensuel: "",
        jours_conges_par_an: "25",
      });
      onCreated();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un employé
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvel employé</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prénom *</Label>
              <Input value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
            </div>
            <div>
              <Label>Nom *</Label>
              <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Poste</Label>
            <Input value={form.poste} onChange={(e) => setForm({ ...form, poste: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type de contrat</Label>
              <Select
                value={form.type_contrat}
                onValueChange={(v) => setForm({ ...form, type_contrat: v as ContractType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTRACT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date d'embauche</Label>
              <Input
                type="date"
                value={form.date_embauche}
                onChange={(e) => setForm({ ...form, date_embauche: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Salaire brut (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.salaire_brut_mensuel}
                onChange={(e) => setForm({ ...form, salaire_brut_mensuel: e.target.value })}
              />
            </div>
            <div>
              <Label>Congés/an (j)</Label>
              <Input
                type="number"
                step="0.5"
                value={form.jours_conges_par_an}
                onChange={(e) => setForm({ ...form, jours_conges_par_an: e.target.value })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "…" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

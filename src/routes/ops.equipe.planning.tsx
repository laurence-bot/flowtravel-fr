import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Trash2, Copy, AlertTriangle, Check, X, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import {
  listEmployees, listPlanning, upsertPlanning, deletePlanning,
  calcHeuresRealisees, upsertCompteur, listCompteurs, listRecupDemandes,
  createRecupDemande, approuverRecupDemande, refuserRecupDemande,
  alertesFinDeMois,
  PLANNING_TYPE_LABELS,
  type Employee, type PlanningEntry, type PlanningType,
  type CompteurHeures, type RecupDemande,
} from "@/lib/hr";
import { toast } from "sonner";

export const Route = createFileRoute("/ops/equipe/planning")({ component: PlanningPage });

const TYPE_COLORS: Record<PlanningType, { badge: string; dot: string }> = {
  travail:     { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  teletravail: { badge: "bg-sky-50 text-sky-700 border-sky-200",            dot: "bg-sky-500" },
  reunion:     { badge: "bg-violet-50 text-violet-700 border-violet-200",   dot: "bg-violet-500" },
  deplacement: { badge: "bg-orange-50 text-orange-700 border-orange-200",   dot: "bg-orange-500" },
  formation:   { badge: "bg-amber-50 text-amber-700 border-amber-200",      dot: "bg-amber-500" },
  autre:       { badge: "bg-zinc-50 text-zinc-500 border-zinc-200",         dot: "bg-zinc-400" },
};

const DAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];
const DAY_FULL = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

const REPEAT_OPTIONS = [
  { value: "none",        label: "Aucune répétition" },
  { value: "week",        label: "Chaque semaine (même jour)" },
  { value: "week2",       label: "1 semaine sur 2" },
  { value: "month_ouvre", label: "Tous les jours ouvrés du mois" },
];

function isWeekend(d: string) { const day = new Date(d).getDay(); return day === 0 || day === 6; }
function addDays(d: string, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }

function daysInMonth(month: string): string[] {
  const d = new Date(`${month}-01`);
  const end = new Date(d); end.setMonth(end.getMonth() + 1);
  const out: string[] = [];
  for (let x = new Date(d); x < end; x.setDate(x.getDate() + 1))
    out.push(x.toISOString().slice(0, 10));
  return out;
}

function getISOWeek(d: Date): number {
  const tmp = new Date(d);
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  return 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function expandDates(dateDebut: string, repeat: string, month: string): string[] {
  const monthDays = daysInMonth(month);
  if (repeat === "none") return [dateDebut];
  if (repeat === "month_ouvre") return monthDays.filter(d => !isWeekend(d));
  if (repeat === "week") {
    const targetDay = new Date(dateDebut).getDay();
    return monthDays.filter(d => new Date(d).getDay() === targetDay);
  }
  if (repeat === "week2") {
    const targetDay = new Date(dateDebut).getDay();
    const matching = monthDays.filter(d => new Date(d).getDay() === targetDay);
    const startWeek = getISOWeek(new Date(dateDebut));
    return matching.filter(d => (getISOWeek(new Date(d)) - startWeek) % 2 === 0);
  }
  return [dateDebut];
}

function fmtH(h: number): string {
  const sign = h < 0 ? "-" : "+";
  const abs = Math.abs(h);
  const hh = Math.floor(abs);
  const mm = Math.round((abs - hh) * 60);
  return `${sign}${hh}h${mm > 0 ? mm : ""}`;
}

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const JS_DAY_TO_IDX: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 };

type JourConfig = { actif: boolean; heure_debut: string; heure_fin: string; pause_minutes: string };
type WeekConfig = { [jour: number]: JourConfig };

const DEFAULT_JOUR: JourConfig = { actif: true, heure_debut: "09:00", heure_fin: "17:30", pause_minutes: "30" };
const EMPTY_WEEK: WeekConfig = Object.fromEntries(
  [0, 1, 2, 3, 4, 5, 6].map(i => [i, { ...DEFAULT_JOUR, actif: i < 5 }])
) as WeekConfig;

type FormMode = "simple" | "semaine_type";

type FormState = {
  mode: FormMode;
  editId: string | null;
  employee_id: string;
  date_debut: string;
  date_fin: string;
  type: PlanningType;
  heure_debut: string;
  heure_fin: string;
  pause_minutes: string;
  note: string;
  repeat: string;
  semaine_a: WeekConfig;
  semaine_b: WeekConfig;
  utilise_semaine_b: boolean;
  mois_cible: string;
};

const EMPTY_FORM: FormState = {
  mode: "simple",
  editId: null,
  employee_id: "",
  date_debut: new Date().toISOString().slice(0, 10),
  date_fin: "",
  type: "travail",
  heure_debut: "09:00",
  heure_fin: "17:30",
  pause_minutes: "30",
  note: "",
  repeat: "none",
  semaine_a: { ...EMPTY_WEEK },
  semaine_b: { ...EMPTY_WEEK },
  utilise_semaine_b: false,
  mois_cible: new Date().toISOString().slice(0, 7),
};

function generateEntriesFromWeekConfig(
  employeeId: string, month: string,
  semaineA: WeekConfig, semaineB: WeekConfig,
  utiliseSemaineB: boolean, type: PlanningType,
) {
  const days = daysInMonth(month);
  return days.flatMap(dateStr => {
    const date = new Date(dateStr);
    const jourIdx = JS_DAY_TO_IDX[date.getDay()];
    const isoWeek = getISOWeek(date);
    const config = utiliseSemaineB
      ? (isoWeek % 2 === 1 ? semaineA[jourIdx] : semaineB[jourIdx])
      : semaineA[jourIdx];
    if (!config?.actif) return [];
    return [{
      employee_id: employeeId,
      date_jour: dateStr,
      type,
      heure_debut: config.heure_debut || null,
      heure_fin: config.heure_fin || null,
      note: null,
    }];
  });
}

function WeekGrid({ label, config, onChange }: { label: string; config: WeekConfig; onChange: (cfg: WeekConfig) => void }) {
  const update = (jourIdx: number, patch: Partial<JourConfig>) =>
    onChange({ ...config, [jourIdx]: { ...config[jourIdx], ...patch } });
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="rounded-lg border overflow-hidden">
        {[0, 1, 2, 3, 4, 5, 6].map(i => {
          const jour = config[i];
          return (
            <div key={i} className={`flex items-center gap-3 px-3 py-2 border-b last:border-b-0 transition-colors ${jour.actif ? "bg-background" : "bg-muted/30"}`}>
              <label className="flex items-center gap-2 w-24 cursor-pointer shrink-0">
                <input type="checkbox" checked={jour.actif} onChange={e => update(i, { actif: e.target.checked })} className="rounded" />
                <span className={`text-sm font-medium ${!jour.actif ? "text-muted-foreground" : ""}`}>{JOURS[i]}</span>
              </label>
              {jour.actif ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input type="time" value={jour.heure_debut} onChange={e => update(i, { heure_debut: e.target.value })} className="h-7 text-xs w-24" />
                  <span className="text-muted-foreground text-xs">→</span>
                  <Input type="time" value={jour.heure_fin} onChange={e => update(i, { heure_fin: e.target.value })} className="h-7 text-xs w-24" />
                  <Select value={jour.pause_minutes} onValueChange={v => update(i, { pause_minutes: v })}>
                    <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Pas de pause</SelectItem>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="45">45 min</SelectItem>
                      <SelectItem value="60">1h</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground italic">Repos</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlanningPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entries, setEntries] = useState<PlanningEntry[]>([]);
  const [compteurs, setCompteurs] = useState<CompteurHeures[]>([]);
  const [recups, setRecups] = useState<RecupDemande[]>([]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ emp: Employee; date: string } | null>(null);
  const [tab, setTab] = useState("planning");

  const [recupOpen, setRecupOpen] = useState(false);
  const [recupForm, setRecupForm] = useState({
    employee_id: "", type: "heures" as RecupDemande["type"],
    heures_demandees: "7", date_souhaitee: "", motif: "",
  });

  const load = async () => {
    const days = daysInMonth(month);
    const [emps, plan, comps, recs] = await Promise.all([
      listEmployees(),
      listPlanning(days[0], days[days.length - 1]),
      listCompteurs(month),
      listRecupDemandes(month),
    ]);
    const actifs = emps.filter(e => e.actif);
    setEmployees(actifs);
    setEntries(plan);
    setRecups(recs);
    await Promise.all(actifs.map(async emp => {
      const empEntries = plan.filter(e => e.employee_id === emp.id);
      const realisees = calcHeuresRealisees(empEntries);
      const contractuelles = 35 * (days.filter(d => !isWeekend(d)).length / 5);
      await upsertCompteur(emp.id, month, realisees, Math.round(contractuelles * 100) / 100);
    }));
    setCompteurs(await listCompteurs(month));
  };

  useEffect(() => { load().catch(e => toast.error(e.message)); }, [month]);

  const days = daysInMonth(month);
  const cellFor = (empId: string, date: string) =>
    entries.filter(e => e.employee_id === empId && e.date_jour === date);

  const openAdd = (emp?: Employee, date?: string) => {
    setForm({ ...EMPTY_FORM, employee_id: emp?.id ?? "", date_debut: date ?? new Date().toISOString().slice(0, 10) });
    setSelectedCell(emp && date ? { emp, date } : null);
    setOpen(true);
  };

  const openEdit = (e: React.MouseEvent, entry: PlanningEntry, emp: Employee) => {
    e.stopPropagation();
    setSelectedCell({ emp, date: entry.date_jour });
    setForm({
      ...EMPTY_FORM,
      editId: entry.id,
      employee_id: entry.employee_id,
      date_debut: entry.date_jour,
      type: entry.type,
      heure_debut: entry.heure_debut ?? "09:00",
      heure_fin: entry.heure_fin ?? "17:30",
      pause_minutes: "30",
      note: entry.note ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    const empId = selectedCell?.emp.id ?? form.employee_id;
    if (!empId) { toast.error("Employé requis"); return; }
    setSaving(true);
    try {
      if (form.editId) {
        await deletePlanning(form.editId);
        await upsertPlanning({
          employee_id: empId,
          date_jour: form.date_debut,
          type: form.type,
          heure_debut: form.heure_debut || null,
          heure_fin: form.heure_fin || null,
          note: form.note || null,
        });
        toast.success("Entrée mise à jour");
        setOpen(false);
        setForm(EMPTY_FORM);
        load();
        return;
      }

      if (form.mode === "semaine_type") {
        const toCreate = generateEntriesFromWeekConfig(empId, form.mois_cible, form.semaine_a, form.semaine_b, form.utilise_semaine_b, form.type);
        if (!toCreate.length) { toast.error("Aucun jour actif sélectionné"); setSaving(false); return; }
        await Promise.all(toCreate.map(e => upsertPlanning(e)));
        toast.success(`${toCreate.length} entrée(s) générée(s) pour ${form.mois_cible}`);
      } else {
        if (!form.date_debut) { toast.error("Date requise"); setSaving(false); return; }

        let dates: string[];
        if ((form.type === "deplacement" || form.type === "formation") && form.date_fin && form.date_fin >= form.date_debut) {
          dates = daysInMonth(month).filter(d => d >= form.date_debut && d <= form.date_fin && !isWeekend(d));
          if (!dates.length) dates = [form.date_debut];
        } else {
          dates = expandDates(form.date_debut, form.repeat, month);
        }

        // ── Détection de conflits ──────────────────────────────────────
        const EXCLUSIFS: PlanningType[] = ["travail", "teletravail", "deplacement", "formation"];
        if (EXCLUSIFS.includes(form.type)) {
          const conflictDates = dates.filter(d => {
            const existing = cellFor(empId, d);
            return existing.some(e => EXCLUSIFS.includes(e.type) && e.id !== form.editId);
          });

          if (conflictDates.length > 0) {
            const conflictEntries = conflictDates.flatMap(d =>
              cellFor(empId, d).filter(e => EXCLUSIFS.includes(e.type))
            );
            const confirmed = window.confirm(
              `Conflit détecté sur ${conflictDates.length} jour(s) :\n` +
              conflictDates.map(d => {
                const existing = cellFor(empId, d).filter(e => EXCLUSIFS.includes(e.type));
                return `• ${d} : ${existing.map(e => PLANNING_TYPE_LABELS[e.type]).join(", ")} → remplacé par ${PLANNING_TYPE_LABELS[form.type]}`;
              }).join("\n") +
              `\n\nVoulez-vous remplacer les entrées existantes ?`
            );
            if (!confirmed) { setSaving(false); return; }
            await Promise.all(conflictEntries.map(e => deletePlanning(e.id)));
          }
        }
        // ──────────────────────────────────────────────────────────────

        await Promise.all(dates.map(date =>
          upsertPlanning({ employee_id: empId, date_jour: date, type: form.type, heure_debut: form.heure_debut || null, heure_fin: form.heure_fin || null, note: form.note || null })
        ));
        toast.success(`${dates.length} entrée(s) ajoutée(s)`);
      }
      setOpen(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const del = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try { await deletePlanning(id); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const copyWeek = async (monday: string) => {
    const mon = new Date(monday);
    const sun = new Date(monday); sun.setDate(sun.getDate() + 6);
    const weekEntries = entries.filter(e => { const d = new Date(e.date_jour); return d >= mon && d <= sun; });
    if (!weekEntries.length) { toast.error("Aucune entrée cette semaine"); return; }
    try {
      await Promise.all(weekEntries.map(e =>
        upsertPlanning({ employee_id: e.employee_id, date_jour: addDays(e.date_jour, 7), type: e.type, heure_debut: e.heure_debut ?? null, heure_fin: e.heure_fin ?? null, note: e.note ?? null })
      ));
      toast.success(`${weekEntries.length} entrée(s) copiée(s)`);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const saveRecup = async () => {
    if (!recupForm.employee_id || !recupForm.heures_demandees) { toast.error("Champs requis"); return; }
    try {
      await createRecupDemande({ employee_id: recupForm.employee_id, mois: month, type: recupForm.type, heures_demandees: Number(recupForm.heures_demandees), date_souhaitee: recupForm.date_souhaitee || undefined, motif: recupForm.motif || undefined });
      toast.success("Demande créée");
      setRecupOpen(false);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const alertes = alertesFinDeMois(compteurs, employees);
  const empById = (id: string) => employees.find(e => e.id === id);

  const weeks: { days: string[]; weekNum: number }[] = [];
  let cur: string[] = [];
  days.forEach((d, i) => {
    cur.push(d);
    const dt = new Date(d);
    if (dt.getDay() === 0 || i === days.length - 1) {
      weeks.push({ days: cur, weekNum: getISOWeek(new Date(cur[0])) });
      cur = [];
    }
  });

  const pendingCount = recups.filter(r => r.statut === "demande").length;
  const isEditing = !!form.editId;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <Link to="/ops/equipe" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>

      <PageHeader
        title="Planning"
        description="Vue mensuelle, compteurs d'heures et récupérations"
        action={
          <div className="flex items-center gap-2">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
            <Button variant="outline" onClick={() => setRecupOpen(true)}>Récupération</Button>
            <Button onClick={() => openAdd()}>+ Ajouter</Button>
          </div>
        }
      />

      {alertes.length > 0 && (
        <Card className="p-4 border-amber-300 bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-amber-900">Alerte fin de mois — heures à poser</h3>
              <p className="text-sm text-amber-800 mt-1">
                Ces employés ont des heures supplémentaires non posées. Elles seront perdues à la fin du mois sauf demande exceptionnelle.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {alertes.map(({ employee, solde }) => (
                  <span key={employee.id} className="px-2 py-1 bg-white border border-amber-300 rounded text-sm">
                    {employee.prenom} {employee.nom} · {fmtH(solde)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="planning">Calendrier</TabsTrigger>
          <TabsTrigger value="compteurs">Compteurs d'heures</TabsTrigger>
          <TabsTrigger value="recups">
            Demandes de récupération
            {pendingCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-amber-500 text-white rounded">{pendingCount}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="planning" className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            {(Object.entries(PLANNING_TYPE_LABELS) as [PlanningType, string][]).map(([k, v]) => (
              <span key={k} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border ${TYPE_COLORS[k].badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${TYPE_COLORS[k].dot}`} />
                {v}
              </span>
            ))}
          </div>

          <Card className="p-0 overflow-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b">
                  <th className="text-left px-2 py-1 sticky left-0 bg-muted/40 z-10">Sem.</th>
                  {weeks.map((wk, wi) => {
                    const monday = wk.days.find(d => new Date(d).getDay() === 1) ?? wk.days[0];
                    return (
                      <th key={wi} colSpan={wk.days.length} className="text-center font-normal px-2 py-1 border-l">
                        <button
                          onClick={() => copyWeek(monday)}
                          title="Copier sur semaine suivante"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted/50"
                        >
                          <Copy className="h-3 w-3" /> S{wk.weekNum}
                        </button>
                      </th>
                    );
                  })}
                  <th className="px-2 py-1 border-l">Heures mois</th>
                </tr>
                <tr className="bg-muted/20 border-b">
                  <th className="text-left px-2 py-2 sticky left-0 bg-muted/20 z-10">Employé</th>
                  {days.map(d => {
                    const dt = new Date(d);
                    const wk = isWeekend(d);
                    const isToday = d === today;
                    const isFirstOfWeek = dt.getDay() === 1 && d !== days[0];
                    return (
                      <th
                        key={d}
                        className={[
                          "px-1 py-1 font-normal min-w-[44px] border-l",
                          isFirstOfWeek ? "border-l-2 border-l-border/60" : "border-border/40",
                          wk ? "bg-muted/40 text-muted-foreground" : "",
                          isToday ? "bg-primary/10" : "",
                        ].join(" ")}
                      >
                        <div className={`text-[10px] uppercase ${isToday ? "text-primary font-semibold" : ""}`}>
                          {DAY_LABELS[dt.getDay()]}
                        </div>
                        <div className={`text-sm font-medium ${isToday ? "text-primary" : ""}`}>
                          {dt.getDate()}
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-2 py-1 border-l text-right">Solde</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 && (
                  <tr><td colSpan={days.length + 2} className="text-center p-10 text-muted-foreground">Aucun employé actif</td></tr>
                )}
                {employees.map(emp => {
                  const compteur = compteurs.find(c => c.employee_id === emp.id);
                  const solde = compteur?.solde ?? 0;
                  return (
                    <tr key={emp.id} className="border-b">
                      <td className="px-2 py-2 sticky left-0 bg-background z-10 font-medium whitespace-nowrap">
                        {emp.prenom} {emp.nom}
                      </td>
                      {days.map(d => {
                        const cells = cellFor(emp.id, d);
                        const wk = isWeekend(d);
                        const dt = new Date(d);
                        const isFirstOfWeek = dt.getDay() === 1 && d !== days[0];
                        return (
                          <td
                            key={d}
                            onClick={() => !cells.length && openAdd(emp, d)}
                            className={[
                              "align-top py-1.5 px-1 border-l transition-colors",
                              isFirstOfWeek ? "border-l-2 border-l-border/60" : "border-border/40",
                              wk ? "bg-muted/15" : cells.length === 0 ? "hover:bg-muted/20 cursor-pointer" : "cursor-default",
                            ].join(" ")}
                          >
                            <div className="space-y-1">
                              {cells.map(c => (
                                <div key={c.id} className={`group relative px-1.5 py-1 rounded border ${TYPE_COLORS[c.type].badge}`}>
                                  <div className="absolute -top-1.5 -right-1.5 hidden group-hover:flex gap-0.5">
                                    <button
                                      onClick={(e) => openEdit(e, c, emp)}
                                      className="w-5 h-5 rounded-full bg-background border shadow-sm flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                                      title="Modifier"
                                    >
                                      <Pencil className="h-2.5 w-2.5" />
                                    </button>
                                    <button
                                      onClick={(e) => del(e, c.id)}
                                      className="w-5 h-5 rounded-full bg-background border shadow-sm flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
                                      title="Supprimer"
                                    >
                                      <Trash2 className="h-2.5 w-2.5" />
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TYPE_COLORS[c.type].dot}`} />
                                    <span className="text-[10px] font-medium uppercase">
                                      {PLANNING_TYPE_LABELS[c.type].slice(0, 3)}
                                    </span>
                                  </div>
                                  {c.heure_debut && (
                                    <div className="text-[9px] tabular-nums mt-0.5">
                                      {c.heure_debut}–{c.heure_fin}
                                    </div>
                                  )}
                                  {c.note && (
                                    <div className="text-[9px] mt-0.5 truncate opacity-75" title={c.note}>
                                      {c.note}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 border-l text-right font-medium">
                        {compteur ? (
                          <span className={solde > 0 ? "text-emerald-600" : solde < 0 ? "text-red-500" : "text-muted-foreground"}>
                            {fmtH(solde)}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="compteurs">
          <Card className="p-0 overflow-auto">
            {compteurs.length === 0 ? (
              <p className="p-10 text-center text-muted-foreground">Aucune donnée pour ce mois</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b">
                  <tr>
                    <th className="text-left px-3 py-2">Employé</th>
                    <th className="text-right px-3 py-2">Contractuelles</th>
                    <th className="text-right px-3 py-2">Réalisées</th>
                    <th className="text-right px-3 py-2">Report</th>
                    <th className="text-right px-3 py-2">Solde</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {compteurs.map(c => {
                    const emp = empById(c.employee_id);
                    if (!emp) return null;
                    return (
                      <tr key={c.id} className="border-b">
                        <td className="px-3 py-2 font-medium">{emp.prenom} {emp.nom}</td>
                        <td className="px-3 py-2 text-right">{c.heures_contractuelles}h</td>
                        <td className="px-3 py-2 text-right">{c.heures_realisees}h</td>
                        <td className="px-3 py-2 text-right">{c.heures_report > 0 ? `+${c.heures_report}h` : "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`font-medium ${c.solde > 0 ? "text-emerald-600" : c.solde < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                            {fmtH(c.solde)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {c.solde > 0 && (
                            <Button size="sm" variant="outline" onClick={() => {
                              setRecupForm({ employee_id: emp.id, type: "heures", heures_demandees: String(c.solde), date_souhaitee: "", motif: "" });
                              setRecupOpen(true);
                            }}>
                              Poser récup
                            </Button>
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

        <TabsContent value="recups">
          <Card className="p-0 overflow-auto">
            {recups.length === 0 ? (
              <p className="p-10 text-center text-muted-foreground">Aucune demande ce mois</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b">
                  <tr>
                    <th className="text-left px-3 py-2">Employé</th>
                    <th className="text-left px-3 py-2">Type</th>
                    <th className="text-right px-3 py-2">Heures</th>
                    <th className="text-left px-3 py-2">Date souhaitée</th>
                    <th className="text-left px-3 py-2">Motif</th>
                    <th className="text-left px-3 py-2">Statut</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {recups.map(r => {
                    const emp = empById(r.employee_id);
                    return (
                      <tr key={r.id} className="border-b">
                        <td className="px-3 py-2">{emp ? `${emp.prenom} ${emp.nom}` : "—"}</td>
                        <td className="px-3 py-2">
                          {r.type === "journee" ? "Journée entière" : r.type === "heures" ? "Heures" : "Report exceptionnel"}
                        </td>
                        <td className="px-3 py-2 text-right">{r.heures_demandees}h</td>
                        <td className="px-3 py-2">{r.date_souhaitee ?? "—"}</td>
                        <td className="px-3 py-2">{r.motif ?? "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            r.statut === "approuvee" ? "bg-emerald-100 text-emerald-800" :
                            r.statut === "refusee" ? "bg-red-100 text-red-800" :
                            "bg-amber-100 text-amber-800"
                          }`}>
                            {r.statut === "approuvee" ? "Approuvée" : r.statut === "refusee" ? "Refusée" : "En attente"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {r.statut === "demande" && (
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="outline" onClick={async () => {
                                try { await approuverRecupDemande(r.id); toast.success("Approuvée"); load(); }
                                catch (e: any) { toast.error(e.message); }
                              }}>
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={async () => {
                                try { await refuserRecupDemande(r.id); toast.success("Refusée"); load(); }
                                catch (e: any) { toast.error(e.message); }
                              }}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
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
      </Tabs>

      {/* Modal ajout / édition entrée planning */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(EMPTY_FORM); setSelectedCell(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? (
                <span className="inline-flex items-center gap-2">
                  <Pencil className="h-4 w-4" />
                  Modifier — {selectedCell?.emp.prenom} · {selectedCell?.date}
                </span>
              ) : selectedCell ? (
                `${selectedCell.emp.prenom} · ${DAY_FULL[new Date(selectedCell.date).getDay()]} ${selectedCell.date}`
              ) : "Ajouter au planning"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            {!selectedCell && !isEditing && (
              <div className="space-y-1.5">
                <Label>Employé</Label>
                <Select value={form.employee_id} onValueChange={v => setForm({ ...form, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                  <SelectContent>
                    {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!isEditing && (
              <div className="space-y-1.5">
                <Label>Mode de saisie</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["simple", "semaine_type"] as FormMode[]).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setForm({ ...form, mode: m })}
                      className={`px-3 py-2 rounded-lg border text-sm text-left transition-colors ${form.mode === m ? "border-primary bg-primary/5 font-medium" : "border-border text-muted-foreground hover:border-primary/50"}`}
                    >
                      <div className="font-medium">{m === "simple" ? "Entrée simple" : "Planning type"}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {m === "simple" ? "Un jour ou avec répétition basique" : "Semaine A / B avec jours personnalisés"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(form.mode === "simple" || isEditing) && (
              <>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={v => setForm({ ...form, type: v as PlanningType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.entries(PLANNING_TYPE_LABELS) as [PlanningType, string][]).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          <span className="inline-flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${TYPE_COLORS[k].dot}`} />
                            {v}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!isEditing && (form.type === "deplacement" || form.type === "formation") ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Date de début</Label>
                      <Input type="date" value={form.date_debut} onChange={e => setForm({ ...form, date_debut: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Date de fin</Label>
                      <Input type="date" value={form.date_fin} onChange={e => setForm({ ...form, date_fin: e.target.value })} min={form.date_debut} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input type="date" value={form.date_debut} onChange={e => setForm({ ...form, date_debut: e.target.value })} />
                  </div>
                )}

                {!(form.type === "deplacement" || form.type === "formation") && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Arrivée</Label>
                        <Input type="time" value={form.heure_debut} onChange={e => setForm({ ...form, heure_debut: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Départ</Label>
                        <Input type="time" value={form.heure_fin} onChange={e => setForm({ ...form, heure_fin: e.target.value })} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Pause déjeuner</Label>
                      <Select value={form.pause_minutes} onValueChange={v => setForm({ ...form, pause_minutes: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Pas de pause</SelectItem>
                          <SelectItem value="30">30 min</SelectItem>
                          <SelectItem value="45">45 min</SelectItem>
                          <SelectItem value="60">1 heure</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {!isEditing && (
                  <div className="space-y-1.5">
                    <Label>Répétition</Label>
                    <Select value={form.repeat} onValueChange={v => setForm({ ...form, repeat: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {REPEAT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {form.repeat === "week2" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        1 {DAY_FULL[new Date(form.date_debut).getDay()]} sur 2, à partir du {form.date_debut}
                      </p>
                    )}
                    {form.repeat === "week" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Chaque {DAY_FULL[new Date(form.date_debut).getDay()]} du mois {month}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Note <span className="text-xs text-muted-foreground">(optionnel)</span></Label>
                  <Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="ex : Formation Paris, RDV client…" />
                </div>
              </>
            )}

            {form.mode === "semaine_type" && !isEditing && (
              <>
                <div className="space-y-1.5">
                  <Label>Mois à remplir</Label>
                  <Input type="month" value={form.mois_cible} onChange={e => setForm({ ...form, mois_cible: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Type d'activité</Label>
                  <Select value={form.type} onValueChange={v => setForm({ ...form, type: v as PlanningType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.entries(PLANNING_TYPE_LABELS) as [PlanningType, string][]).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <input type="checkbox" checked={form.utilise_semaine_b} onChange={e => setForm({ ...form, utilise_semaine_b: e.target.checked })} className="rounded" />
                  <div>
                    <div className="text-sm font-medium">Activer semaine B (alternance)</div>
                    <div className="text-xs text-muted-foreground">Semaines impaires = A · Semaines paires = B</div>
                  </div>
                </label>
                <WeekGrid
                  label={form.utilise_semaine_b ? "Semaine A (semaines impaires)" : "Jours travaillés"}
                  config={form.semaine_a}
                  onChange={cfg => setForm({ ...form, semaine_a: cfg })}
                />
                {form.utilise_semaine_b && (
                  <WeekGrid label="Semaine B (semaines paires)" config={form.semaine_b} onChange={cfg => setForm({ ...form, semaine_b: cfg })} />
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setForm(EMPTY_FORM); setSelectedCell(null); }}>
              Annuler
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Enregistrement…" : isEditing ? "Mettre à jour" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal récupération */}
      <Dialog open={recupOpen} onOpenChange={setRecupOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Demande de récupération</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Employé</Label>
              <Select value={recupForm.employee_id} onValueChange={(v) => setRecupForm({ ...recupForm, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={recupForm.type} onValueChange={(v) => setRecupForm({ ...recupForm, type: v as RecupDemande["type"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="heures">Poser des heures</SelectItem>
                  <SelectItem value="journee">Journée entière (7h)</SelectItem>
                  <SelectItem value="report_exceptionnel">Report exceptionnel mois suivant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Heures à récupérer</Label>
                <Input type="number" step="0.5" value={recupForm.heures_demandees} onChange={(e) => setRecupForm({ ...recupForm, heures_demandees: e.target.value })} />
              </div>
              <div>
                <Label>Date souhaitée</Label>
                <Input type="date" value={recupForm.date_souhaitee} onChange={(e) => setRecupForm({ ...recupForm, date_souhaitee: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Motif (optionnel)</Label>
              <Textarea rows={2} value={recupForm.motif} onChange={(e) => setRecupForm({ ...recupForm, motif: e.target.value })} placeholder="ex : Semaine chargée, urgence client…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecupOpen(false)}>Annuler</Button>
            <Button onClick={saveRecup}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

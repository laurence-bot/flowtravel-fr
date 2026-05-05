import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Trash2, Copy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import {
  listEmployees, listPlanning, upsertPlanning, deletePlanning,
  PLANNING_TYPE_LABELS, type Employee, type PlanningEntry, type PlanningType,
} from "@/lib/hr";
import { toast } from "sonner";

export const Route = createFileRoute("/ops/equipe/planning")({ component: PlanningPage });

const TYPE_COLORS: Record<PlanningType, string> = {
  travail:     "bg-green-100 text-green-800 border-green-200",
  teletravail: "bg-blue-100 text-blue-800 border-blue-200",
  reunion:     "bg-purple-100 text-purple-800 border-purple-200",
  deplacement: "bg-orange-100 text-orange-800 border-orange-200",
  formation:   "bg-amber-100 text-amber-800 border-amber-200",
  autre:       "bg-zinc-100 text-zinc-600 border-zinc-200",
};

const DAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];

const REPEAT_OPTIONS = [
  { value: "none",  label: "Aucune répétition" },
  { value: "week",  label: "Chaque semaine" },
  { value: "month", label: "Tout le mois (jours ouvrés)" },
];

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr).getDay();
  return day === 0 || day === 6;
}

function daysInMonth(month: string): string[] {
  const d = new Date(`${month}-01`);
  const end = new Date(d);
  end.setMonth(end.getMonth() + 1);
  const out: string[] = [];
  for (let x = new Date(d); x < end; x.setDate(x.getDate() + 1))
    out.push(x.toISOString().slice(0, 10));
  return out;
}

function expandDates(dateDebut: string, _dateFin: string, repeat: string, month: string): string[] {
  if (repeat === "none") return [dateDebut];
  const monthDays = daysInMonth(month);
  if (repeat === "month") return monthDays.filter(d => !isWeekend(d));
  if (repeat === "week") {
    const targetDay = new Date(dateDebut).getDay();
    return monthDays.filter(d => new Date(d).getDay() === targetDay);
  }
  return [dateDebut];
}

type FormState = {
  employee_id: string;
  date_debut: string;
  date_fin: string;
  type: PlanningType;
  heure_debut: string;
  heure_fin: string;
  note: string;
  repeat: string;
};

const EMPTY_FORM: FormState = {
  employee_id: "",
  date_debut: new Date().toISOString().slice(0, 10),
  date_fin: "",
  type: "travail",
  heure_debut: "09:00",
  heure_fin: "18:00",
  note: "",
  repeat: "none",
};

function PlanningPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entries, setEntries] = useState<PlanningEntry[]>([]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ emp: Employee; date: string } | null>(null);

  const load = async () => {
    const emps = await listEmployees();
    setEmployees(emps.filter(e => e.actif));
    const days = daysInMonth(month);
    setEntries(await listPlanning(days[0], days[days.length - 1]));
  };

  useEffect(() => { load().catch(e => toast.error(e.message)); }, [month]);

  const days = daysInMonth(month);
  const cellFor = (empId: string, date: string) =>
    entries.filter(e => e.employee_id === empId && e.date_jour === date);

  const openAdd = (emp?: Employee, date?: string) => {
    setForm({
      ...EMPTY_FORM,
      employee_id: emp?.id ?? "",
      date_debut: date ?? new Date().toISOString().slice(0, 10),
    });
    setSelectedCell(emp && date ? { emp, date } : null);
    setOpen(true);
  };

  const save = async () => {
    if (!form.employee_id) { toast.error("Employé requis"); return; }
    if (!form.date_debut) { toast.error("Date de début requise"); return; }
    setSaving(true);
    try {
      const dates = expandDates(form.date_debut, form.date_fin, form.repeat, month);
      await Promise.all(dates.map(date =>
        upsertPlanning({
          employee_id: form.employee_id,
          date_jour: date,
          type: form.type,
          heure_debut: form.heure_debut || null,
          heure_fin: form.heure_fin || null,
          note: form.note || null,
        })
      ));
      toast.success(`${dates.length} entrée(s) ajoutée(s)`);
      setOpen(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: string) => {
    try { await deletePlanning(id); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const copyWeek = async (sourceMonday: string) => {
    const mon = new Date(sourceMonday);
    const sun = new Date(sourceMonday);
    sun.setDate(sun.getDate() + 6);
    const weekEntries = entries.filter(e => {
      const d = new Date(e.date_jour);
      return d >= mon && d <= sun;
    });
    if (weekEntries.length === 0) { toast.error("Aucune entrée cette semaine"); return; }
    try {
      await Promise.all(weekEntries.map(e =>
        upsertPlanning({
          employee_id: e.employee_id,
          date_jour: addDays(e.date_jour, 7),
          type: e.type,
          heure_debut: e.heure_debut ?? null,
          heure_fin: e.heure_fin ?? null,
          note: e.note ?? null,
        })
      ));
      toast.success(`${weekEntries.length} entrée(s) copiée(s)`);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  // Group days into weeks for the header
  const weeks: string[][] = [];
  let currentWeek: string[] = [];
  days.forEach(d => {
    currentWeek.push(d);
    if (new Date(d).getDay() === 0 || d === days[days.length - 1]) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  return (
    <div className="space-y-6">
      <Link to="/ops/equipe" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>

      <PageHeader
        title="Planning"
        description="Vue mensuelle de l'équipe"
        action={
          <div className="flex items-center gap-2">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
            <Button onClick={() => openAdd()}>+ Ajouter</Button>
          </div>
        }
      />

      {/* Légende */}
      <div className="flex flex-wrap gap-2 text-xs">
        {(Object.entries(PLANNING_TYPE_LABELS) as [PlanningType, string][]).map(([k, v]) => (
          <span key={k} className={`px-2 py-1 rounded border ${TYPE_COLORS[k]}`}>{v}</span>
        ))}
      </div>

      {/* Calendrier */}
      <Card className="p-0 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            {/* Ligne semaines avec bouton copie */}
            <tr className="bg-muted/40 border-b">
              <th className="text-left px-2 py-1 sticky left-0 bg-muted/40 z-10">Semaine</th>
              {weeks.map((week, wi) => {
                const monday = week.find(d => new Date(d).getDay() === 1) ?? week[0];
                return (
                  <th key={wi} colSpan={week.length} className="text-center text-muted-foreground font-normal px-2 py-1 border-l">
                    <button
                      onClick={() => copyWeek(monday)}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      title="Copier cette semaine sur la suivante"
                    >
                      <Copy className="h-3 w-3" />
                      S{wi + 1}
                    </button>
                  </th>
                );
              })}
            </tr>
            {/* Ligne jours */}
            <tr className="bg-muted/20 border-b">
              <th className="text-left px-2 py-2 sticky left-0 bg-muted/20 z-10">Employé</th>
              {days.map(d => {
                const dt = new Date(d);
                const wk = isWeekend(d);
                return (
                  <th key={d} className={`px-1 py-1 font-normal min-w-[44px] ${wk ? "bg-muted/40 text-muted-foreground" : ""}`}>
                    <div className="text-sm font-medium">{dt.getDate()}</div>
                    <div className="text-[10px] uppercase">{DAY_LABELS[dt.getDay()]}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr>
                <td colSpan={days.length + 1} className="text-center p-10 text-muted-foreground">
                  Aucun employé actif
                </td>
              </tr>
            )}
            {employees.map(emp => (
              <tr key={emp.id} className="border-b">
                <td className="px-2 py-2 sticky left-0 bg-background z-10 font-medium whitespace-nowrap">
                  {emp.prenom} {emp.nom}
                </td>
                {days.map(d => {
                  const cells = cellFor(emp.id, d);
                  const wk = isWeekend(d);
                  return (
                    <td
                      key={d}
                      onClick={() => openAdd(emp, d)}
                      className={`align-top p-1 border-l cursor-pointer hover:bg-muted/30 ${wk ? "bg-muted/20" : ""}`}
                    >
                      {cells.map(c => (
                        <div key={c.id} className={`mb-0.5 px-1 py-0.5 rounded border ${TYPE_COLORS[c.type]}`}>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-medium">{PLANNING_TYPE_LABELS[c.type].slice(0, 3)}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); del(c.id); }}
                              className="opacity-40 hover:opacity-100"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                          {c.heure_debut && (
                            <div className="text-[9px]">{c.heure_debut}–{c.heure_fin}</div>
                          )}
                        </div>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Modal ajout */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(EMPTY_FORM); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {selectedCell
                ? `Planning — ${selectedCell.emp.prenom} · ${selectedCell.date}`
                : "Ajouter au planning"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            {!selectedCell && (
              <div>
                <Label>Employé</Label>
                <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                  <SelectContent>
                    {employees.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as PlanningType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(PLANNING_TYPE_LABELS) as [PlanningType, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date de début</Label>
                <Input type="date" value={form.date_debut}
                  onChange={(e) => setForm({ ...form, date_debut: e.target.value })} />
              </div>
              <div>
                <Label>Date de fin (optionnel)</Label>
                <Input type="date" value={form.date_fin}
                  onChange={(e) => setForm({ ...form, date_fin: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Heure début</Label>
                <Input type="time" value={form.heure_debut}
                  onChange={(e) => setForm({ ...form, heure_debut: e.target.value })} />
              </div>
              <div>
                <Label>Heure fin</Label>
                <Input type="time" value={form.heure_fin}
                  onChange={(e) => setForm({ ...form, heure_fin: e.target.value })} />
              </div>
            </div>

            <div>
              <Label>Répétition</Label>
              <Select value={form.repeat} onValueChange={(v) => setForm({ ...form, repeat: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REPEAT_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.repeat === "week" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Répète chaque {DAY_LABELS[new Date(form.date_debut).getDay()]} du mois en cours
                </p>
              )}
              {form.repeat === "month" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Applique à tous les jours ouvrés du mois ({month})
                </p>
              )}
            </div>

            <div>
              <Label>Note (optionnel)</Label>
              <Textarea rows={2} value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="ex : Formation Paris, RDV client Lyon…" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setForm(EMPTY_FORM); }}>
              Annuler
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

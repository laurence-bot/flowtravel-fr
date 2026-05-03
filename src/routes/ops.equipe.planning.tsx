import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { listEmployees, listPlanning, upsertPlanning, deletePlanning, PLANNING_TYPE_LABELS, type Employee, type PlanningEntry, type PlanningType } from "@/lib/hr";
import { toast } from "sonner";

export const Route = createFileRoute("/ops/equipe/planning")({ component: PlanningPage });

function PlanningPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entries, setEntries] = useState<PlanningEntry[]>([]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [adding, setAdding] = useState({ employee_id: "", date_jour: "", type: "travail" as PlanningType });

  const load = async () => {
    const emps = await listEmployees();
    setEmployees(emps.filter(e => e.actif));
    const from = `${month}-01`;
    const d = new Date(from); d.setMonth(d.getMonth() + 1); d.setDate(0);
    const to = d.toISOString().slice(0, 10);
    setEntries(await listPlanning(from, to));
  };
  useEffect(() => { load().catch(e => toast.error(e.message)); }, [month]);

  const days: string[] = (() => {
    const d = new Date(`${month}-01`); const end = new Date(d); end.setMonth(end.getMonth() + 1);
    const out: string[] = [];
    for (let x = new Date(d); x < end; x.setDate(x.getDate() + 1)) out.push(x.toISOString().slice(0, 10));
    return out;
  })();

  const cellFor = (empId: string, date: string) => entries.filter(e => e.employee_id === empId && e.date_jour === date);

  const add = async () => {
    if (!adding.employee_id || !adding.date_jour) { toast.error("Employé et date requis"); return; }
    try { await upsertPlanning(adding); setAdding({ employee_id: "", date_jour: "", type: "travail" }); load(); toast.success("Ajouté"); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <Link to="/ops/equipe" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Retour</Link>
      <PageHeader title="Planning équipe" description="Vue mensuelle (travail, télétravail, etc.)"
        action={<Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />}
      />

      <Card className="p-4 grid gap-3 md:grid-cols-5 items-end">
        <div><Label className="text-xs">Employé</Label>
          <Select value={adding.employee_id} onValueChange={(v) => setAdding({ ...adding, employee_id: v })}>
            <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
            <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Date</Label><Input type="date" value={adding.date_jour} onChange={(e) => setAdding({ ...adding, date_jour: e.target.value })} /></div>
        <div><Label className="text-xs">Type</Label>
          <Select value={adding.type} onValueChange={(v) => setAdding({ ...adding, type: v as PlanningType })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(PLANNING_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button onClick={add}>Ajouter au planning</Button>
      </Card>

      <Card className="p-0 overflow-x-auto">
        <table className="text-xs min-w-full">
          <thead className="bg-muted/40">
            <tr>
              <th className="sticky left-0 bg-muted/40 px-3 py-2 text-left font-medium">Employé</th>
              {days.map(d => {
                const dt = new Date(d); const wk = dt.getDay() === 0 || dt.getDay() === 6;
                return <th key={d} className={`px-1 py-2 text-center ${wk ? "bg-muted/60" : ""}`}><div>{dt.getDate()}</div><div className="text-[9px] text-muted-foreground">{["D","L","M","M","J","V","S"][dt.getDay()]}</div></th>;
              })}
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id} className="border-t">
                <td className="sticky left-0 bg-background px-3 py-2 whitespace-nowrap">{emp.prenom} {emp.nom}</td>
                {days.map(d => {
                  const cells = cellFor(emp.id, d);
                  return (
                    <td key={d} className="px-1 py-1 text-center">
                      {cells.map(c => (
                        <button key={c.id} title={PLANNING_TYPE_LABELS[c.type]} onClick={() => deletePlanning(c.id).then(load)}
                          className={`text-[9px] px-1 rounded ${c.type === "teletravail" ? "bg-blue-100 text-blue-800" : c.type === "travail" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                          {PLANNING_TYPE_LABELS[c.type].slice(0,3)}
                        </button>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

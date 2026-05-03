import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { listTimeEntriesAgence, listEmployees, TIME_EVENT_LABELS, type Employee, type TimeEntry } from "@/lib/hr";
import { toast } from "sonner";

export const Route = createFileRoute("/ops/equipe/pointage")({ component: PointagePage });

function PointagePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [from, setFrom] = useState(() => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const load = async () => {
    setEmployees(await listEmployees());
    setEntries(await listTimeEntriesAgence(`${from}T00:00:00Z`, `${to}T23:59:59Z`));
  };
  useEffect(() => { load().catch(e => toast.error(e.message)); }, [from, to]);

  const empById = (id: string) => employees.find(e => e.id === id);

  // qui est là maintenant
  const today = new Date().toISOString().slice(0, 10);
  const lastEventByEmp = new Map<string, TimeEntry>();
  for (const e of [...entries].sort((a,b) => a.event_at.localeCompare(b.event_at))) {
    if (e.event_at.startsWith(today)) lastEventByEmp.set(e.employee_id, e);
  }
  const present = Array.from(lastEventByEmp.entries()).filter(([_, e]) => e.event_type !== "sortie");

  const exportCsv = () => {
    const header = "date,employe,event,heure\n";
    const rows = entries.map(e => {
      const emp = empById(e.employee_id);
      return `${e.event_at.slice(0,10)},${emp?.prenom ?? ""} ${emp?.nom ?? ""},${e.event_type},${e.event_at.slice(11,19)}`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `pointage-${from}-${to}.csv`; a.click();
  };

  return (
    <div className="space-y-6">
      <Link to="/ops/equipe" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Retour</Link>
      <PageHeader title="Pointage temps réel" description="Qui est présent et historique"
        action={<div className="flex gap-2 items-center">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />CSV</Button>
        </div>}
      />

      <Card className="p-6">
        <h3 className="font-display text-lg mb-3">Présents maintenant ({present.length})</h3>
        {present.length === 0 ? <p className="text-sm text-muted-foreground">Personne pointé aujourd'hui.</p> :
          <div className="grid gap-2 md:grid-cols-3">
            {present.map(([eid, e]) => {
              const emp = empById(eid);
              return <div key={eid} className="flex justify-between p-3 rounded border">
                <span>{emp?.prenom} {emp?.nom}</span>
                <span className="text-xs text-muted-foreground">{TIME_EVENT_LABELS[e.event_type]} · {e.event_at.slice(11,16)}</span>
              </div>;
            })}
          </div>
        }
      </Card>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Date / Heure</th>
              <th className="text-left px-4 py-3">Employé</th>
              <th className="text-left px-4 py-3">Événement</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => {
              const emp = empById(e.employee_id);
              return <tr key={e.id} className="border-t">
                <td className="px-4 py-2 text-muted-foreground">{new Date(e.event_at).toLocaleString("fr-FR")}</td>
                <td className="px-4 py-2">{emp?.prenom} {emp?.nom}</td>
                <td className="px-4 py-2">{TIME_EVENT_LABELS[e.event_type]}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, FileText, Award } from "lucide-react";
import { getEmployeeByUserId, pointer, listTimeEntries, TIME_EVENT_LABELS, type Employee, type TimeEntry, type TimeEvent } from "@/lib/hr";
import { toast } from "sonner";

export const Route = createFileRoute("/mon-espace/pointage")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
  },
  component: () => <AppLayout><PointageEmployeePage /></AppLayout>,
});

function PointageEmployeePage() {
  const [emp, setEmp] = useState<Employee | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const e = await getEmployeeByUserId(user.id);
    setEmp(e);
    if (e) {
      const today = new Date().toISOString().slice(0, 10);
      setEntries(await listTimeEntries(e.id, `${today}T00:00:00Z`));
    }
    setLoading(false);
  };
  useEffect(() => { load().catch(err => toast.error(err.message)); }, []);

  const click = async (event: TimeEvent) => {
    if (!emp) return;
    try { await pointer(emp.id, event); toast.success(`${TIME_EVENT_LABELS[event]} enregistrée`); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="p-10 text-center text-muted-foreground">Chargement…</div>;
  if (!emp) return <Card className="p-10 text-center">Aucune fiche employé liée à votre compte. Contactez l'admin.</Card>;

  const last = entries[0];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl">Pointage</h1>
        <p className="text-muted-foreground">{emp.prenom} {emp.nom}</p>
      </div>

      <Card className="p-8 text-center space-y-6">
        <Clock className="h-12 w-12 mx-auto text-muted-foreground" />
        <div className="text-5xl font-mono">{new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
        {last && <p className="text-sm text-muted-foreground">Dernier événement : {TIME_EVENT_LABELS[last.event_type]} à {new Date(last.event_at).toLocaleTimeString("fr-FR")}</p>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button size="lg" onClick={() => click("arrivee")}>Arrivée</Button>
          <Button size="lg" variant="outline" onClick={() => click("pause_debut")}>Début pause</Button>
          <Button size="lg" variant="outline" onClick={() => click("pause_fin")}>Fin pause</Button>
          <Button size="lg" variant="destructive" onClick={() => click("sortie")}>Sortie</Button>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Link to="/mon-espace/conges"><Card className="p-4 hover:bg-muted/40 cursor-pointer"><Calendar className="h-5 w-5 mb-2" /><div className="font-medium">Mes congés</div></Card></Link>
        <Link to="/mon-espace/contrats"><Card className="p-4 hover:bg-muted/40 cursor-pointer"><FileText className="h-5 w-5 mb-2" /><div className="font-medium">Mes contrats</div></Card></Link>
        <Link to="/mon-espace/evaluation"><Card className="p-4 hover:bg-muted/40 cursor-pointer"><Award className="h-5 w-5 mb-2" /><div className="font-medium">Mon évaluation</div></Card></Link>
      </div>

      <Card className="p-0 overflow-hidden overflow-x-auto">
        <div className="p-4 border-b font-medium">Pointages du jour</div>
        {entries.length === 0 ? <div className="p-6 text-center text-muted-foreground text-sm">Aucun pointage</div> :
          <table className="w-full text-sm">
            <tbody>{entries.map(e => (
              <tr key={e.id} className="border-t">
                <td className="px-4 py-2">{TIME_EVENT_LABELS[e.event_type]}</td>
                <td className="px-4 py-2 text-right text-muted-foreground">{new Date(e.event_at).toLocaleTimeString("fr-FR")}</td>
              </tr>
            ))}</tbody>
          </table>
        }
      </Card>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { listEvaluations, createEvaluation, listEmployees, type Evaluation, type Employee } from "@/lib/hr";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/ops/equipe/evaluations")({ component: EvalsPage });

function EvalsPage() {
  const [items, setItems] = useState<Evaluation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: "", annee: new Date().getFullYear() });

  const load = async () => { setItems(await listEvaluations()); setEmployees(await listEmployees()); };
  useEffect(() => { load().catch(e => toast.error(e.message)); }, []);

  const empById = (id: string) => employees.find(e => e.id === id);

  const create = async () => {
    if (!form.employee_id) return;
    try { await createEvaluation(form.employee_id, form.annee); setOpen(false); load(); toast.success("Campagne créée"); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <Link to="/ops/equipe" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Retour</Link>
      <PageHeader title="Évaluations annuelles" description="Campagnes d'entretien et fiches signées"
        action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Nouvelle campagne</Button>}
      />

      <Card className="p-0 overflow-hidden">
        {items.length === 0 ? <div className="p-10 text-center text-muted-foreground">Aucune évaluation</div> :
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left px-4 py-3">Année</th><th className="text-left px-4 py-3">Employé</th><th className="text-left px-4 py-3">Statut</th><th className="text-left px-4 py-3">Note</th></tr>
            </thead>
            <tbody>
              {items.map(e => {
                const emp = empById(e.employee_id);
                return <tr key={e.id} className="border-t">
                  <td className="px-4 py-2">{e.annee}</td>
                  <td className="px-4 py-2">{emp?.prenom} {emp?.nom}</td>
                  <td className="px-4 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-muted">{e.statut}</span></td>
                  <td className="px-4 py-2">{e.note_globale ?? "—"}</td>
                </tr>;
              })}
            </tbody>
          </table>
        }
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle campagne d'évaluation</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Employé</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Année</Label><Input type="number" value={form.annee} onChange={(e) => setForm({ ...form, annee: Number(e.target.value) })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={create}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

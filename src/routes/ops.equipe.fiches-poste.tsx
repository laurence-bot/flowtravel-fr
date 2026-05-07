import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Briefcase, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { listEmployees, listJobDescriptions, createJobDescription, deleteJobDescription, type Employee, type JobDescription } from "@/lib/hr";
import { toast } from "sonner";

export const Route = createFileRoute("/ops/equipe/fiches-poste")({
  component: FichesPostePage,
});

function FichesPostePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [fiches, setFiches] = useState<JobDescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    employee_id: "", intitule: "", missions: "", competences_attendues: "",
    objectifs: "", kpi: "", date_application: new Date().toISOString().slice(0, 10),
  });

  const load = async () => {
    setLoading(true);
    try {
      const [emps, fs] = await Promise.all([listEmployees(), listJobDescriptions()]);
      setEmployees(emps);
      setFiches(fs);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.employee_id || !form.intitule) {
      toast.error("Employé et intitulé requis");
      return;
    }
    try {
      await createJobDescription(form);
      toast.success("Fiche de poste créée");
      setOpen(false);
      setForm({ ...form, intitule: "", missions: "", competences_attendues: "", objectifs: "", kpi: "" });
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette fiche de poste ?")) return;
    try {
      await deleteJobDescription(id);
      toast.success("Supprimée");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const empName = (id: string) => {
    const e = employees.find(e => e.id === id);
    return e ? `${e.prenom} ${e.nom}` : "—";
  };

  if (loading) return <div className="p-10 text-center text-muted-foreground">Chargement…</div>;

  return (
    <div className="space-y-6">
      <Link to="/ops/equipe" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour à l'équipe
      </Link>

      <PageHeader
        title="Fiches de poste"
        description="Définition des missions, compétences et objectifs annuels"
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nouvelle fiche
          </Button>
        }
      />

      {fiches.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-50" />
          Aucune fiche de poste pour l'instant.
        </Card>
      ) : (
        <div className="space-y-3">
          {fiches.map((f) => (
            <Card key={f.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display text-lg">{f.intitule}</h3>
                    <Badge variant="secondary">v{f.version}</Badge>
                    {f.est_active && <Badge className="bg-green-100 text-green-800 border-green-300"><Check className="h-3 w-3 mr-1" />Active</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {empName(f.employee_id)}
                    {f.date_application && <> · Applicable depuis le {new Date(f.date_application).toLocaleDateString("fr-FR")}</>}
                  </p>
                  {f.missions && <div className="mt-3"><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Missions</div><p className="text-sm whitespace-pre-line">{f.missions}</p></div>}
                  {f.competences_attendues && <div className="mt-3"><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Compétences</div><p className="text-sm whitespace-pre-line">{f.competences_attendues}</p></div>}
                  {f.objectifs && <div className="mt-3"><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Objectifs</div><p className="text-sm whitespace-pre-line">{f.objectifs}</p></div>}
                  {f.kpi && <div className="mt-3"><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">KPI</div><p className="text-sm whitespace-pre-line">{f.kpi}</p></div>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nouvelle fiche de poste</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Employé *</Label>
                <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                  <SelectContent>
                    {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date d'application</Label>
                <Input type="date" value={form.date_application} onChange={(e) => setForm({ ...form, date_application: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Intitulé du poste *</Label>
              <Input value={form.intitule} onChange={(e) => setForm({ ...form, intitule: e.target.value })} placeholder="Conseiller voyages senior" />
            </div>
            <div className="space-y-1.5">
              <Label>Missions principales</Label>
              <Textarea rows={4} value={form.missions} onChange={(e) => setForm({ ...form, missions: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Compétences attendues</Label>
              <Textarea rows={3} value={form.competences_attendues} onChange={(e) => setForm({ ...form, competences_attendues: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Objectifs annuels</Label>
              <Textarea rows={3} value={form.objectifs} onChange={(e) => setForm({ ...form, objectifs: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>KPI / Indicateurs</Label>
              <Textarea rows={2} value={form.kpi} onChange={(e) => setForm({ ...form, kpi: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit}>Créer la fiche</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

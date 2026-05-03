import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { getEmployee, updateEmployee, deleteEmployee, CONTRACT_TYPE_LABELS, type Employee, type ContractType } from "@/lib/hr";
import { toast } from "sonner";

export const Route = createFileRoute("/ops/equipe/$id")({
  component: EmployeeDetail,
});

function EmployeeDetail() {
  const { id } = useParams({ from: "/ops/equipe/$id" });
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getEmployee(id)
      .then(setEmployee)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const save = async () => {
    if (!employee) return;
    setSaving(true);
    try {
      await updateEmployee(employee.id, {
        prenom: employee.prenom,
        nom: employee.nom,
        email: employee.email,
        telephone: employee.telephone,
        poste: employee.poste,
        type_contrat: employee.type_contrat,
        date_embauche: employee.date_embauche,
        date_sortie: employee.date_sortie,
        salaire_brut_mensuel: employee.salaire_brut_mensuel,
        jours_conges_par_an: employee.jours_conges_par_an,
        jours_rtt_par_an: employee.jours_rtt_par_an,
        notes: employee.notes,
        actif: employee.actif,
      });
      toast.success("Enregistré");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!employee) return;
    if (!confirm(`Supprimer ${employee.prenom} ${employee.nom} ?`)) return;
    try {
      await deleteEmployee(employee.id);
      toast.success("Employé supprimé");
      window.location.href = "/ops/equipe";
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading) return <div className="p-10 text-center text-muted-foreground">Chargement…</div>;
  if (!employee) return <div className="p-10 text-center">Employé introuvable</div>;

  return (
    <div className="space-y-6">
      <Link to="/ops/equipe" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour à l'équipe
      </Link>

      <PageHeader
        title={`${employee.prenom} ${employee.nom}`}
        description={employee.poste ?? "Employé"}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={remove}><Trash2 className="h-4 w-4 mr-2" />Supprimer</Button>
            <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? "…" : "Enregistrer"}</Button>
          </div>
        }
      />

      <Tabs defaultValue="infos">
        <TabsList>
          <TabsTrigger value="infos">Infos</TabsTrigger>
          <TabsTrigger value="contrats" disabled>Contrats <span className="ml-2 text-xs opacity-60">bientôt</span></TabsTrigger>
          <TabsTrigger value="absences" disabled>Congés <span className="ml-2 text-xs opacity-60">bientôt</span></TabsTrigger>
          <TabsTrigger value="planning" disabled>Planning <span className="ml-2 text-xs opacity-60">bientôt</span></TabsTrigger>
          <TabsTrigger value="pointage" disabled>Pointage <span className="ml-2 text-xs opacity-60">bientôt</span></TabsTrigger>
          <TabsTrigger value="poste" disabled>Fiche poste <span className="ml-2 text-xs opacity-60">bientôt</span></TabsTrigger>
          <TabsTrigger value="evals" disabled>Évaluations <span className="ml-2 text-xs opacity-60">bientôt</span></TabsTrigger>
        </TabsList>

        <TabsContent value="infos" className="space-y-4 mt-4">
          <Card className="p-6 grid gap-4 md:grid-cols-2">
            <Field label="Prénom"><Input value={employee.prenom} onChange={(e) => setEmployee({ ...employee, prenom: e.target.value })} /></Field>
            <Field label="Nom"><Input value={employee.nom} onChange={(e) => setEmployee({ ...employee, nom: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={employee.email ?? ""} onChange={(e) => setEmployee({ ...employee, email: e.target.value })} /></Field>
            <Field label="Téléphone"><Input value={employee.telephone ?? ""} onChange={(e) => setEmployee({ ...employee, telephone: e.target.value })} /></Field>
            <Field label="Poste"><Input value={employee.poste ?? ""} onChange={(e) => setEmployee({ ...employee, poste: e.target.value })} /></Field>
            <Field label="Type de contrat">
              <Select value={employee.type_contrat} onValueChange={(v) => setEmployee({ ...employee, type_contrat: v as ContractType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTRACT_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date d'embauche"><Input type="date" value={employee.date_embauche ?? ""} onChange={(e) => setEmployee({ ...employee, date_embauche: e.target.value || null })} /></Field>
            <Field label="Date de sortie"><Input type="date" value={employee.date_sortie ?? ""} onChange={(e) => setEmployee({ ...employee, date_sortie: e.target.value || null })} /></Field>
            <Field label="Salaire brut mensuel (€)"><Input type="number" step="0.01" value={employee.salaire_brut_mensuel ?? ""} onChange={(e) => setEmployee({ ...employee, salaire_brut_mensuel: e.target.value ? Number(e.target.value) : null })} /></Field>
            <Field label="Congés/an (jours)"><Input type="number" step="0.5" value={employee.jours_conges_par_an} onChange={(e) => setEmployee({ ...employee, jours_conges_par_an: Number(e.target.value) || 0 })} /></Field>
            <Field label="RTT/an (jours)"><Input type="number" step="0.5" value={employee.jours_rtt_par_an} onChange={(e) => setEmployee({ ...employee, jours_rtt_par_an: Number(e.target.value) || 0 })} /></Field>
            <Field label="Statut">
              <Select value={employee.actif ? "actif" : "sorti"} onValueChange={(v) => setEmployee({ ...employee, actif: v === "actif" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="actif">Actif</SelectItem>
                  <SelectItem value="sorti">Sorti</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Notes"><Textarea rows={3} value={employee.notes ?? ""} onChange={(e) => setEmployee({ ...employee, notes: e.target.value })} /></Field>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

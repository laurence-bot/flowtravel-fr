import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Users, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { listEmployees, createEmployee, CONTRACT_TYPE_LABELS, type Employee, type ContractType } from "@/lib/hr";
import { toast } from "sonner";

export const Route = createFileRoute("/ops/equipe/")({
  component: EquipeIndex,
});

function EquipeIndex() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      setEmployees(await listEmployees());
    } catch (e: any) {
      toast.error(e.message ?? "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Équipe RH"
        description="Gestion des employés, contrats, congés, planning et évaluations"
        action={
          <div className="flex gap-2">
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

      <Card className="p-0 overflow-hidden overflow-x-auto">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : employees.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Aucun employé"
            description="Ajoutez votre premier employé pour commencer."
            action={
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un employé
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
                    {e.actif ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs">
                        Actif
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">
                        Sorti
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Salaire brut mensuel (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.salaire_brut_mensuel}
                onChange={(e) => setForm({ ...form, salaire_brut_mensuel: e.target.value })}
              />
            </div>
            <div>
              <Label>Congés/an (jours)</Label>
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

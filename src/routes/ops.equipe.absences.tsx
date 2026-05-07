import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import {
  listAbsences, approveAbsence, rejectAbsence, createAbsence,
  listEmployees, listRecupDemandes, createRecupDemande,
  approuverRecupDemande, refuserRecupDemande,
  ABSENCE_TYPE_LABELS, ABSENCE_STATUT_LABELS,
  type Absence, type Employee, type AbsenceType, type AbsenceStatut, type RecupDemande,
} from "@/lib/hr";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { sendTransactionalEmail } from "@/lib/email/send";
import { toast } from "sonner";

export const Route = createFileRoute("/ops/equipe/absences")({ component: AbsencesPage });

const STATUT_COLORS: Record<AbsenceStatut, string> = {
  demande:   "bg-amber-100 text-amber-700",
  approuvee: "bg-green-100 text-green-700",
  refusee:   "bg-red-100 text-red-600",
  signee:    "bg-blue-100 text-blue-700",
  annulee:   "bg-zinc-100 text-zinc-500",
};

type EmpInfo = { prenom: string; nom: string; email: string | null };
type EmpMap = Record<string, EmpInfo>;

const EMPTY_FORM = {
  employee_id: "",
  type: "conge_paye" as AbsenceType,
  date_debut: "",
  date_fin: "",
  motif: "",
  statut_direct: "approuvee",
};

function AbsencesPage() {
  const [items, setItems] = useState<Absence[]>([]);
  const [empMap, setEmpMap] = useState<EmpMap>({});
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refusing, setRefusing] = useState<string | null>(null);
  const [motif, setMotif] = useState("");

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [filterEmp, setFilterEmp] = useState("tous");
  const [filterStatut, setFilterStatut] = useState("tous");

  const [recups, setRecups] = useState<RecupDemande[]>([]);
  const [recupOpen, setRecupOpen] = useState(false);
  const [recupForm, setRecupForm] = useState({ employee_id: "", heures_demandees: "7", date_souhaitee: "", motif: "" });

  const reload = async () => {
    setLoading(true);
    try {
      const [data, emps, recs] = await Promise.all([listAbsences(), listEmployees(), listRecupDemandes()]);
      setItems(data);
      setAllEmployees(emps);
      setRecups(recs);
      const map: EmpMap = {};
      emps.forEach(e => { map[e.id] = { prenom: e.prenom, nom: e.nom, email: e.email }; });
      setEmpMap(map);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const saveRecup = async () => {
    if (!recupForm.employee_id || !recupForm.heures_demandees) { toast.error("Champs requis"); return; }
    try {
      await createRecupDemande({
        employee_id: recupForm.employee_id,
        mois: new Date().toISOString().slice(0, 7),
        type: "heures",
        heures_demandees: Number(recupForm.heures_demandees),
        date_souhaitee: recupForm.date_souhaitee || undefined,
        motif: recupForm.motif || undefined,
      });
      toast.success("Demande créée");
      setRecupOpen(false);
      setRecupForm({ employee_id: "", heures_demandees: "7", date_souhaitee: "", motif: "" });
      reload();
    } catch (e: any) { toast.error(e.message); }
  };

  const filtered = items.filter(a => {
    if (filterEmp !== "tous" && a.employee_id !== filterEmp) return false;
    if (filterStatut !== "tous" && a.statut !== filterStatut) return false;
    return true;
  });

  const approve = async (a: Absence) => {
    try {
      await approveAbsence(a.id);
      const emp = empMap[a.employee_id];
      if (emp?.email) {
        const { data: row } = await supabase.from("hr_absences").select("token").eq("id", a.id).maybeSingle();
        const sign_url = `${window.location.origin}/conge-signer/${row?.token}`;
        await sendTransactionalEmail({
          templateName: "leave-decision",
          recipientEmail: emp.email,
          idempotencyKey: `leave-${a.id}-approved`,
          templateData: { prenom: emp.prenom, date_debut: a.date_debut, date_fin: a.date_fin, statut: "approuvee", sign_url },
        });
      }
      toast.success("Approuvé");
      reload();
    } catch (e: any) { toast.error(e.message); }
  };

  const reject = async (a: Absence) => {
    try {
      await rejectAbsence(a.id, motif || "");
      const emp = empMap[a.employee_id];
      if (emp?.email) {
        await sendTransactionalEmail({
          templateName: "leave-decision",
          recipientEmail: emp.email,
          idempotencyKey: `leave-${a.id}-rejected`,
          templateData: { prenom: emp.prenom, date_debut: a.date_debut, date_fin: a.date_fin, statut: "refusee", motif_refus: motif },
        });
      }
      setRefusing(null); setMotif("");
      toast.success("Refusé");
      reload();
    } catch (e: any) { toast.error(e.message); }
  };

  const addManual = async () => {
    if (!form.employee_id || !form.date_debut || !form.date_fin) {
      toast.error("Employé, date début et date fin requis");
      return;
    }
    if (form.date_fin < form.date_debut) {
      toast.error("La date de fin doit être après la date de début");
      return;
    }
    setSaving(true);
    try {
      const absence = await createAbsence({
        employee_id: form.employee_id,
        type: form.type,
        date_debut: form.date_debut,
        date_fin: form.date_fin,
        motif: form.motif || undefined,
      });
      if (form.statut_direct === "approuvee") {
        await approveAbsence(absence.id);
      }
      toast.success("Absence enregistrée");
      setOpen(false);
      setForm(EMPTY_FORM);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const counts = {
    total: items.length,
    demande: items.filter(a => a.statut === "demande").length,
    approuvee: items.filter(a => a.statut === "approuvee").length,
  };

  return (
    <div className="space-y-6">
      <Link to="/ops/equipe" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>

      <PageHeader
        title="Demandes de congés"
        description="Validation et saisie des absences"
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Saisir une absence
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Total", value: counts.total, color: "text-foreground" },
          { label: "En attente", value: counts.demande, color: "text-amber-600" },
          { label: "Approuvées", value: counts.approuvee, color: "text-green-600" },
        ].map(s => (
          <Card key={s.label} className="p-4">
            <div className={`text-2xl font-semibold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Employé</Label>
          <Select value={filterEmp} onValueChange={setFilterEmp}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous</SelectItem>
              {allEmployees.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Statut</Label>
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous</SelectItem>
              {Object.entries(ABSENCE_STATUT_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-muted-foreground">Chargement…</div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          {items.length === 0 ? "Aucune absence enregistrée" : "Aucun résultat pour ces filtres"}
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Employé</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Du</th>
                <th className="text-left px-4 py-3">Au</th>
                <th className="text-left px-4 py-3">Jours</th>
                <th className="text-left px-4 py-3">Motif</th>
                <th className="text-left px-4 py-3">Statut</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const emp = empMap[a.employee_id];
                return (
                  <tr key={a.id} className="border-t">
                    <td className="px-4 py-3">{emp ? `${emp.prenom} ${emp.nom}` : "—"}</td>
                    <td className="px-4 py-3">{ABSENCE_TYPE_LABELS[a.type]}</td>
                    <td className="px-4 py-3">{a.date_debut}</td>
                    <td className="px-4 py-3">{a.date_fin}</td>
                    <td className="px-4 py-3">{a.nb_jours ?? "—"}</td>
                    <td className="px-4 py-3 max-w-[200px] truncate">{a.motif ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUT_COLORS[a.statut]}`}>
                        {ABSENCE_STATUT_LABELS[a.statut]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {a.statut === "demande" && (
                        refusing === a.id ? (
                          <div className="flex gap-2 justify-end items-center">
                            <Input className="w-40 h-8" placeholder="Motif" value={motif} onChange={(e) => setMotif(e.target.value)} />
                            <Button size="sm" variant="outline" onClick={() => reject(a)}>OK</Button>
                            <Button size="sm" variant="ghost" onClick={() => { setRefusing(null); setMotif(""); }}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" onClick={() => approve(a)}>
                              <Check className="h-3 w-3 mr-1" />Approuver
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setRefusing(a.id)}>
                              <X className="h-3 w-3 mr-1" />Refuser
                            </Button>
                          </div>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(EMPTY_FORM); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Saisir une absence</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Employé</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                <SelectContent>
                  {allEmployees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Type d'absence</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as AbsenceType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ABSENCE_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date de début</Label>
                <Input type="date" value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} />
              </div>
              <div>
                <Label>Date de fin</Label>
                <Input type="date" value={form.date_fin} onChange={(e) => setForm({ ...form, date_fin: e.target.value })} />
              </div>
            </div>

            <div>
              <Label>Statut</Label>
              <Select value={form.statut_direct} onValueChange={(v) => setForm({ ...form, statut_direct: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approuvee">Approuvée directement</SelectItem>
                  <SelectItem value="demande">En attente de validation</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Pour les congés déjà posés ou validés verbalement, choisir "Approuvée directement".
              </p>
            </div>

            <div>
              <Label>Motif (optionnel)</Label>
              <Input
                value={form.motif}
                onChange={(e) => setForm({ ...form, motif: e.target.value })}
                placeholder="ex : Vacances été, Congé maternité…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setForm(EMPTY_FORM); }}>
              Annuler
            </Button>
            <Button onClick={addManual} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

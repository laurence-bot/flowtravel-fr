import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, X, Plus, Trash2 } from "lucide-react";
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
  approuverRecupDemande, refuserRecupDemande, deleteRecupDemande,
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
  const [recupForm, setRecupForm] = useState({ employee_id: "", date_souhaitee: "", heure_debut: "09:00", heure_fin: "12:00", motif: "" });

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

  const recupHeures = (() => {
    if (!recupForm.heure_debut || !recupForm.heure_fin) return 0;
    const [dh, dm] = recupForm.heure_debut.split(":").map(Number);
    const [fh, fm] = recupForm.heure_fin.split(":").map(Number);
    return Math.max(0, (fh * 60 + fm) - (dh * 60 + dm)) / 60;
  })();

  const saveRecup = async () => {
    if (!recupForm.employee_id) { toast.error("Employé requis"); return; }
    if (!recupForm.date_souhaitee) { toast.error("Date souhaitée requise"); return; }
    if (recupHeures <= 0) { toast.error("Horaires invalides"); return; }
    if (!recupForm.motif.trim()) { toast.error("Motif requis"); return; }
    try {
      await createRecupDemande({
        employee_id: recupForm.employee_id,
        mois: recupForm.date_souhaitee.slice(0, 7),
        type: "heures",
        heures_demandees: Math.round(recupHeures * 100) / 100,
        date_souhaitee: recupForm.date_souhaitee,
        heure_debut: recupForm.heure_debut,
        heure_fin: recupForm.heure_fin,
        motif: recupForm.motif,
      });
      toast.success("Demande créée");
      setRecupOpen(false);
      setRecupForm({ employee_id: "", date_souhaitee: "", heure_debut: "09:00", heure_fin: "12:00", motif: "" });
      reload();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDeleteRecup = async (id: string) => {
    if (!confirm("Supprimer définitivement cette demande ?\nL'entrée planning associée sera également supprimée.")) return;
    try { await deleteRecupDemande(id); toast.success("Demande supprimée"); reload(); }
    catch (e: any) { toast.error(e.message); }
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
        title="Demandes de congés & récupérations"
        description="Validation et saisie des absences et récupérations d'heures"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setRecupOpen(true)}>+ Demande récup</Button>
            <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Saisir une absence</Button>
          </div>
        }
      />

      <Tabs defaultValue="absences">
        <TabsList>
          <TabsTrigger value="absences">Absences</TabsTrigger>
          <TabsTrigger value="recups">
            Récupérations
            {recups.filter(r => r.statut === "demande").length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-amber-500 text-white rounded">
                {recups.filter(r => r.statut === "demande").length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="absences" className="space-y-4 mt-4">

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
        <Card className="p-0 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
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
        </TabsContent>

        <TabsContent value="recups" className="mt-4">
          <Card className="p-0 overflow-hidden overflow-x-auto">
            {recups.length === 0 ? (
              <p className="p-10 text-center text-muted-foreground">Aucune demande de récupération</p>
            ) : (
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Employé</th>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Horaires</th>
                    <th className="text-right px-4 py-3">Heures</th>
                    <th className="text-left px-4 py-3">Motif</th>
                    <th className="text-left px-4 py-3">Statut</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recups.map(r => {
                    const emp = empMap[r.employee_id];
                    const statutLabel = r.statut === "approuvee" ? "Approuvée" : r.statut === "refusee" ? "Refusée" : r.statut === "annulee" ? "Annulée" : "En attente";
                    const statutClass = r.statut === "approuvee" ? "bg-green-100 text-green-700"
                      : r.statut === "refusee" ? "bg-red-100 text-red-600"
                      : r.statut === "annulee" ? "bg-zinc-100 text-zinc-500"
                      : "bg-amber-100 text-amber-700";
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="px-4 py-3">{emp ? `${emp.prenom} ${emp.nom}` : "—"}</td>
                        <td className="px-4 py-3">{r.date_souhaitee ?? r.mois}</td>
                        <td className="px-4 py-3">{r.heure_debut && r.heure_fin ? `${r.heure_debut.slice(0,5)}–${r.heure_fin.slice(0,5)}` : "—"}</td>
                        <td className="px-4 py-3 text-right">{r.heures_demandees}h</td>
                        <td className="px-4 py-3 max-w-[240px] truncate">{r.motif ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statutClass}`}>{statutLabel}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-1 justify-end">
                            {r.statut === "demande" && (
                              <>
                                <Button size="sm" onClick={async () => {
                                  try { await approuverRecupDemande(r.id); toast.success("Approuvée — entrée ajoutée au planning"); reload(); }
                                  catch (e: any) { toast.error(e.message); }
                                }}><Check className="h-3 w-3" /></Button>
                                <Button size="sm" variant="outline" onClick={async () => {
                                  try { await refuserRecupDemande(r.id); toast.success("Refusée"); reload(); }
                                  catch (e: any) { toast.error(e.message); }
                                }}><X className="h-3 w-3" /></Button>
                              </>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteRecup(r.id)} title="Supprimer">
                              <Trash2 className="h-3 w-3 text-red-600" />
                            </Button>
                          </div>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      <Dialog open={recupOpen} onOpenChange={setRecupOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Demande de récupération d'heures</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Employé</Label>
              <Select value={recupForm.employee_id} onValueChange={(v) => setRecupForm({ ...recupForm, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {allEmployees.map(e => <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date souhaitée *</Label>
              <Input type="date" value={recupForm.date_souhaitee} onChange={(e) => setRecupForm({ ...recupForm, date_souhaitee: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Heure de début *</Label>
                <Input type="time" step={900} value={recupForm.heure_debut} onChange={(e) => setRecupForm({ ...recupForm, heure_debut: e.target.value })} />
              </div>
              <div>
                <Label>Heure de fin *</Label>
                <Input type="time" step={900} value={recupForm.heure_fin} onChange={(e) => setRecupForm({ ...recupForm, heure_fin: e.target.value })} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Durée calculée : {(() => {
                const v = Math.max(0, recupHeures);
                const h = Math.floor(v);
                const m = Math.round((v - h) * 60);
                return `${h}h ${m.toString().padStart(2, "0")} min`;
              })()}
            </p>
            <div>
              <Label>Motif *</Label>
              <Textarea rows={2} value={recupForm.motif} onChange={(e) => setRecupForm({ ...recupForm, motif: e.target.value })} required />
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

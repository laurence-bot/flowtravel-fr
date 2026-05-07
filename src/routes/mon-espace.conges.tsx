import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { getEmployeeByUserId, listAbsences, createAbsence, ABSENCE_TYPE_LABELS, ABSENCE_STATUT_LABELS, type Employee, type Absence, type AbsenceType, computeWorkingDays, listRecupDemandes, createRecupDemande, annulerRecupDemande, type RecupDemande } from "@/lib/hr";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const RECUP_STATUT_LABELS: Record<RecupDemande["statut"], string> = { demande: "En attente", approuvee: "Approuvée", refusee: "Refusée", annulee: "Annulée" };

export const Route = createFileRoute("/mon-espace/conges")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
  },
  component: () => <AppLayout><CongesPage /></AppLayout>,
});

function CongesPage() {
  const [emp, setEmp] = useState<Employee | null>(null);
  const [items, setItems] = useState<Absence[]>([]);
  const [recups, setRecups] = useState<RecupDemande[]>([]);
  const [open, setOpen] = useState(false);
  const [recupOpen, setRecupOpen] = useState(false);
  const [form, setForm] = useState({ type: "conge_paye" as AbsenceType, date_debut: "", date_fin: "", motif: "" });
  const [recupForm, setRecupForm] = useState({ date_souhaitee: "", heure_debut: "09:00", heure_fin: "12:00", motif: "" });

  const recupHeures = (() => {
    const { heure_debut, heure_fin } = recupForm;
    if (!heure_debut || !heure_fin) return 0;
    const [dh, dm] = heure_debut.split(":").map(Number);
    const [fh, fm] = heure_fin.split(":").map(Number);
    const min = (fh * 60 + fm) - (dh * 60 + dm);
    return Math.max(0, min) / 60;
  })();

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const e = await getEmployeeByUserId(user.id);
    setEmp(e);
    if (e) {
      setItems(await listAbsences(e.id));
      const allRecups = await listRecupDemandes();
      setRecups(allRecups.filter(r => r.employee_id === e.id));
    }
  };
  useEffect(() => { load().catch(err => toast.error(err.message)); }, []);

  const submit = async () => {
    if (!emp || !form.date_debut || !form.date_fin) return;
    try { await createAbsence({ employee_id: emp.id, ...form }); setOpen(false); setForm({ type: "conge_paye", date_debut: "", date_fin: "", motif: "" }); load(); toast.success("Demande envoyée"); }
    catch (e: any) { toast.error(e.message); }
  };

  const submitRecup = async () => {
    if (!emp) return;
    if (!recupForm.date_souhaitee) { toast.error("Date souhaitée requise"); return; }
    if (!recupForm.heure_debut || !recupForm.heure_fin) { toast.error("Heures requises"); return; }
    if (recupHeures <= 0) { toast.error("L'heure de fin doit être après l'heure de début"); return; }
    if (!recupForm.motif.trim()) { toast.error("Motif requis"); return; }
    const mois = recupForm.date_souhaitee.slice(0, 7);
    try {
      await createRecupDemande({
        employee_id: emp.id,
        mois,
        type: "heures",
        heures_demandees: Math.round(recupHeures * 100) / 100,
        date_souhaitee: recupForm.date_souhaitee,
        heure_debut: recupForm.heure_debut,
        heure_fin: recupForm.heure_fin,
        motif: recupForm.motif,
      });
      setRecupOpen(false);
      setRecupForm({ date_souhaitee: "", heure_debut: "09:00", heure_fin: "12:00", motif: "" });
      load();
      toast.success("Demande de récupération envoyée");
    } catch (e: any) { toast.error(e.message); }
  };

  const cancelRecup = async (id: string) => {
    if (!confirm("Annuler cette demande ?")) return;
    try { await annulerRecupDemande(id); load(); toast.success("Demande annulée"); }
    catch (e: any) { toast.error(e.message); }
  };

  if (!emp) return <Card className="p-10 text-center">Aucune fiche employé liée à votre compte.</Card>;

  // soldes simples
  const taken = (t: AbsenceType) => items.filter(a => a.type === t && (a.statut === "approuvee" || a.statut === "signee")).reduce((s, a) => s + Number(a.nb_jours ?? 0), 0);
  const cpRest = (emp.jours_conges_par_an ?? 0) - taken("conge_paye");
  const rttRest = (emp.jours_rtt_par_an ?? 0) - taken("rtt");

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-display text-3xl">Mes congés</h1>
          <p className="text-muted-foreground">Demandes & soldes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRecupOpen(true)}>Demander une récup</Button>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Demander congé</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4"><div className="text-xs uppercase text-muted-foreground">Congés payés restants</div><div className="text-3xl font-display">{cpRest}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase text-muted-foreground">RTT restants</div><div className="text-3xl font-display">{rttRest}</div></Card>
      </div>

      <Card className="p-0 overflow-hidden">
        {items.length === 0 ? <div className="p-10 text-center text-muted-foreground">Aucune demande</div> :
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left px-4 py-3">Type</th><th className="text-left px-4 py-3">Du</th><th className="text-left px-4 py-3">Au</th><th className="text-left px-4 py-3">Jours</th><th className="text-left px-4 py-3">Statut</th></tr>
            </thead>
            <tbody>{items.map(a => (
              <tr key={a.id} className="border-t">
                <td className="px-4 py-2">{ABSENCE_TYPE_LABELS[a.type]}</td>
                <td className="px-4 py-2">{a.date_debut}</td>
                <td className="px-4 py-2">{a.date_fin}</td>
                <td className="px-4 py-2">{a.nb_jours ?? "—"}</td>
                <td className="px-4 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-muted">{ABSENCE_STATUT_LABELS[a.statut]}</span></td>
              </tr>
            ))}</tbody>
          </table>
        }
      </Card>

      {recups.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/40 text-xs uppercase text-muted-foreground">Demandes de récupération</div>
          <table className="w-full text-sm">
            <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left px-4 py-2">Date</th><th className="text-left px-4 py-2">Horaires</th><th className="text-left px-4 py-2">Heures</th><th className="text-left px-4 py-2">Motif</th><th className="text-left px-4 py-2">Statut</th><th className="text-right px-4 py-2"></th></tr>
            </thead>
            <tbody>{recups.map(r => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2">{r.date_souhaitee ?? r.mois}</td>
                <td className="px-4 py-2">{r.heure_debut && r.heure_fin ? `${r.heure_debut.slice(0,5)}–${r.heure_fin.slice(0,5)}` : "—"}</td>
                <td className="px-4 py-2">{r.heures_demandees}h</td>
                <td className="px-4 py-2 max-w-[260px] truncate">{r.motif ?? "—"}</td>
                <td className="px-4 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-muted">{RECUP_STATUT_LABELS[r.statut]}</span></td>
                <td className="px-4 py-2 text-right">
                  {r.statut === "demande" && (
                    <Button size="sm" variant="ghost" onClick={() => cancelRecup(r.id)}>Annuler</Button>
                  )}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle demande</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as AbsenceType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(ABSENCE_TYPE_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Du</Label><Input type="date" value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} /></div>
              <div><Label>Au</Label><Input type="date" value={form.date_fin} onChange={(e) => setForm({ ...form, date_fin: e.target.value })} /></div>
            </div>
            {form.date_debut && form.date_fin && <p className="text-xs text-muted-foreground">{computeWorkingDays(form.date_debut, form.date_fin)} jours ouvrés</p>}
            <div><Label>Motif (optionnel)</Label><Input value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit}>Envoyer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recupOpen} onOpenChange={setRecupOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Demander une récupération</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Date souhaitée *</Label>
              <Input type="date" value={recupForm.date_souhaitee} onChange={(e) => setRecupForm({ ...recupForm, date_souhaitee: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              Durée : {(() => {
                const v = Math.max(0, recupHeures);
                const h = Math.floor(v);
                const m = Math.round((v - h) * 60);
                return `${h}h ${m.toString().padStart(2, "0")} min`;
              })()}
            </p>
            <div><Label>Motif *</Label><Textarea rows={3} value={recupForm.motif} onChange={(e) => setRecupForm({ ...recupForm, motif: e.target.value })} placeholder="Ex : rendez-vous médical, démarches administratives…" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecupOpen(false)}>Annuler</Button>
            <Button onClick={submitRecup}>Envoyer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

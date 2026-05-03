import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { listAbsences, approveAbsence, rejectAbsence, ABSENCE_TYPE_LABELS, ABSENCE_STATUT_LABELS, type Absence } from "@/lib/hr";
import { supabase } from "@/integrations/supabase/client";
import { sendTransactionalEmail } from "@/lib/email/send";
import { toast } from "sonner";

export const Route = createFileRoute("/ops/equipe/absences")({ component: AbsencesPage });

function AbsencesPage() {
  const [items, setItems] = useState<Absence[]>([]);
  const [employees, setEmployees] = useState<Record<string, { prenom: string; nom: string; email: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [refusing, setRefusing] = useState<string | null>(null);
  const [motif, setMotif] = useState("");

  const reload = async () => {
    setLoading(true);
    try {
      const data = await listAbsences();
      setItems(data);
      const ids = Array.from(new Set(data.map((a) => a.employee_id)));
      if (ids.length) {
        const { data: emps } = await supabase.from("hr_employees").select("id, prenom, nom, email").in("id", ids);
        const map: any = {};
        (emps ?? []).forEach((e: any) => { map[e.id] = e; });
        setEmployees(map);
      }
    } finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const approve = async (a: Absence) => {
    try {
      await approveAbsence(a.id);
      const emp = employees[a.employee_id];
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
      const emp = employees[a.employee_id];
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

  return (
    <div className="space-y-6">
      <Link to="/ops/equipe" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>
      <PageHeader title="Demandes de congés" description="Validation des absences soumises" />
      {loading ? <div className="p-10 text-center text-muted-foreground">Chargement…</div> :
       items.length === 0 ? <Card className="p-10 text-center text-muted-foreground">Aucune demande</Card> :
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Employé</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Du</th>
                <th className="text-left px-4 py-3">Au</th>
                <th className="text-left px-4 py-3">Jours</th>
                <th className="text-left px-4 py-3">Statut</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => {
                const emp = employees[a.employee_id];
                return (
                  <tr key={a.id} className="border-t">
                    <td className="px-4 py-3">{emp ? `${emp.prenom} ${emp.nom}` : "—"}</td>
                    <td className="px-4 py-3">{ABSENCE_TYPE_LABELS[a.type]}</td>
                    <td className="px-4 py-3">{a.date_debut}</td>
                    <td className="px-4 py-3">{a.date_fin}</td>
                    <td className="px-4 py-3">{a.nb_jours ?? "—"}</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-muted">{ABSENCE_STATUT_LABELS[a.statut]}</span></td>
                    <td className="px-4 py-3 text-right">
                      {a.statut === "demande" && (
                        refusing === a.id ? (
                          <div className="flex gap-2 justify-end items-center">
                            <Input className="w-40 h-8" placeholder="Motif" value={motif} onChange={(e) => setMotif(e.target.value)} />
                            <Button size="sm" variant="outline" onClick={() => reject(a)}>OK</Button>
                            <Button size="sm" variant="ghost" onClick={() => { setRefusing(null); setMotif(""); }}>X</Button>
                          </div>
                        ) : (
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" onClick={() => approve(a)}><Check className="h-3 w-3 mr-1" />Approuver</Button>
                            <Button size="sm" variant="outline" onClick={() => setRefusing(a.id)}><X className="h-3 w-3 mr-1" />Refuser</Button>
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
      }
    </div>
  );
}

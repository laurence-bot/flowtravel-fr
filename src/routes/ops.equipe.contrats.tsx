import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, FileText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { listContracts, createContract, sendContractForSignature, listEmployees, CONTRACT_TYPE_LABELS, type Contract, type Employee, type ContractType } from "@/lib/hr";
import { sendTransactionalEmail } from "@/lib/email/send";
import { toast } from "sonner";

export const Route = createFileRoute("/ops/equipe/contrats")({ component: ContractsPage });

function ContractsPage() {
  const [items, setItems] = useState<Contract[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: "", titre: "", type_contrat: "cdi" as ContractType, date_debut: "", date_fin: "", contenu_html: "" });

  const load = async () => {
    setItems(await listContracts());
    setEmployees(await listEmployees());
  };
  useEffect(() => { load().catch(e => toast.error(e.message)); }, []);

  const empById = (id: string) => employees.find(e => e.id === id);

  const create = async () => {
    if (!form.employee_id || !form.titre) { toast.error("Employé et titre requis"); return; }
    try {
      await createContract(form.employee_id, form);
      setOpen(false); setForm({ employee_id: "", titre: "", type_contrat: "cdi", date_debut: "", date_fin: "", contenu_html: "" });
      load(); toast.success("Contrat créé");
    } catch (e: any) { toast.error(e.message); }
  };

  const sendSign = async (c: Contract) => {
    try {
      await sendContractForSignature(c.id);
      const emp = empById(c.employee_id);
      if (emp?.email) {
        const sign_url = `${window.location.origin}/contrat-signer/${c.token}`;
        await sendTransactionalEmail({
          templateName: "contract-to-sign",
          recipientEmail: emp.email,
          idempotencyKey: `contract-${c.id}-send`,
          templateData: { prenom: emp.prenom, titre: c.titre, sign_url },
        });
      }
      load(); toast.success("Envoyé pour signature");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <Link to="/ops/equipe" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Retour</Link>
      <PageHeader title="Contrats" description="Documents RH avec signature électronique"
        action={<Button onClick={() => setOpen(true)}><FileText className="h-4 w-4 mr-2" />Nouveau contrat</Button>}
      />

      <Card className="p-0 overflow-hidden">
        {items.length === 0 ? <div className="p-10 text-center text-muted-foreground">Aucun contrat</div> :
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left px-4 py-3">Titre</th><th className="text-left px-4 py-3">Employé</th><th className="text-left px-4 py-3">Type</th><th className="text-left px-4 py-3">Statut</th><th className="text-right px-4 py-3">Action</th></tr>
            </thead>
            <tbody>
              {items.map(c => {
                const emp = empById(c.employee_id);
                return <tr key={c.id} className="border-t">
                  <td className="px-4 py-2">{c.titre}</td>
                  <td className="px-4 py-2">{emp?.prenom} {emp?.nom}</td>
                  <td className="px-4 py-2">{CONTRACT_TYPE_LABELS[c.type_contrat]}</td>
                  <td className="px-4 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-muted">{c.statut}</span></td>
                  <td className="px-4 py-2 text-right">
                    {c.statut === "brouillon" && <Button size="sm" onClick={() => sendSign(c)}><Send className="h-3 w-3 mr-1" />Envoyer</Button>}
                    {c.statut === "a_signer" && <a target="_blank" rel="noreferrer" href={`/contrat-signer/${c.token}`} className="text-xs text-blue-600 hover:underline">Lien signature</a>}
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        }
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nouveau contrat</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Employé</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Titre</Label><Input value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Type</Label>
                <Select value={form.type_contrat} onValueChange={(v) => setForm({ ...form, type_contrat: v as ContractType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CONTRACT_TYPE_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Début</Label><Input type="date" value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} /></div>
              <div><Label>Fin</Label><Input type="date" value={form.date_fin} onChange={(e) => setForm({ ...form, date_fin: e.target.value })} /></div>
            </div>
            <div><Label>Contenu (HTML simple ou texte)</Label><Textarea rows={8} value={form.contenu_html} onChange={(e) => setForm({ ...form, contenu_html: e.target.value })} /></div>
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

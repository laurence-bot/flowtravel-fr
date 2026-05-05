import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, FileText, Send, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import {
  listContracts, createContract, sendContractForSignature,
  listEmployees, CONTRACT_TYPE_LABELS,
  type Contract, type Employee, type ContractType,
} from "@/lib/hr";
import { sendTransactionalEmail } from "@/lib/email/send";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/ops/equipe/contrats")({ component: ContractsPage });

const STATUT_COLORS: Record<string, string> = {
  brouillon: "bg-zinc-100 text-zinc-600",
  a_signer: "bg-amber-100 text-amber-700",
  signe: "bg-green-100 text-green-700",
  archive: "bg-slate-100 text-slate-500",
  rompu: "bg-red-100 text-red-600",
};

async function uploadContractPdf(file: File, contractId: string): Promise<string> {
  const path = `contracts/${contractId}/contrat.pdf`;
  const { error } = await supabase.storage
    .from("hr-documents")
    .upload(path, file, { upsert: true, contentType: "application/pdf" });
  if (error) throw new Error(`Upload échoué : ${error.message}`);
  const { data } = supabase.storage.from("hr-documents").getPublicUrl(path);
  return data.publicUrl;
}

function ContractsPage() {
  const [items, setItems] = useState<Contract[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    employee_id: "",
    titre: "",
    type_contrat: "cdi" as ContractType,
    date_debut: "",
    date_fin: "",
    contenu_html: "",
  });

  const load = async () => {
    const [contracts, emps] = await Promise.all([listContracts(), listEmployees()]);
    setItems(contracts);
    setEmployees(emps);
  };

  useEffect(() => { load().catch((e) => toast.error(e.message)); }, []);

  const empById = (id: string) => employees.find((e) => e.id === id);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") { toast.error("Seuls les PDF sont acceptés"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Fichier trop lourd (max 10 Mo)"); return; }
    setPdfFile(file);
  };

  const resetForm = () => {
    setForm({ employee_id: "", titre: "", type_contrat: "cdi", date_debut: "", date_fin: "", contenu_html: "" });
    setPdfFile(null);
  };

  const create = async () => {
    if (!form.employee_id || !form.titre) { toast.error("Employé et titre requis"); return; }
    setUploading(true);
    try {
      const contract = await createContract(form.employee_id, {
        titre: form.titre,
        type_contrat: form.type_contrat,
        date_debut: form.date_debut || undefined,
        date_fin: form.date_fin || undefined,
        contenu_html: form.contenu_html || undefined,
      });
      if (pdfFile) {
        const pdfUrl = await uploadContractPdf(pdfFile, contract.id);
        await (supabase as any).from("hr_contracts").update({ pdf_url: pdfUrl }).eq("id", contract.id);
      }
      setOpen(false);
      resetForm();
      load();
      toast.success("Contrat créé");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
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
      load();
      toast.success("Envoyé pour signature");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <Link to="/ops/equipe" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>
      <PageHeader
        title="Contrats"
        description="Documents RH avec signature électronique"
        action={
          <Button onClick={() => setOpen(true)}>
            <FileText className="h-4 w-4 mr-2" />
            Nouveau contrat
          </Button>
        }
      />

      <Card className="p-0 overflow-hidden">
        {items.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">Aucun contrat</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Titre</th>
                <th className="text-left px-4 py-3">Employé</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Début</th>
                <th className="text-left px-4 py-3">Statut</th>
                <th className="text-left px-4 py-3">PDF</th>
                <th className="text-right px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const emp = empById(c.employee_id);
                return (
                  <tr key={c.id} className="border-t">
                    <td className="px-4 py-2">{c.titre}</td>
                    <td className="px-4 py-2">{emp ? `${emp.prenom} ${emp.nom}` : "—"}</td>
                    <td className="px-4 py-2">{CONTRACT_TYPE_LABELS[c.type_contrat]}</td>
                    <td className="px-4 py-2">{c.date_debut ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUT_COLORS[c.statut] ?? "bg-muted"}`}>
                        {c.statut}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {c.pdf_url ? (
                        <a href={c.pdf_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                          Voir PDF
                        </a>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {c.statut === "brouillon" && (
                        <Button size="sm" onClick={() => sendSign(c)}>
                          <Send className="h-3 w-3 mr-1" />
                          Envoyer
                        </Button>
                      )}
                      {c.statut === "a_signer" && (
                        <a target="_blank" rel="noreferrer" href={`/contrat-signer/${c.token}`} className="text-xs text-blue-600 hover:underline">
                          Lien signature
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nouveau contrat</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Employé</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Titre du contrat</Label>
              <Input
                value={form.titre}
                onChange={(e) => setForm({ ...form, titre: e.target.value })}
                placeholder="ex : CDI — Responsable commercial"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.type_contrat} onValueChange={(v) => setForm({ ...form, type_contrat: v as ContractType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTRACT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Début</Label>
                <Input type="date" value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} />
              </div>
              <div>
                <Label className="flex items-center gap-1">
                  Fin <span className="text-xs text-muted-foreground">(optionnel)</span>
                </Label>
                <Input
                  type="date"
                  value={form.date_fin}
                  onChange={(e) => setForm({ ...form, date_fin: e.target.value })}
                  placeholder="Laisser vide pour CDI"
                />
              </div>
            </div>

            <div>
              <Label>Document PDF (optionnel)</Label>
              <div
                className="border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-muted/40 transition"
                onClick={() => fileRef.current?.click()}
              >
                {pdfFile ? (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">{pdfFile.name}</span>
                    <span className="text-xs text-muted-foreground">({(pdfFile.size / 1024).toFixed(0)} Ko)</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setPdfFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                      className="ml-1 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
                    <Upload className="h-5 w-5" />
                    <span>Cliquer pour uploader un PDF</span>
                    <span className="text-xs">Max 10 Mo</span>
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div>
              <Label>Contenu texte (optionnel si PDF joint)</Label>
              <Textarea
                rows={6}
                value={form.contenu_html}
                onChange={(e) => setForm({ ...form, contenu_html: e.target.value })}
                placeholder="Ou saisir le contenu du contrat directement ici…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Annuler</Button>
            <Button onClick={create} disabled={uploading}>
              {uploading ? "Création…" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

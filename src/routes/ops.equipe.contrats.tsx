import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Upload, X, FileText, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import {
  listEmployees,
  listContracts,
  createContract,
  sendContractForSignature,
  listHrDocuments,
  createHrDocument,
  updateHrDocument,
  deleteHrDocument,
  uploadHrDocumentPdf,
  CONTRACT_TYPE_LABELS,
  DOC_CATEGORIE_LABELS,
  DOC_CATEGORIE_ICONS,
  type Employee,
  type Contract,
  type ContractType,
  type HrDocument,
  type DocCategorie,
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

function PdfDropZone({ file, onChange }: { file: File | null; onChange: (f: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      className="border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-muted/30 transition-colors"
      onClick={() => ref.current?.click()}
    >
      {file ? (
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-blue-600" />
          <span className="font-medium">{file.name}</span>
          <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(0)} Ko)</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              if (ref.current) ref.current.value = "";
            }}
            className="ml-1 text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
          <Upload className="h-5 w-5" />
          <span>Cliquer pour uploader un PDF</span>
          <span className="text-xs">Max 10 Mo</span>
        </div>
      )}
      <input
        ref={ref}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.type !== "application/pdf") {
            toast.error("PDF uniquement");
            return;
          }
          if (f.size > 10 * 1024 * 1024) {
            toast.error("Max 10 Mo");
            return;
          }
          onChange(f);
        }}
      />
    </div>
  );
}

function ContractsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [documents, setDocuments] = useState<HrDocument[]>([]);

  const [filterEmp, setFilterEmp] = useState("tous");
  const [filterCat, setFilterCat] = useState("tous");
  const [tab, setTab] = useState("documents");

  const [contractOpen, setContractOpen] = useState(false);
  const [contractPdf, setContractPdf] = useState<File | null>(null);
  const [contractForm, setContractForm] = useState({
    employee_id: "",
    titre: "",
    type_contrat: "cdi" as ContractType,
    date_debut: "",
    date_fin: "",
    contenu_html: "",
  });

  const [docOpen, setDocOpen] = useState(false);
  const [docPdf, setDocPdf] = useState<File | null>(null);
  const [editingDoc, setEditingDoc] = useState<HrDocument | null>(null);
  const [docForm, setDocForm] = useState({
    employee_id: "",
    categorie: "avenant" as DocCategorie,
    titre: "",
    description: "",
    date_document: "",
    necessite_signature: false,
  });

  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [emps, ctrs, docs] = await Promise.all([listEmployees(), listContracts(), listHrDocuments()]);
    setEmployees(emps);
    setContracts(ctrs);
    setDocuments(docs);
  };

  useEffect(() => {
    load().catch((e) => toast.error(e.message));
  }, []);

  const empById = (id: string) => employees.find((e) => e.id === id);

  const filteredDocs = documents.filter((d) => {
    if (filterEmp !== "tous" && d.employee_id !== filterEmp) return false;
    if (filterCat !== "tous" && d.categorie !== filterCat) return false;
    return true;
  });

  const createContractAction = async () => {
    if (!contractForm.employee_id || !contractForm.titre) {
      toast.error("Employé et titre requis");
      return;
    }
    setSaving(true);
    try {
      const contract = await createContract(contractForm.employee_id, {
        titre: contractForm.titre,
        type_contrat: contractForm.type_contrat,
        date_debut: contractForm.date_debut || undefined,
        date_fin: contractForm.date_fin || undefined,
        contenu_html: contractForm.contenu_html || undefined,
      });
      if (contractPdf) {
        const url = await uploadContractPdf(contractPdf, contract.id);
        await supabase.from("hr_contracts").update({ pdf_url: url }).eq("id", contract.id);
      }
      await createHrDocument({
        employee_id: contractForm.employee_id,
        categorie: "contrat",
        titre: contractForm.titre,
        date_document: contractForm.date_debut || undefined,
        necessite_signature: true,
      });
      setContractOpen(false);
      setContractPdf(null);
      setContractForm({
        employee_id: "",
        titre: "",
        type_contrat: "cdi",
        date_debut: "",
        date_fin: "",
        contenu_html: "",
      });
      load();
      toast.success("Contrat créé");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveDoc = async () => {
    if (!docForm.employee_id || !docForm.titre) {
      toast.error("Employé et titre requis");
      return;
    }
    setSaving(true);
    try {
      let doc: HrDocument;
      if (editingDoc) {
        await updateHrDocument(editingDoc.id, {
          categorie: docForm.categorie,
          titre: docForm.titre,
          description: docForm.description || null,
          date_document: docForm.date_document || null,
          necessite_signature: docForm.necessite_signature,
        });
        doc = { ...editingDoc, ...docForm } as HrDocument;
      } else {
        doc = await createHrDocument({
          employee_id: docForm.employee_id,
          categorie: docForm.categorie,
          titre: docForm.titre,
          description: docForm.description || undefined,
          date_document: docForm.date_document || undefined,
          necessite_signature: docForm.necessite_signature,
        });
      }
      if (docPdf) {
        const url = await uploadHrDocumentPdf(docPdf, doc.id);
        await updateHrDocument(doc.id, { pdf_url: url, statut: "brouillon" });
      }
      setDocOpen(false);
      setDocPdf(null);
      setEditingDoc(null);
      setDocForm({
        employee_id: "",
        categorie: "avenant",
        titre: "",
        description: "",
        date_document: "",
        necessite_signature: false,
      });
      load();
      toast.success(editingDoc ? "Document mis à jour" : "Document ajouté");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const openEditDoc = (doc: HrDocument) => {
    setEditingDoc(doc);
    setDocForm({
      employee_id: doc.employee_id,
      categorie: doc.categorie,
      titre: doc.titre,
      description: doc.description ?? "",
      date_document: doc.date_document ?? "",
      necessite_signature: doc.necessite_signature,
    });
    setDocPdf(null);
    setDocOpen(true);
  };

  const delDoc = async (id: string) => {
    if (!confirm("Supprimer ce document ?")) return;
    try {
      await deleteHrDocument(id);
      load();
      toast.success("Supprimé");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const sendSign = async (c: Contract) => {
    try {
      await sendContractForSignature(c.id);
      const emp = empById(c.employee_id);
      if (emp?.email) {
        await sendTransactionalEmail({
          templateName: "contract-to-sign",
          recipientEmail: emp.email,
          idempotencyKey: `contract-${c.id}-send`,
          templateData: {
            prenom: emp.prenom,
            titre: c.titre,
            sign_url: `${window.location.origin}/contrat-signer/${c.token}`,
          },
        });
      }
      load();
      toast.success("Envoyé pour signature");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        to="/ops/equipe"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>

      <PageHeader
        title="Contrats & documents RH"
        description="Tous les documents liés aux employés : contrats, avenants, déplacements, formations…"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setContractOpen(true)}>
              Nouveau contrat
            </Button>
            <Button
              onClick={() => {
                setEditingDoc(null);
                setDocForm({
                  employee_id: "",
                  categorie: "avenant",
                  titre: "",
                  description: "",
                  date_document: "",
                  necessite_signature: false,
                });
                setDocPdf(null);
                setDocOpen(true);
              }}
            >
              Ajouter un document
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="documents">
            Tous les documents
            <span className="ml-2 text-xs text-muted-foreground">({documents.length})</span>
          </TabsTrigger>
          <TabsTrigger value="contracts">
            Contrats de travail
            <span className="ml-2 text-xs text-muted-foreground">({contracts.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Employé</Label>
              <Select value={filterEmp} onValueChange={setFilterEmp}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.prenom} {e.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Catégorie</Label>
              <Select value={filterCat} onValueChange={setFilterCat}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Toutes</SelectItem>
                  {Object.entries(DOC_CATEGORIE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="p-0 overflow-auto">
            {filteredDocs.length === 0 ? (
              <p className="p-10 text-center text-muted-foreground">
                {documents.length === 0
                  ? "Aucun document — commencez par en ajouter un"
                  : "Aucun résultat pour ces filtres"}
              </p>
            ) : (
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-muted/30 border-b">
                  <tr>
                    <th className="text-left px-3 py-2">Document</th>
                    <th className="text-left px-3 py-2">Employé</th>
                    <th className="text-left px-3 py-2">Catégorie</th>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2">Statut</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map((doc) => {
                    const emp = empById(doc.employee_id);
                    return (
                      <tr key={doc.id} className="border-b">
                        <td className="px-3 py-2">
                          <div className="flex items-start gap-2">
                            <span className="text-lg leading-none">{DOC_CATEGORIE_ICONS[doc.categorie]}</span>
                            <div>
                              <div className="font-medium">{doc.titre}</div>
                              {doc.description && (
                                <div className="text-xs text-muted-foreground">{doc.description}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">{emp ? `${emp.prenom} ${emp.nom}` : "—"}</td>
                        <td className="px-3 py-2 text-xs">{DOC_CATEGORIE_LABELS[doc.categorie]}</td>
                        <td className="px-3 py-2">{doc.date_document ?? "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${STATUT_COLORS[doc.statut] ?? ""}`}>
                            {doc.statut}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1 justify-end">
                            {doc.pdf_url && (
                              <a href={doc.pdf_url} target="_blank" rel="noreferrer">
                                <Button size="sm" variant="ghost">
                                  PDF
                                </Button>
                              </a>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => openEditDoc(doc)}>
                              Modifier
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => delDoc(doc.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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

        <TabsContent value="contracts">
          <Card className="p-0 overflow-auto">
            {contracts.length === 0 ? (
              <p className="p-10 text-center text-muted-foreground">Aucun contrat de travail</p>
            ) : (
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-muted/30 border-b">
                  <tr>
                    <th className="text-left px-3 py-2">Titre</th>
                    <th className="text-left px-3 py-2">Employé</th>
                    <th className="text-left px-3 py-2">Type</th>
                    <th className="text-left px-3 py-2">Début</th>
                    <th className="text-left px-3 py-2">Statut</th>
                    <th className="text-left px-3 py-2">PDF</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => {
                    const emp = empById(c.employee_id);
                    return (
                      <tr key={c.id} className="border-b">
                        <td className="px-3 py-2 font-medium">{c.titre}</td>
                        <td className="px-3 py-2">{emp ? `${emp.prenom} ${emp.nom}` : "—"}</td>
                        <td className="px-3 py-2">{CONTRACT_TYPE_LABELS[c.type_contrat]}</td>
                        <td className="px-3 py-2">{c.date_debut ?? "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${STATUT_COLORS[c.statut] ?? ""}`}>
                            {c.statut}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {c.pdf_url ? (
                            <a
                              href={c.pdf_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline text-xs"
                            >
                              Voir PDF
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {c.statut === "brouillon" && (
                            <Button size="sm" onClick={() => sendSign(c)}>
                              <Send className="h-3.5 w-3.5 mr-1" /> Envoyer
                            </Button>
                          )}
                          {c.statut === "a_signer" && (
                            <a
                              href={`/contrat-signer/${c.token}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
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
        </TabsContent>
      </Tabs>

      {/* Modal nouveau contrat */}
      <Dialog
        open={contractOpen}
        onOpenChange={(v) => {
          setContractOpen(v);
          if (!v) setContractPdf(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau contrat de travail</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label>Employé</Label>
              <Select
                value={contractForm.employee_id}
                onValueChange={(v) => setContractForm({ ...contractForm, employee_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir…" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.prenom} {e.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Titre</Label>
              <Input
                value={contractForm.titre}
                onChange={(e) => setContractForm({ ...contractForm, titre: e.target.value })}
                placeholder="ex : CDI — Agent de voyages"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={contractForm.type_contrat}
                  onValueChange={(v) => setContractForm({ ...contractForm, type_contrat: v as ContractType, date_fin: v === "cdi" ? "" : contractForm.date_fin })}
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
              <div className="space-y-1.5">
                <Label>Début</Label>
                <Input
                  type="date"
                  value={contractForm.date_debut}
                  onChange={(e) => setContractForm({ ...contractForm, date_debut: e.target.value })}
                />
              </div>
              {contractForm.type_contrat !== "cdi" && (
                <div className="space-y-1.5">
                  <Label>Fin</Label>
                  <Input
                    type="date"
                    value={contractForm.date_fin}
                    onChange={(e) => setContractForm({ ...contractForm, date_fin: e.target.value })}
                  />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Document PDF</Label>
              <PdfDropZone file={contractPdf} onChange={setContractPdf} />
            </div>
            <div className="space-y-1.5">
              <Label>Contenu texte (optionnel si PDF)</Label>
              <Textarea
                rows={3}
                value={contractForm.contenu_html}
                onChange={(e) => setContractForm({ ...contractForm, contenu_html: e.target.value })}
                placeholder="Ou saisir le contenu ici…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContractOpen(false)}>
              Annuler
            </Button>
            <Button onClick={createContractAction} disabled={saving}>
              {saving ? "Création…" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal document RH */}
      <Dialog
        open={docOpen}
        onOpenChange={(v) => {
          setDocOpen(v);
          if (!v) {
            setEditingDoc(null);
            setDocPdf(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingDoc ? "Modifier le document" : "Ajouter un document"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            {!editingDoc && (
              <div className="space-y-1.5">
                <Label>Employé</Label>
                <Select value={docForm.employee_id} onValueChange={(v) => setDocForm({ ...docForm, employee_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir…" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.prenom} {e.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Select
                value={docForm.categorie}
                onValueChange={(v) => setDocForm({ ...docForm, categorie: v as DocCategorie })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_CATEGORIE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {DOC_CATEGORIE_ICONS[k as DocCategorie]} {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Titre</Label>
              <Input
                value={docForm.titre}
                onChange={(e) => setDocForm({ ...docForm, titre: e.target.value })}
                placeholder="ex : Avenant télétravail — juin 2026"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date du document</Label>
                <Input
                  type="date"
                  value={docForm.date_document}
                  onChange={(e) => setDocForm({ ...docForm, date_document: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={docForm.necessite_signature}
                    onChange={(e) => setDocForm({ ...docForm, necessite_signature: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Signature requise</span>
                </label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>
                Description <span className="text-xs text-muted-foreground">(optionnel)</span>
              </Label>
              <Textarea
                rows={2}
                value={docForm.description}
                onChange={(e) => setDocForm({ ...docForm, description: e.target.value })}
                placeholder="Contexte, objet du document…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fichier PDF</Label>
              <PdfDropZone file={docPdf} onChange={setDocPdf} />
              {editingDoc?.pdf_url && !docPdf && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  <a
                    href={editingDoc.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Voir PDF existant
                  </a>
                  <span>— uploader un nouveau pour remplacer</span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocOpen(false)}>
              Annuler
            </Button>
            <Button onClick={saveDoc} disabled={saving}>
              {saving ? "Enregistrement…" : editingDoc ? "Mettre à jour" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { PageHeader } from "@/components/page-header";
import { ReadOnlyShield } from "@/components/read-only-shield";
import { usePageWriteAccess } from "@/hooks/use-page-write-access";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";
import {
  FileScan,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
} from "lucide-react";
import {
  extractTextFromPdf,
  extractSupplierContractFromPdf,
  extractFxCoverageFromPdf,
  validatePdfImportBeforeCreation,
  uploadPdfToStorage,
  type Confiance,
  type SupplierContractData,
  type FxCoverageData,
  type PdfImportType,
} from "@/lib/pdf-import";
import { DEVISES, type DeviseCode } from "@/lib/fx";

export const Route = createFileRoute("/import-pdf")({
  component: () => (
    <RequireAuth>
      <ImportPdfPage />
    </RequireAuth>
  ),
});

type Step = "upload" | "extracting" | "preview" | "done";

const CONF_BADGE: Record<Confiance, { label: string; className: string }> = {
  elevee: {
    label: "Confiance élevée",
    className:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
  moyenne: {
    label: "Confiance moyenne",
    className:
      "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  faible: {
    label: "Confiance faible",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
};

function ImportPdfPage() {
  const { user } = useAuth();
  const { canWrite } = usePageWriteAccess();

  const [type, setType] = useState<PdfImportType>("contrat_fournisseur");
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [confiance, setConfiance] = useState<Confiance>("moyenne");
  const [supplier, setSupplier] = useState<SupplierContractData>({});
  const [fx, setFx] = useState<FxCoverageData>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setSupplier({});
    setFx({});
    setConfiance("moyenne");
    setErrorMsg(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onFile = async (f: File | null) => {
    if (!f) return;
    if (f.type !== "application/pdf") {
      toast.error("Merci de fournir un fichier PDF.");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error("Le PDF dépasse 20 Mo.");
      return;
    }
    setFile(f);
    setErrorMsg(null);
    setStep("extracting");

    try {
      const text = await extractTextFromPdf(f);
      if (!text || text.length < 30) {
        setErrorMsg(
          "Texte illisible (PDF scanné ou image). Saisissez les champs manuellement.",
        );
        setConfiance("faible");
        setStep("preview");
        return;
      }

      if (type === "couverture_fx") {
        const res = await extractFxCoverageFromPdf(text);
        if (res.error) toast.warning(res.error);
        setFx(res.data);
        setConfiance(res.confiance);
      } else {
        const res = await extractSupplierContractFromPdf(text);
        if (res.error) toast.warning(res.error);
        setSupplier(res.data);
        setConfiance(res.confiance);
      }
      setStep("preview");
    } catch (e) {
      console.error(e);
      setErrorMsg(
        e instanceof Error ? e.message : "Impossible de lire le PDF.",
      );
      setConfiance("faible");
      setStep("preview");
    }
  };

  const handleValidate = async () => {
    if (!user) return;
    const data = type === "couverture_fx" ? fx : supplier;
    const v = validatePdfImportBeforeCreation(type, data);
    if (!v.ok) {
      toast.error(v.errors.join(" "));
      return;
    }
    setSubmitting(true);
    try {
      // 1. upload du PDF (si fichier)
      let storagePath = "";
      if (file) {
        const up = await uploadPdfToStorage(user.id, file);
        if (up.error) {
          toast.warning(`PDF non sauvegardé : ${up.error}`);
        } else if (up.path) {
          storagePath = up.path;
        }
      }

      // 2. journal d'import
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: importRow, error: importErr } = await (supabase as any)
        .from("pdf_imports")
        .insert({
          user_id: user.id,
          type,
          storage_path: storagePath,
          file_name: file?.name ?? "saisie_manuelle.pdf",
          extracted_data: data as Record<string, unknown>,
          confiance,
          statut: "extrait",
        })
        .select()
        .single();
      if (importErr) throw importErr;

      // 3. création métier
      if (type === "couverture_fx") {
        const created = await createCoverage(user.id, fx);
        await supabase
          .from("pdf_imports")
          .update({ statut: "valide", fx_coverage_id: created.id })
          .eq("id", importRow.id);
        await logAudit({
          userId: user.id,
          entity: "fx_coverage",
          entityId: created.id,
          action: "create",
          description: `Couverture FX créée depuis PDF (${file?.name ?? ""})`,
          newValue: created,
        });
        toast.success("Couverture FX créée.");
      } else {
        const facture = await createSupplierInvoice(user.id, supplier);
        await supabase
          .from("pdf_imports")
          .update({ statut: "valide", facture_fournisseur_id: facture.id })
          .eq("id", importRow.id);
        await logAudit({
          userId: user.id,
          entity: "facture_fournisseur",
          entityId: facture.id,
          action: "create",
          description: `Facture fournisseur créée depuis PDF (${file?.name ?? ""})`,
          newValue: facture,
        });
        toast.success("Facture fournisseur créée.");
      }

      await logAudit({
        userId: user.id,
        entity: "pdf_import",
        entityId: importRow.id,
        action: "import",
        description: `Import PDF validé (${type})`,
      });

      setStep("done");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Échec de la création.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import PDF"
        description="Importez un contrat fournisseur ou une couverture FX. L'IA extrait, vous validez."
      />

      {!canWrite && (
        <ReadOnlyShield>
          <span />
        </ReadOnlyShield>
      )}

      {step === "upload" && (
        <Card className="p-6 space-y-6">
          <div>
            <Label className="mb-3 block">Type de document</Label>
            <RadioGroup
              value={type}
              onValueChange={(v) => setType(v as PdfImportType)}
              className="grid sm:grid-cols-2 gap-3"
            >
              <label
                htmlFor="t-supplier"
                className="flex items-start gap-3 rounded-lg border border-border p-4 cursor-pointer hover:border-primary"
              >
                <RadioGroupItem id="t-supplier" value="contrat_fournisseur" />
                <div>
                  <div className="font-medium">Contrat fournisseur</div>
                  <div className="text-xs text-muted-foreground">
                    Facture / devis fournisseur, échéances, devise.
                  </div>
                </div>
              </label>
              <label
                htmlFor="t-fx"
                className="flex items-start gap-3 rounded-lg border border-border p-4 cursor-pointer hover:border-primary"
              >
                <RadioGroupItem id="t-fx" value="couverture_fx" />
                <div>
                  <div className="font-medium">Couverture FX (Ebury)</div>
                  <div className="text-xs text-muted-foreground">
                    Contrat de couverture de change, taux, montant.
                  </div>
                </div>
              </label>
            </RadioGroup>
          </div>

          <div className="border-2 border-dashed border-border rounded-lg p-10 text-center">
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Glissez un PDF ou cliquez pour sélectionner (20 Mo max)
            </p>
            <Input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              disabled={!canWrite}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={!canWrite}
            >
              <Upload className="h-4 w-4 mr-2" /> Choisir un PDF
            </Button>
          </div>
        </Card>
      )}

      {step === "extracting" && (
        <Card className="p-10 text-center">
          <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary mb-3" />
          <p className="text-sm text-muted-foreground">
            Lecture du PDF puis analyse IA en cours…
          </p>
        </Card>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <Card className="p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <div className="text-sm">
                <div className="font-medium">{file?.name ?? "Saisie manuelle"}</div>
                <div className="text-muted-foreground">
                  Vérifiez et corrigez les champs avant validation.
                </div>
              </div>
            </div>
            <Badge
              variant="outline"
              className={CONF_BADGE[confiance].className}
            >
              {CONF_BADGE[confiance].label}
            </Badge>
          </Card>

          {confiance === "faible" && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Vérification manuelle recommandée</AlertTitle>
              <AlertDescription>
                L'extraction automatique est peu fiable. Contrôlez chaque champ.
              </AlertDescription>
            </Alert>
          )}
          {errorMsg && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          {type === "contrat_fournisseur" ? (
            <SupplierForm value={supplier} onChange={setSupplier} />
          ) : (
            <FxForm value={fx} onChange={setFx} />
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={reset} disabled={submitting}>
              Annuler
            </Button>
            <Button
              onClick={handleValidate}
              disabled={submitting || !canWrite}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Valider et créer
            </Button>
          </div>
        </div>
      )}

      {step === "done" && (
        <Card className="p-10 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 mb-3" />
          <p className="font-medium mb-2">Import validé</p>
          <p className="text-sm text-muted-foreground mb-4">
            L'entité a été créée et journalisée dans l'audit.
          </p>
          <Button onClick={reset}>Importer un autre PDF</Button>
        </Card>
      )}
    </div>
  );
}

/* ------- Sous-formulaires ------- */

function SupplierForm({
  value,
  onChange,
}: {
  value: SupplierContractData;
  onChange: (v: SupplierContractData) => void;
}) {
  const set = <K extends keyof SupplierContractData>(
    k: K,
    v: SupplierContractData[K],
  ) => onChange({ ...value, [k]: v });

  return (
    <Card className="p-6 space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Fournisseur *">
          <Input
            value={value.fournisseur_nom ?? ""}
            onChange={(e) => set("fournisseur_nom", e.target.value)}
          />
        </Field>
        <Field label="Référence dossier / voyage">
          <Input
            value={value.dossier_reference ?? ""}
            onChange={(e) => set("dossier_reference", e.target.value)}
          />
        </Field>
        <Field label="Devise *">
          <Select
            value={value.devise ?? ""}
            onValueChange={(v) => set("devise", v as DeviseCode)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choisir" />
            </SelectTrigger>
            <SelectContent>
              {DEVISES.map((d) => (
                <SelectItem key={d.code} value={d.code}>
                  {d.code} — {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Montant en devise *">
          <Input
            type="number"
            step="0.01"
            value={value.montant_devise ?? ""}
            onChange={(e) =>
              set("montant_devise", e.target.value ? Number(e.target.value) : undefined)
            }
          />
        </Field>
        <Field label="Taux de change (vers EUR)">
          <Input
            type="number"
            step="0.0001"
            value={value.taux_change ?? ""}
            onChange={(e) =>
              set("taux_change", e.target.value ? Number(e.target.value) : undefined)
            }
          />
        </Field>
        <Field label="Contre-valeur EUR">
          <Input
            type="number"
            step="0.01"
            value={value.montant_eur ?? ""}
            onChange={(e) =>
              set("montant_eur", e.target.value ? Number(e.target.value) : undefined)
            }
          />
        </Field>
        <Field label="Date d'échéance solde">
          <Input
            type="date"
            value={value.date_echeance ?? ""}
            onChange={(e) => set("date_echeance", e.target.value)}
          />
        </Field>
        <Field label="Référence fournisseur">
          <Input
            value={value.reference_fournisseur ?? ""}
            onChange={(e) => set("reference_fournisseur", e.target.value)}
          />
        </Field>
      </div>
      <Field label="Description / prestation">
        <Textarea
          value={value.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
          rows={2}
        />
      </Field>
      <Field label="Conditions de paiement">
        <Textarea
          value={value.conditions_paiement ?? ""}
          onChange={(e) => set("conditions_paiement", e.target.value)}
          rows={2}
        />
      </Field>

      {value.echeances && value.echeances.length > 0 && (
        <div>
          <Label className="mb-2 block">Échéances détectées</Label>
          <div className="space-y-2">
            {value.echeances.map((e, i) => (
              <div key={i} className="grid md:grid-cols-3 gap-2 items-center">
                <Input
                  value={e.type}
                  onChange={(ev) => {
                    const arr = [...(value.echeances ?? [])];
                    arr[i] = { ...e, type: ev.target.value as typeof e.type };
                    set("echeances", arr);
                  }}
                />
                <Input
                  type="date"
                  value={e.date_echeance ?? ""}
                  onChange={(ev) => {
                    const arr = [...(value.echeances ?? [])];
                    arr[i] = { ...e, date_echeance: ev.target.value };
                    set("echeances", arr);
                  }}
                />
                <Input
                  type="number"
                  step="0.01"
                  value={e.montant_devise}
                  onChange={(ev) => {
                    const arr = [...(value.echeances ?? [])];
                    arr[i] = { ...e, montant_devise: Number(ev.target.value) };
                    set("echeances", arr);
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function FxForm({
  value,
  onChange,
}: {
  value: FxCoverageData;
  onChange: (v: FxCoverageData) => void;
}) {
  const set = <K extends keyof FxCoverageData>(k: K, v: FxCoverageData[K]) =>
    onChange({ ...value, [k]: v });
  return (
    <Card className="p-6 space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Référence contrat">
          <Input
            value={value.reference ?? ""}
            onChange={(e) => set("reference", e.target.value)}
          />
        </Field>
        <Field label="Banque / plateforme">
          <Input
            value={value.banque ?? "Ebury"}
            onChange={(e) => set("banque", e.target.value)}
          />
        </Field>
        <Field label="Devise achetée *">
          <Select
            value={value.devise ?? ""}
            onValueChange={(v) => set("devise", v as DeviseCode)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choisir" />
            </SelectTrigger>
            <SelectContent>
              {DEVISES.filter((d) => d.code !== "EUR").map((d) => (
                <SelectItem key={d.code} value={d.code}>
                  {d.code} — {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Montant devise *">
          <Input
            type="number"
            step="0.01"
            value={value.montant_devise ?? ""}
            onChange={(e) =>
              set("montant_devise", e.target.value ? Number(e.target.value) : undefined)
            }
          />
        </Field>
        <Field label="Taux de change *">
          <Input
            type="number"
            step="0.0001"
            value={value.taux_change ?? ""}
            onChange={(e) =>
              set("taux_change", e.target.value ? Number(e.target.value) : undefined)
            }
          />
        </Field>
        <Field label="Contre-valeur EUR (calculée)">
          <Input
            type="number"
            step="0.01"
            value={
              value.montant_eur ??
              (value.montant_devise && value.taux_change
                ? Number((value.montant_devise * value.taux_change).toFixed(2))
                : "")
            }
            onChange={(e) =>
              set("montant_eur", e.target.value ? Number(e.target.value) : undefined)
            }
          />
        </Field>
        <Field label="Date d'ouverture">
          <Input
            type="date"
            value={value.date_ouverture ?? ""}
            onChange={(e) => set("date_ouverture", e.target.value)}
          />
        </Field>
        <Field label="Date d'échéance *">
          <Input
            type="date"
            value={value.date_echeance ?? ""}
            onChange={(e) => set("date_echeance", e.target.value)}
          />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea
          value={value.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
          rows={2}
        />
      </Field>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/* ------- Création métier ------- */

async function createCoverage(userId: string, d: FxCoverageData) {
  const montantEur =
    d.montant_eur ??
    (d.montant_devise && d.taux_change
      ? d.montant_devise * d.taux_change
      : 0);
  const { data, error } = await supabase
    .from("fx_coverages")
    .insert({
      user_id: userId,
      reference: d.reference ?? null,
      devise: d.devise!,
      montant_devise: d.montant_devise!,
      taux_change: d.taux_change!,
      date_ouverture: d.date_ouverture ?? new Date().toISOString().slice(0, 10),
      date_echeance: d.date_echeance!,
      statut: "ouverte",
      notes: [d.banque ? `Banque: ${d.banque}` : "", d.notes ?? ""]
        .filter(Boolean)
        .join("\n") || null,
    })
    .select()
    .single();
  if (error) throw error;
  // Conserver montantEur dans une note d'audit (montant_eur n'est pas stocké directement sur la couverture)
  void montantEur;
  return data;
}

async function findOrCreateFournisseur(userId: string, nom: string) {
  const { data: existing } = await supabase
    .from("contacts")
    .select("*")
    .eq("user_id", userId)
    .eq("type", "fournisseur")
    .ilike("nom", nom.trim())
    .maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabase
    .from("contacts")
    .insert({ user_id: userId, nom: nom.trim(), type: "fournisseur" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function findOrCreateDossier(
  userId: string,
  ref: string | undefined,
): Promise<string | null> {
  if (!ref?.trim()) return null;
  const { data: existing } = await supabase
    .from("dossiers")
    .select("*")
    .eq("user_id", userId)
    .ilike("titre", ref.trim())
    .maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from("dossiers")
    .insert({ user_id: userId, titre: ref.trim(), statut: "brouillon" })
    .select()
    .single();
  if (error) throw error;
  return data.id;
}

async function createSupplierInvoice(userId: string, d: SupplierContractData) {
  const fournisseur = await findOrCreateFournisseur(userId, d.fournisseur_nom!);
  const dossierId = await findOrCreateDossier(userId, d.dossier_reference);

  const taux = d.taux_change ?? 1;
  const montantDevise = d.montant_devise!;
  const montantEur =
    d.montant_eur ??
    (d.devise === "EUR" ? montantDevise : montantDevise * taux);

  const { data: facture, error } = await supabase
    .from("factures_fournisseurs")
    .insert({
      user_id: userId,
      fournisseur_id: fournisseur.id,
      dossier_id: dossierId,
      devise: d.devise!,
      montant: montantEur,
      montant_devise: montantDevise,
      montant_eur: montantEur,
      taux_change: taux,
      fx_source: "manuel",
      date_echeance: d.date_echeance ?? null,
      paye: false,
    })
    .select()
    .single();
  if (error) throw error;

  // Créer les échéances si présentes
  if (d.echeances && d.echeances.length > 0) {
    const rows = d.echeances.map((e, i) => ({
      user_id: userId,
      facture_id: facture.id,
      ordre: i + 1,
      type: e.type,
      devise: d.devise!,
      montant_devise: e.montant_devise,
      taux_change: taux,
      montant_eur:
        d.devise === "EUR" ? e.montant_devise : e.montant_devise * taux,
      fx_source: "manuel" as const,
      date_echeance: e.date_echeance ?? null,
      statut: "a_payer" as const,
    }));
    const { error: eErr } = await supabase
      .from("facture_echeances")
      .insert(rows);
    if (eErr) console.error("echeances insert", eErr);
  }

  return facture;
}

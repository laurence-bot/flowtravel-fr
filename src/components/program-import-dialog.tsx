import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, Upload, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  extractProgramFromFile,
  upsertJoursProgramme,
  insertLignes,
  previewLignesDuplicates,
  type ExtractedProgram,
} from "@/lib/program-import";
import { askDuplicate } from "@/lib/duplicate-confirm";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  cotationId: string;
  userId: string;
  canWrite: boolean;
  onImported?: () => void;
};

export function ProgramImportDialog({ cotationId, userId, canWrite, onImported }: Props) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ExtractedProgram | null>(null);
  const [selJours, setSelJours] = useState<Set<number>>(new Set());
  const [selLignes, setSelLignes] = useState<Set<number>>(new Set());

  const reset = () => {
    setFile(null);
    setResult(null);
    setProgressLabel("");
    setSelJours(new Set());
    setSelLignes(new Set());
  };

  /** Upload le PDF dans le bucket pdf-imports et sauvegarde l'URL sur la cotation. */
  const uploadPdfToStorage = async (pdfFile: File): Promise<void> => {
    if (pdfFile.type !== "application/pdf" && !/\.pdf$/i.test(pdfFile.name)) return;
    try {
      const ext = pdfFile.name.split(".").pop() || "pdf";
      const safeName = pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${userId}/${cotationId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("pdf-imports")
        .upload(path, pdfFile, { contentType: "application/pdf", upsert: false });
      if (upErr) {
        console.warn("[program-import] upload PDF échoué:", upErr.message);
        return;
      }
      // Bucket privé : on stocke le path, signé à la demande pour l'ouverture
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("cotations")
        .update({ programme_pdf_url: path, programme_pdf_name: pdfFile.name })
        .eq("id", cotationId);
    } catch (e) {
      console.warn("[program-import] upload PDF exception:", e);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setProgressLabel("Préparation du document…");
    try {
      // Upload du PDF en parallèle (non-bloquant pour l'analyse)
      const uploadPromise = uploadPdfToStorage(file);
      const { result: r, error } = await extractProgramFromFile(file, setProgressLabel);
      await uploadPromise;
      if (error || !r) {
        toast.error(error ?? "Extraction échouée");
        return;
      }
      setResult(r);
      setSelJours(new Set(r.jours.map((_, i) => i)));
      setSelLignes(new Set(r.lignes.map((_, i) => i)));
      toast.success(
        `Extraction terminée : ${r.jours.length} jour(s), ${r.lignes.length} ligne(s) — confiance ${r.confiance}.`,
      );
    } catch (e) {
      console.error("[program-import-dialog] analyse:", e);
      toast.error(e instanceof Error ? e.message : "Erreur inattendue pendant l'analyse");
    } finally {
      setLoading(false);
      setProgressLabel("");
    }
  };

  const toggleJour = (i: number) => {
    const s = new Set(selJours);
    s.has(i) ? s.delete(i) : s.add(i);
    setSelJours(s);
  };
  const toggleLigne = (i: number) => {
    const s = new Set(selLignes);
    s.has(i) ? s.delete(i) : s.add(i);
    setSelLignes(s);
  };

  const handleImport = async () => {
    if (!result) return;
    setImporting(true);

    // Récupère le max ordre actuel des lignes (pour append) et la date_depart
    // de la cotation (pour calculer date_jour si l'IA ne l'a pas extraite).
    const [{ data: lignesMax }, { data: cotationRow }] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("cotation_lignes_fournisseurs")
        .select("ordre")
        .eq("cotation_id", cotationId)
        .order("ordre", { ascending: false })
        .limit(1),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("cotations")
        .select("date_depart")
        .eq("id", cotationId)
        .maybeSingle(),
    ]);
    const startLigne = ((lignesMax?.[0]?.ordre as number) ?? 0) + 1;
    const dateDepart = (cotationRow?.date_depart as string | null) ?? null;

    const jours = result.jours.filter((_, i) => selJours.has(i));
    const lignes = result.lignes.filter((_, i) => selLignes.has(i));

    // Détecte d'éventuels doublons côté lignes fournisseurs et demande la stratégie.
    let strategy: "ignore" | "replace" | "add_anyway" = "ignore";
    if (lignes.length > 0) {
      const { duplicates } = await previewLignesDuplicates(cotationId, lignes);
      if (duplicates > 0) {
        const choice = await askDuplicate({
          title: "Doublons détectés à l'import",
          message: `⚠️ ${duplicates} ligne(s) fournisseur sur ${lignes.length} existent déjà dans cette cotation.\n\nQue souhaitez-vous faire ?`,
        });
        if (choice === "ANNULER") {
          setImporting(false);
          return;
        }
        if (choice === "REMPLACER") strategy = "replace";
        else if (choice === "AJOUTER_QUAND_MEME") strategy = "add_anyway";
        else strategy = "ignore";
      }
    }

    const [j, l] = await Promise.all([
      upsertJoursProgramme(userId, cotationId, jours, { dateDepart }),
      insertLignes(userId, cotationId, lignes, startLigne, strategy),
    ]);
    setImporting(false);

    if (j.error) toast.error(`Jours : ${j.error}`);
    if (l.error) toast.error(`Lignes : ${l.error}`);
    if (!j.error && !l.error) {
      const skippedParts: string[] = [];
      if (l.skipped > 0) skippedParts.push(`${l.skipped} ligne(s) doublon ignorée(s)`);
      if (l.replaced > 0) skippedParts.push(`${l.replaced} ligne(s) remplacée(s)`);
      const suffix = skippedParts.length > 0 ? ` — ${skippedParts.join(", ")}` : "";
      toast.success(
        `${j.inserted} jour(s) ajouté(s), ${j.updated} mis à jour, ${l.count} ligne(s) importée(s)${suffix}.`,
      );
      setOpen(false);
      reset();
      onImported?.();
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={!canWrite}
        onClick={() => setOpen(true)}
      >
        <Upload className="mr-2 h-4 w-4" />
        Importer un programme fournisseur
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Importer un programme fournisseur
            </DialogTitle>
            <DialogDescription>
              PDF ou image (JPG/PNG). L'IA détecte les jours et les prestations
              chiffrées, réécrit les textes en gardant strictement le sens, et
              vous laisse choisir ce qui est importé.
            </DialogDescription>
          </DialogHeader>

          {!result && (
            <div className="space-y-3">
              <Label>Fichier (PDF ou image)</Label>
              <Input
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  {file.name} ({Math.round(file.size / 1024)} Ko)
                </div>
              )}
              <Button onClick={handleAnalyze} disabled={!file || loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {progressLabel || "Analyse en cours…"}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Analyser le document
                  </>
                )}
              </Button>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline">Confiance : {result.confiance}</Badge>
                {result.fournisseur_nom && (
                  <Badge variant="outline">{result.fournisseur_nom}</Badge>
                )}
                {result.destination && (
                  <Badge variant="outline">{result.destination}</Badge>
                )}
              </div>

              <div>
                <div className="font-semibold mb-2">
                  Jours détectés ({result.jours.length})
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Les jours existants aux mêmes dates seront mis à jour, pas dupliqués.
                </p>
                <div className="space-y-2">
                  {result.jours.map((j, i) => (
                    <Card key={i} className="p-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selJours.has(i)}
                          onCheckedChange={() => toggleJour(i)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">
                            Jour {j.ordre}
                            {j.date_jour ? ` · ${j.date_jour}` : ""} — {j.titre}
                          </div>
                          {(j.lieu || j.hotel_nom) && (
                            <div className="text-xs text-muted-foreground">
                              {j.lieu ?? ""}
                              {j.lieu && j.hotel_nom ? " · " : ""}
                              {j.hotel_nom ? `🏨 ${j.hotel_nom}` : ""}
                            </div>
                          )}
                          {j.description && (
                            <div className="text-xs mt-1 text-muted-foreground line-clamp-3">
                              {j.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                  {result.jours.length === 0 && (
                    <div className="text-sm text-muted-foreground">Aucun jour détecté.</div>
                  )}
                </div>
              </div>

              <div>
                <div className="font-semibold mb-2">
                  Lignes prix détectées ({result.lignes.length}) — non visibles côté client
                </div>
                <div className="space-y-2">
                  {result.lignes.map((l, i) => (
                    <Card key={i} className="p-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selLignes.has(i)}
                          onCheckedChange={() => toggleLigne(i)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{l.prestation}</div>
                          <div className="text-xs text-muted-foreground">
                            {l.nom_fournisseur ?? "—"} ·{" "}
                            {(l.quantite ?? 1)} × {l.montant_devise} {l.devise}
                            {l.mode_tarifaire === "par_personne" ? " / pers." : ""}
                            {l.jour_ordre ? ` · Jour ${l.jour_ordre}` : ""}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                  {result.lignes.length === 0 && (
                    <div className="text-sm text-muted-foreground">Aucune ligne détectée.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {result && (
              <>
                <Button variant="ghost" onClick={reset} disabled={importing}>
                  Recommencer
                </Button>
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Import…
                    </>
                  ) : (
                    <>Importer la sélection</>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

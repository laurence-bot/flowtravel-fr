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
  insertJours,
  insertLignes,
  type ExtractedProgram,
} from "@/lib/program-import";
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
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ExtractedProgram | null>(null);
  const [selJours, setSelJours] = useState<Set<number>>(new Set());
  const [selLignes, setSelLignes] = useState<Set<number>>(new Set());

  const reset = () => {
    setFile(null);
    setResult(null);
    setSelJours(new Set());
    setSelLignes(new Set());
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    const { result: r, error } = await extractProgramFromFile(file);
    setLoading(false);
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

    // Récupère le max ordre actuel des jours et lignes pour append
    const [{ data: joursMax }, { data: lignesMax }] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("cotation_jours")
        .select("ordre")
        .eq("cotation_id", cotationId)
        .order("ordre", { ascending: false })
        .limit(1),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("cotation_lignes_fournisseurs")
        .select("ordre")
        .eq("cotation_id", cotationId)
        .order("ordre", { ascending: false })
        .limit(1),
    ]);
    const startJour = ((joursMax?.[0]?.ordre as number) ?? 0) + 1;
    const startLigne = ((lignesMax?.[0]?.ordre as number) ?? 0) + 1;

    const jours = result.jours.filter((_, i) => selJours.has(i));
    const lignes = result.lignes.filter((_, i) => selLignes.has(i));

    const [j, l] = await Promise.all([
      insertJours(userId, cotationId, jours, startJour),
      insertLignes(userId, cotationId, lignes, startLigne),
    ]);
    setImporting(false);

    if (j.error) toast.error(`Jours : ${j.error}`);
    if (l.error) toast.error(`Lignes : ${l.error}`);
    if (!j.error && !l.error) {
      toast.success(`${j.count} jour(s) et ${l.count} ligne(s) importés.`);
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
                    Analyse en cours…
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
                            Jour {j.ordre} — {j.titre}
                          </div>
                          {j.lieu && (
                            <div className="text-xs text-muted-foreground">{j.lieu}</div>
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

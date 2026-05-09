/**
 * program-import.ts
 *
 * Ce fichier regroupe DEUX fonctionnalités distinctes :
 *
 * ── PARTIE A : Import de programmes fournisseurs (PDF/image via IA)
 *    Exports : extractProgramFromFile, insertJours, insertLignes,
 *              previewLignesDuplicates, purgeEtReinserer, ExtractedProgram
 *    Utilisé par : program-import-dialog.tsx, quote-content-editor-block.tsx
 *
 * ── PARTIE B : Synchronisation PDF de vols ↔ dates itinéraire
 *    Exports : usePdfFlightSync, extractTextFromPDF, SyncStep,
 *              buildReviewRows, buildDoneSummary, DayItem, ReviewRow
 *    Utilisé par : SyncPdfModal.tsx (ou équivalent)
 */

import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  parseFlightPDF,
  computeItineraryDates,
  getSpecialDays,
  formatDateFR,
  formatSegmentLabel,
  type FlightGroup,
  type FlightSegment,
  type SpecialDayType,
} from "./flight-connections";

// ============================================================================
// PARTIE A — Import programme fournisseur (IA)
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JourExtrait {
  ordre: number;
  titre: string;
  lieu?: string | null;
  description?: string | null;
  /** Inclusions détectées (repas, transferts…) */
  inclusions?: string[];
}

export interface LigneExtraite {
  prestation: string;
  nom_fournisseur?: string | null;
  quantite?: number | null;
  montant_devise: number;
  devise: string;
  mode_tarifaire?: "par_personne" | "global" | null;
  jour_ordre?: number | null;
}

export interface ExtractedProgram {
  jours: JourExtrait[];
  lignes: LigneExtraite[];
  /** "haute" | "moyenne" | "basse" */
  confiance: string;
  fournisseur_nom?: string | null;
  destination?: string | null;
}

// ---------------------------------------------------------------------------
// extractProgramFromFile — analyse IA du PDF/image fournisseur
// ---------------------------------------------------------------------------

/**
 * Extrait les jours et lignes de prix d'un PDF ou image fournisseur via l'API IA.
 *
 * @param file             Fichier PDF ou image sélectionné par l'utilisateur
 * @param onProgress       Callback de progression (label affiché dans l'UI)
 * @returns                { result, error }
 */
export async function extractProgramFromFile(
  file: File,
  onProgress?: (label: string) => void,
): Promise<{ result: ExtractedProgram | null; error: string | null }> {
  try {
    onProgress?.("Lecture du fichier…");

    // Conversion en base64
    const base64 = await fileToBase64(file);
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);

    onProgress?.("Envoi à l'IA…");

    // Appel à la Edge Function extract-pdf
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any, error: any;
    if (isPdf) {
      // Envoi PDF en base64 pour extraction serveur via unpdf
      ({ data, error } = await (supabase as any).functions.invoke("extract-pdf", {
        body: {
          type: "programme_fournisseur",
          pdfBase64: base64,
        },
      }));
    } else {
      // Envoi image en vision
      ({ data, error } = await (supabase as any).functions.invoke("extract-pdf", {
        body: {
          type: "programme_fournisseur",
          images: [`data:${file.type || "image/jpeg"};base64,${base64}`],
        },
      }));
    }

    if (error) {
      console.error("[program-import] edge function error:", error);
      return { result: null, error: error.message ?? "Erreur serveur lors de l'extraction." };
    }

    onProgress?.("Validation des résultats…");

    if (!data || !data.data || !data.data.jours) {
      return { result: null, error: "L'IA n'a pas retourné de programme valide." };
    }

    const result: ExtractedProgram = {
      jours: data.data.jours ?? [],
      lignes: data.data.lignes ?? [],
      confiance: data.data.confiance ?? data.confiance ?? "basse",
      fournisseur_nom: data.data.fournisseur_nom ?? null,
      destination: data.data.destination ?? null,
    };

    return { result, error: null };
  } catch (e) {
    console.error("[program-import] extractProgramFromFile:", e);
    return {
      result: null,
      error: e instanceof Error ? e.message : "Erreur inattendue lors de l'extraction.",
    };
  }
}

// ---------------------------------------------------------------------------
// insertJours — insère les jours extraits dans cotation_jours
// ---------------------------------------------------------------------------

export interface InsertJoursResult {
  count: number;
  skipped: number;
  error: string | null;
}

export async function insertJours(
  userId: string,
  cotationId: string,
  jours: JourExtrait[],
  startOrdre: number,
): Promise<InsertJoursResult> {
  if (jours.length === 0) return { count: 0, skipped: 0, error: null };

  try {
    const rows = jours.map((j, idx) => ({
      cotation_id: cotationId,
      user_id: userId,
      ordre: startOrdre + idx,
      titre: j.titre,
      lieu: j.lieu ?? null,
      description: j.description ?? null,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("cotation_jours").insert(rows);

    if (error) {
      console.error("[program-import] insertJours:", error);
      return { count: 0, skipped: 0, error: error.message };
    }

    return { count: rows.length, skipped: 0, error: null };
  } catch (e) {
    return {
      count: 0,
      skipped: 0,
      error: e instanceof Error ? e.message : "Erreur insertion jours.",
    };
  }
}

// ---------------------------------------------------------------------------
// insertLignes — insère les lignes fournisseurs extraites
// ---------------------------------------------------------------------------

export interface InsertLignesResult {
  count: number;
  skipped: number;
  replaced: number;
  error: string | null;
}

export async function insertLignes(
  userId: string,
  cotationId: string,
  lignes: LigneExtraite[],
  startOrdre: number,
  strategy: "ignore" | "replace" | "add_anyway" = "ignore",
): Promise<InsertLignesResult> {
  if (lignes.length === 0) return { count: 0, skipped: 0, replaced: 0, error: null };

  try {
    let skipped = 0;
    let replaced = 0;
    const toInsert: object[] = [];

    for (let idx = 0; idx < lignes.length; idx++) {
      const l = lignes[idx];

      if (strategy === "ignore" || strategy === "replace") {
        // Vérifie si une ligne similaire existe déjà (même prestation + fournisseur)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await (supabase as any)
          .from("cotation_lignes_fournisseurs")
          .select("id")
          .eq("cotation_id", cotationId)
          .eq("prestation", l.prestation)
          .limit(1);

        if (existing && existing.length > 0) {
          if (strategy === "ignore") {
            skipped++;
            continue;
          } else {
            // replace : supprime l'existant avant de réinsérer
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any).from("cotation_lignes_fournisseurs").delete().eq("id", existing[0].id);
            replaced++;
          }
        }
      }

      toInsert.push({
        cotation_id: cotationId,
        user_id: userId,
        ordre: startOrdre + idx,
        prestation: l.prestation,
        nom_fournisseur: l.nom_fournisseur ?? null,
        quantite: l.quantite ?? 1,
        montant_devise: l.montant_devise,
        devise: l.devise,
        mode_tarifaire: l.mode_tarifaire === "par_personne" ? "par_personne" : "global",
      });
    }

    if (toInsert.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("cotation_lignes_fournisseurs").insert(toInsert);

      if (error) {
        console.error("[program-import] insertLignes:", error);
        return { count: 0, skipped, replaced, error: error.message };
      }
    }

    return { count: toInsert.length, skipped, replaced, error: null };
  } catch (e) {
    return {
      count: 0,
      skipped: 0,
      replaced: 0,
      error: e instanceof Error ? e.message : "Erreur insertion lignes.",
    };
  }
}

// ---------------------------------------------------------------------------
// previewLignesDuplicates — compte les doublons potentiels avant import
// ---------------------------------------------------------------------------

export async function previewLignesDuplicates(
  cotationId: string,
  lignes: LigneExtraite[],
): Promise<{ duplicates: number }> {
  try {
    let duplicates = 0;
    for (const l of lignes) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("cotation_lignes_fournisseurs")
        .select("id")
        .eq("cotation_id", cotationId)
        .eq("prestation", l.prestation)
        .limit(1);
      if (data && data.length > 0) duplicates++;
    }
    return { duplicates };
  } catch {
    return { duplicates: 0 };
  }
}

// ---------------------------------------------------------------------------
// purgeEtReinserer — supprime tous les jours/lignes et réinsère depuis zéro
// ---------------------------------------------------------------------------

export async function purgeEtReinserer(
  userId: string,
  cotationId: string,
  program: ExtractedProgram,
): Promise<{ error: string | null }> {
  try {
    // Suppression des jours existants
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: delJours } = await (supabase as any).from("cotation_jours").delete().eq("cotation_id", cotationId);

    if (delJours) return { error: delJours.message };

    // Suppression des lignes existantes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: delLignes } = await (supabase as any)
      .from("cotation_lignes_fournisseurs")
      .delete()
      .eq("cotation_id", cotationId);

    if (delLignes) return { error: delLignes.message };

    // Réinsertion
    const j = await insertJours(userId, cotationId, program.jours, 1);
    if (j.error) return { error: j.error };

    const l = await insertLignes(userId, cotationId, program.lignes, 1, "add_anyway");
    if (l.error) return { error: l.error };

    return { error: null };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Erreur purgeEtReinserer.",
    };
  }
}

// ---------------------------------------------------------------------------
// Helper interne
// ---------------------------------------------------------------------------

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Retire le préfixe "data:...;base64,"
      resolve(result.split(",")[1] ?? result);
    };
    reader.onerror = () => reject(new Error("Impossible de lire le fichier."));
    reader.readAsDataURL(file);
  });
}

// ============================================================================
// PARTIE B — Synchronisation PDF vols ↔ dates itinéraire
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SyncStep = "idle" | "upload" | "parsing" | "review" | "applying" | "done" | "error";

export interface SyncState {
  step: SyncStep;
  flightGroup: FlightGroup | null;
  computedDates: string[];
  updatedDaysCount: number;
  errorMessage: string | null;
  fileName: string | null;
}

export interface DayItem {
  id: string;
  dayIndex: number;
  currentDate: string | null;
  title: string;
}

export type ReviewRow = {
  dayLabel: string;
  currentDateFR: string;
  newDateFR: string;
  changed: boolean;
  flights: string[];
  specialType: SpecialDayType | null;
};

// ---------------------------------------------------------------------------
// extractTextFromPDF — extraction texte PDF côté navigateur (pdf.js)
// ---------------------------------------------------------------------------

export async function extractTextFromPDF(file: File): Promise<string> {
  if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Le fichier sélectionné n'est pas un PDF valide.");
  }

  const arrayBuffer = await file.arrayBuffer();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsLib = (window as any).pdfjsLib ?? (await importPdfJs());
  if (!pdfjsLib) {
    throw new Error("pdf.js non disponible. Vérifiez que pdfjs-dist est installé dans le projet.");
  }

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;

  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();

    const items = content.items as Array<{
      str: string;
      transform: number[];
      width: number;
    }>;

    const sorted = [...items].sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5];
      if (Math.abs(yDiff) > 5) return yDiff;
      return a.transform[4] - b.transform[4];
    });

    const lineGroups: string[][] = [];
    let lastY: number | null = null;
    for (const item of sorted) {
      const y = item.transform[5];
      if (lastY === null || Math.abs(y - lastY) > 8) {
        lineGroups.push([]);
        lastY = y;
      }
      if (item.str.trim()) {
        lineGroups[lineGroups.length - 1].push(item.str.trim());
      }
    }

    pageTexts.push(lineGroups.map((g) => g.join("  ")).join("\n"));
  }

  return pageTexts.join("\n");
}

async function importPdfJs() {
  try {
    // @ts-ignore
    const mod = await import("pdfjs-dist");
    mod.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${mod.version}/build/pdf.worker.min.js`;
    return mod;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hook usePdfFlightSync
// ---------------------------------------------------------------------------

export interface UsePdfFlightSyncOptions {
  days: DayItem[];
  onApplyDates: (updates: Array<{ id: string; date: string }>) => Promise<void>;
}

export interface UsePdfFlightSyncReturn {
  state: SyncState;
  handleFileSelected: (file: File) => Promise<void>;
  handleApply: () => Promise<void>;
  handleReset: () => void;
  getStepLabel: (step: SyncStep) => string;
  isStepDone: (targetStep: SyncStep) => boolean;
}

const INITIAL_STATE: SyncState = {
  step: "idle",
  flightGroup: null,
  computedDates: [],
  updatedDaysCount: 0,
  errorMessage: null,
  fileName: null,
};

export function usePdfFlightSync({ days, onApplyDates }: UsePdfFlightSyncOptions): UsePdfFlightSyncReturn {
  const [state, setState] = useState<SyncState>(INITIAL_STATE);
  const abortRef = useRef(false);

  const handleFileSelected = useCallback(
    async (file: File) => {
      abortRef.current = false;
      setState({ ...INITIAL_STATE, step: "parsing", fileName: file.name });

      try {
        const rawText = await extractTextFromPDF(file);
        if (abortRef.current) return;

        if (!rawText.trim()) {
          throw new Error(
            "Aucun texte extrait du PDF. Le fichier est peut-être scanné (image). " +
              "Veuillez utiliser un PDF natif (export direct du GDS ou de la compagnie).",
          );
        }

        const flightGroup = parseFlightPDF(rawText);
        if (abortRef.current) return;

        const totalSegments = flightGroup.outbound.length + flightGroup.inbound.length;
        if (totalSegments === 0) {
          throw new Error(
            "Aucun vol détecté dans le PDF. Vérifiez que le fichier contient " +
              "bien des billets d'avion (format IATA standard).",
          );
        }

        const computedDates = computeItineraryDates(flightGroup, days.length);

        setState((prev) => ({
          ...prev,
          step: "review",
          flightGroup,
          computedDates,
        }));
      } catch (err) {
        if (abortRef.current) return;
        setState((prev) => ({
          ...prev,
          step: "error",
          errorMessage: err instanceof Error ? err.message : "Erreur inattendue lors du parsing du PDF.",
        }));
      }
    },
    [days.length],
  );

  const handleApply = useCallback(async () => {
    const { computedDates, flightGroup } = state;
    if (!flightGroup || computedDates.length === 0) return;

    setState((prev) => ({ ...prev, step: "applying" }));

    try {
      const updates: Array<{ id: string; date: string }> = [];
      days.forEach((day, index) => {
        const newDate = computedDates[index];
        if (newDate && newDate !== day.currentDate) {
          updates.push({ id: day.id, date: newDate });
        }
      });

      if (updates.length === 0) {
        setState((prev) => ({ ...prev, step: "done", updatedDaysCount: 0 }));
        return;
      }

      await onApplyDates(updates);

      setState((prev) => ({
        ...prev,
        step: "done",
        updatedDaysCount: updates.length,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        step: "error",
        errorMessage: err instanceof Error ? err.message : "Erreur lors de la mise à jour des dates en base.",
      }));
    }
  }, [state, days, onApplyDates]);

  const handleReset = useCallback(() => {
    abortRef.current = true;
    setState(INITIAL_STATE);
  }, []);

  const getStepLabel = (step: SyncStep): string => {
    const labels: Record<SyncStep, string> = {
      idle: "Synchroniser",
      upload: "Charger le PDF",
      parsing: "Analyse en cours…",
      review: "Vérifier les vols",
      applying: "Application…",
      done: "Synchronisé ✓",
      error: "Erreur",
    };
    return labels[step];
  };

  const STEP_ORDER: SyncStep[] = ["upload", "review", "done"];
  const isStepDone = (targetStep: SyncStep): boolean => {
    const currentIdx = STEP_ORDER.indexOf(state.step);
    const targetIdx = STEP_ORDER.indexOf(targetStep);
    return currentIdx > targetIdx;
  };

  return {
    state,
    handleFileSelected,
    handleApply,
    handleReset,
    getStepLabel,
    isStepDone,
  };
}

// ---------------------------------------------------------------------------
// buildReviewRows
// ---------------------------------------------------------------------------

export function buildReviewRows(flightGroup: FlightGroup, computedDates: string[], days: DayItem[]): ReviewRow[] {
  const specialDays = getSpecialDays(flightGroup, days.length);

  return days.map((day, index) => {
    const newDate = computedDates[index] ?? "";
    const currentDate = day.currentDate ?? "";
    const changed = newDate !== "" && newDate !== currentDate;
    const specialType = specialDays.get(index) ?? null;

    let dayFlights: FlightSegment[] = [];

    if (specialType === "departure") {
      dayFlights = flightGroup.outbound.filter((seg) => seg.date === newDate);
    } else if (specialType === "arrival_destination") {
      const last = flightGroup.outbound[flightGroup.outbound.length - 1];
      if (last) dayFlights = [last];
    } else if (specialType === "return_home") {
      dayFlights = flightGroup.inbound;
    } else {
      dayFlights = [...flightGroup.outbound, ...flightGroup.inbound].filter((seg) => seg.date === newDate);
    }

    return {
      dayLabel: `J${index + 1}`,
      currentDateFR: currentDate ? formatDateFR(currentDate) : "—",
      newDateFR: newDate ? formatDateFR(newDate) : "—",
      changed,
      flights: dayFlights.map(formatSegmentLabel),
      specialType,
    };
  });
}

// ---------------------------------------------------------------------------
// buildDoneSummary
// ---------------------------------------------------------------------------

export function buildDoneSummary(flightGroup: FlightGroup, updatedDaysCount: number): string {
  const total = flightGroup.outbound.length + flightGroup.inbound.length;
  const first = flightGroup.outbound[0];
  const lastIn = flightGroup.inbound[flightGroup.inbound.length - 1];
  const route =
    first && lastIn
      ? `${first.origin} → … → ${lastIn.destination}`
      : first
        ? `${first.origin} → ${flightGroup.outbound[flightGroup.outbound.length - 1]?.destination ?? "?"}`
        : "";
  return (
    `${total} vol${total > 1 ? "s" : ""} détecté${total > 1 ? "s" : ""}` +
    (route ? ` (${route})` : "") +
    ` · ${updatedDaysCount} jour${updatedDaysCount > 1 ? "s" : ""} mis à jour`
  );
}

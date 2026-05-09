/**
 * program-import.ts
 * Hook et composant de synchronisation PDF de vols ↔ itinéraire FlowTravel.
 *
 * Ce fichier expose :
 *  - usePdfFlightSync()  : hook React principal
 *  - extractTextFromPDF(): extraction texte PDF côté navigateur (pdf.js)
 *  - SyncStep           : enum des étapes guidées utilisateur
 *  - buildReviewRows()  : données pour le tableau de review
 *  - buildDoneSummary() : résumé après application
 */

import { useState, useCallback, useRef } from "react";
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

// ---------------------------------------------------------------------------
// Types publics
// ---------------------------------------------------------------------------

export type SyncStep =
  | "idle" // État initial — rien en cours
  | "upload" // Étape 1 : charger le PDF
  | "parsing" // Chargement / parsing en cours
  | "review" // Étape 2 : vérifier les vols détectés
  | "applying" // Application en cours
  | "done" // Étape 3 : synchronisation terminée
  | "error"; // Erreur récupérable

export interface SyncState {
  step: SyncStep;
  /** Vols détectés — disponibles dès l'étape "review" */
  flightGroup: FlightGroup | null;
  /** Dates calculées pour chaque jour de l'itinéraire */
  computedDates: string[];
  /** Nombre de jours mis à jour lors de l'apply */
  updatedDaysCount: number;
  /** Message d'erreur si step = "error" */
  errorMessage: string | null;
  /** Nom du fichier chargé */
  fileName: string | null;
}

export interface DayItem {
  id: string;
  dayIndex: number; // 0-based (J1 = 0)
  currentDate: string | null; // ISO actuel en base
  title: string;
}

// ---------------------------------------------------------------------------
// Extraction texte PDF (côté navigateur, sans dépendance serveur)
// ---------------------------------------------------------------------------

/**
 * Extrait le texte d'un PDF via pdf.js (déjà chargé dans le projet Lovable).
 *
 * @param file  Fichier PDF sélectionné par l'utilisateur
 * @returns     Texte brut de toutes les pages concaténées
 */
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

    // Tri spatial : position Y décroissante puis X croissante
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

    // Groupement en lignes (tolérance 8px sur Y)
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
// Hook principal usePdfFlightSync
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

  // Étape 1 : Parsing du PDF
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

  // Étape 2 : Application des dates
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

  return { state, handleFileSelected, handleApply, handleReset, getStepLabel, isStepDone };
}

// ---------------------------------------------------------------------------
// Utilitaires d'affichage
// ---------------------------------------------------------------------------

export type ReviewRow = {
  dayLabel: string;
  currentDateFR: string;
  newDateFR: string;
  changed: boolean;
  flights: string[];
  /**
   * Type de jour spécial :
   *  "departure"           → J1  — Départ France
   *  "arrival_destination" → J2  — Arrivée à destination
   *  "return_home"         → Jn  — Retour France
   *  null                  → jour normal
   */
  specialType: SpecialDayType | null;
};

/**
 * Construit les lignes du tableau de review.
 *
 * Attribution des vols par jour :
 *  J1 (departure)           → tous les segments aller qui PARTENT ce jour-là
 *                              (MRS→IST, IST→CGK si même date)
 *  J2 (arrival_destination) → dernier segment aller (celui qui arrive à destination finale)
 *  Jn (return_home)         → tous les segments retour
 *  Autres                   → segments domestiques dont la date = ce jour
 */
export function buildReviewRows(flightGroup: FlightGroup, computedDates: string[], days: DayItem[]): ReviewRow[] {
  const specialDays = getSpecialDays(flightGroup, days.length);

  return days.map((day, index) => {
    const newDate = computedDates[index] ?? "";
    const currentDate = day.currentDate ?? "";
    const changed = newDate !== "" && newDate !== currentDate;
    const specialType = specialDays.get(index) ?? null;

    let dayFlights: FlightSegment[] = [];

    if (specialType === "departure") {
      // J1 : vols aller qui partent le jour de départ
      dayFlights = flightGroup.outbound.filter((seg) => seg.date === newDate);
    } else if (specialType === "arrival_destination") {
      // J2 : dernier segment aller (arrivée à destination finale)
      const last = flightGroup.outbound[flightGroup.outbound.length - 1];
      if (last) dayFlights = [last];
    } else if (specialType === "return_home") {
      // Jn : tous les segments retour
      dayFlights = flightGroup.inbound;
    } else {
      // Jours intermédiaires : vols domestiques éventuels
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

/**
 * Résumé affiché dans l'étape "done".
 */
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

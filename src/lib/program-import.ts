// Import d'un programme fournisseur (PDF, image scannée, texte) :
// - extraction des jours et des lignes prix via l'edge function extract-pdf
// - prévisualisation et insertion dans cotation_jours + cotation_lignes_fournisseurs

import { supabase } from "@/integrations/supabase/client";
import { DEVISES, type DeviseCode } from "@/lib/fx";

export type Confiance = "faible" | "moyenne" | "elevee";

export type ExtractedJour = {
  ordre: number;
  titre: string;
  lieu?: string;
  date_jour?: string;
  description?: string;
};

export type ExtractedLigne = {
  prestation: string;
  nom_fournisseur?: string;
  quantite?: number;
  mode_tarifaire?: "global" | "par_personne";
  devise: DeviseCode;
  montant_devise: number;
  jour_ordre?: number;
  date_prestation?: string;
};

export type ExtractedProgram = {
  fournisseur_nom?: string;
  destination?: string;
  nombre_pax?: number;
  date_depart?: string;
  jours: ExtractedJour[];
  lignes: ExtractedLigne[];
  confiance: Confiance;
};

const VALID_DEVISES = new Set(DEVISES.map((d) => d.code));

const num = (v: unknown): number | undefined => {
  if (v == null || v === "") return undefined;
  const n = Number(String(v).replace(/[^0-9.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
};

const isoDate = (v: unknown): string | undefined => {
  if (typeof v !== "string" || !v.trim()) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    const [, d, mo, y] = m;
    const yy = y.length === 2 ? `20${y}` : y;
    return `${yy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return undefined;
};

const devise = (v: unknown): DeviseCode => {
  if (typeof v !== "string") return "EUR";
  const code = v.trim().toUpperCase();
  return VALID_DEVISES.has(code as DeviseCode) ? (code as DeviseCode) : "EUR";
};

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

type ProgramPayload = { type: "programme_fournisseur"; text?: string; images?: string[] };
type ProgressCallback = (message: string) => void;

async function loadPdf(file: File): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs: any = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
  const buf = await file.arrayBuffer();
  return withTimeout(
    pdfjs.getDocument({ data: buf }).promise,
    20000,
    "Impossible d'ouvrir le PDF automatiquement. Essayez de l'exporter à nouveau en PDF standard.",
  );
}

/** Extrait le texte page par page, en petits blocs, pour éviter de bloquer sur les gros PDF. */
async function extractPdfTextChunks(file: File): Promise<string[]> {
  const pdf = await loadPdf(file);
  const maxPages = Math.min(pdf.numPages, 45);
  const chunkLimit = 9000;
  const maxChunks = 7;
  const chunks: string[] = [];
  let current = "";

  for (let i = 1; i <= maxPages && chunks.length < maxChunks; i++) {
    const page: any = await withTimeout(pdf.getPage(i), 12000, `Lecture impossible de la page ${i}.`);
    const content: any = await withTimeout(
      page.getTextContent(),
      12000,
      `Extraction texte trop longue sur la page ${i}.`,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageText = content.items.map((it: any) => it.str ?? "").join(" ").trim();
    if (!pageText) continue;
    const block = `\n\n--- Page ${i} ---\n${pageText.slice(0, 5000)}`;
    if (current && current.length + block.length > chunkLimit) {
      chunks.push(current);
      current = block;
    } else {
      current += block;
    }
  }

  if (current.trim() && chunks.length < maxChunks) chunks.push(current);
  return chunks.filter((chunk) => chunk.trim().length >= 40);
}

/** Convertit un fichier image en data URL base64. */
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** Rasterise les premières pages d'un PDF en images JPEG légères, par petits lots — fallback OCR. */
async function pdfToImageBatches(file: File, maxPages = 10, pagesPerBatch = 2): Promise<string[][]> {
  const pdf = await loadPdf(file);
  const pages = Math.min(pdf.numPages, maxPages);
  const batches: string[][] = [];
  let current: string[] = [];
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 0.95 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport }).promise;
    current.push(canvas.toDataURL("image/jpeg", 0.62));
    if (current.length >= pagesPerBatch) {
      batches.push(current);
      current = [];
    }
  }
  if (current.length) batches.push(current);
  return batches;
}

function normalizeExtractedProgram(raw: Record<string, unknown>, confiance: Confiance): ExtractedProgram {
  const joursRaw = Array.isArray(raw.jours) ? (raw.jours as Array<Record<string, unknown>>) : [];
  const lignesRaw = Array.isArray(raw.lignes) ? (raw.lignes as Array<Record<string, unknown>>) : [];

  const jours: ExtractedJour[] = joursRaw
    .map((j, i) => ({
      ordre: Number(j.ordre) || i + 1,
      titre: String(j.titre || `Jour ${i + 1}`).trim(),
      lieu: j.lieu ? String(j.lieu).trim() : undefined,
      date_jour: isoDate(j.date_jour),
      description: j.description ? String(j.description).trim() : undefined,
    }))
    .filter((j) => j.titre)
    .sort((a, b) => a.ordre - b.ordre);

  const lignes: ExtractedLigne[] = lignesRaw
    .map((l) => ({
      prestation: String(l.prestation || "").trim(),
      nom_fournisseur: l.nom_fournisseur
        ? String(l.nom_fournisseur).trim()
        : (raw.fournisseur_nom as string | undefined)?.trim(),
      quantite: num(l.quantite) ?? 1,
      mode_tarifaire:
        l.mode_tarifaire === "par_personne" ? ("par_personne" as const) : ("global" as const),
      devise: devise(l.devise),
      montant_devise: num(l.montant_devise) ?? 0,
      jour_ordre: num(l.jour_ordre),
      date_prestation: isoDate(l.date_prestation),
    }))
    .filter((l) => l.prestation && l.montant_devise > 0);

  return {
    fournisseur_nom: (raw.fournisseur_nom as string) || undefined,
    destination: (raw.destination as string) || undefined,
    nombre_pax: num(raw.nombre_pax),
    date_depart: isoDate(raw.date_depart),
    jours,
    lignes,
    confiance,
  };
}

function mergePrograms(parts: ExtractedProgram[]): ExtractedProgram | null {
  if (parts.length === 0) return null;
  const jourKeys = new Set<string>();
  const ligneKeys = new Set<string>();
  const jours: ExtractedJour[] = [];
  const lignes: ExtractedLigne[] = [];

  for (const part of parts) {
    for (const j of part.jours) {
      const key = `${j.date_jour ?? ""}|${j.titre.toLowerCase()}|${(j.description ?? "").slice(0, 80).toLowerCase()}`;
      if (jourKeys.has(key)) continue;
      jourKeys.add(key);
      jours.push({ ...j, ordre: jours.length + 1 });
    }
    for (const l of part.lignes) {
      const key = `${l.prestation.toLowerCase()}|${l.montant_devise}|${l.devise}|${l.jour_ordre ?? ""}`;
      if (ligneKeys.has(key)) continue;
      ligneKeys.add(key);
      lignes.push(l);
    }
  }

  const rank: Record<Confiance, number> = { faible: 0, moyenne: 1, elevee: 2 };
  const confiance = parts.reduce<Confiance>((lowest, part) =>
    rank[part.confiance] < rank[lowest] ? part.confiance : lowest,
  "elevee");

  return {
    fournisseur_nom: parts.find((p) => p.fournisseur_nom)?.fournisseur_nom,
    destination: parts.find((p) => p.destination)?.destination,
    nombre_pax: parts.find((p) => p.nombre_pax)?.nombre_pax,
    date_depart: parts.find((p) => p.date_depart)?.date_depart,
    jours,
    lignes,
    confiance,
  };
}

async function analyzeProgramPayload(payload: ProgramPayload): Promise<{ result: ExtractedProgram | null; error?: string }> {
  const { data, error } = await withTimeout(
    supabase.functions.invoke("extract-pdf", { body: payload }),
    70000,
    "Une partie du document est trop longue à analyser automatiquement.",
  );
  if (error) return { result: null, error: error.message };
  if (data?.error) return { result: null, error: data.error };

  const raw = (data?.data ?? {}) as Record<string, unknown>;
  const confiance = (data?.confiance as Confiance) ?? "moyenne";
  return { result: normalizeExtractedProgram(raw, confiance) };
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

/** Extrait un programme depuis un fichier (PDF ou image). */
export async function extractProgramFromFile(
  file: File,
  onProgress?: ProgressCallback,
): Promise<{ result: ExtractedProgram | null; error?: string }> {
  try {
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      if (file.size > 20 * 1024 * 1024) {
        return { result: null, error: "PDF trop volumineux (max 20 Mo)." };
      }
      onProgress?.("Envoi du PDF au moteur d'analyse…");
      const pdfBase64 = await fileToBase64(file);
      onProgress?.("Lecture et analyse en cours…");
      const analyzed = await analyzeProgramPayload({
        type: "programme_fournisseur",
        pdfBase64,
      } as ProgramPayload);
      if (!analyzed.result && !analyzed.error) {
        return { result: null, error: "Aucune donnée exploitable détectée dans le PDF." };
      }
      return analyzed;
    } else if (file.type.startsWith("image/")) {
      onProgress?.("Analyse de l'image…");
      const url = await fileToDataUrl(file);
      return analyzeProgramPayload({ type: "programme_fournisseur", images: [url] });
    } else {
      return { result: null, error: "Format non supporté. Utilisez PDF ou image (JPG/PNG)." };
    }
  } catch (e) {
    console.error("[program-import] preparation error:", e);
    return {
      result: null,
      error: e instanceof Error ? e.message : "Erreur de préparation du fichier",
    };
  }
}

/** Insère les jours sélectionnés dans cotation_jours (en append à la fin). */
export async function insertJours(
  userId: string,
  cotationId: string,
  jours: ExtractedJour[],
  startOrdre: number,
): Promise<{ count: number; error?: string }> {
  if (jours.length === 0) return { count: 0 };
  const rows = jours.map((j, i) => ({
    user_id: userId,
    cotation_id: cotationId,
    ordre: startOrdre + i,
    titre: j.titre || `Jour ${startOrdre + i}`,
    lieu: j.lieu ?? null,
    date_jour: j.date_jour ?? null,
    description: j.description ?? null,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("cotation_jours").insert(rows);
  if (error) return { count: 0, error: error.message };
  return { count: rows.length };
}

/** Insère les lignes fournisseurs sélectionnées (taux 1 par défaut sauf EUR — l'agent réajuste après). */
export async function insertLignes(
  userId: string,
  cotationId: string,
  lignes: ExtractedLigne[],
  startOrdre: number,
): Promise<{ count: number; error?: string }> {
  if (lignes.length === 0) return { count: 0 };
  const rows = lignes.map((l, i) => {
    const taux = l.devise === "EUR" ? 1 : 1; // l'agent ajustera ; FX par défaut
    return {
      user_id: userId,
      cotation_id: cotationId,
      fournisseur_id: null,
      nom_fournisseur: l.nom_fournisseur || "Fournisseur",
      payeur: null,
      prestation: l.prestation,
      date_prestation: l.date_prestation ?? null,
      mode_tarifaire: l.mode_tarifaire ?? "global",
      quantite: l.quantite ?? 1,
      devise: l.devise,
      montant_devise: l.montant_devise,
      taux_change_vers_eur: taux,
      montant_eur: l.montant_devise * taux,
      source_fx: "taux_du_jour",
      pct_acompte_1: 30,
      pct_acompte_2: 0,
      pct_acompte_3: 0,
      pct_solde: 70,
      ordre: startOrdre + i,
    };
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("cotation_lignes_fournisseurs")
    .insert(rows);
  if (error) return { count: 0, error: error.message };
  return { count: rows.length };
}

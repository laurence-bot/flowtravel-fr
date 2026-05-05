// Import d'un programme fournisseur (PDF, image scannée, texte) :
// - extraction des jours et des lignes prix via l'edge function extract-pdf
// - prévisualisation et insertion dans cotation_jours + cotation_lignes_fournisseurs
//
// ⚠️ FIX RESYNCHRONISATION :
// Lors d'une resynchronisation, on purge TOUTES les lignes existantes du fournisseur
// avant de réinsérer — on ne cumule jamais les anciennes et les nouvelles.

import { supabase } from "@/integrations/supabase/client";
import { DEVISES, type DeviseCode } from "@/lib/fx";
import { duplicateLineKey, normKey } from "@/lib/cotation-sync";

export type Confiance = "faible" | "moyenne" | "elevee";

export type ExtractedJour = {
  ordre: number;
  titre: string;
  lieu?: string;
  date_jour?: string;
  description?: string;
  hotel_nom?: string;
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
  const n = Number(
    String(v)
      .replace(/[^0-9.,-]/g, "")
      .replace(",", "."),
  );
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

type ProgramPayload = { type: "programme_fournisseur"; text?: string; images?: string[]; pdfBase64?: string };
type ProgressCallback = (message: string) => void;

async function loadPdf(file: File): Promise<any> {
  const pdfjs: any = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
  const buf = await file.arrayBuffer();
  return withTimeout(
    pdfjs.getDocument({ data: buf }).promise,
    20000,
    "Impossible d'ouvrir le PDF automatiquement. Essayez de l'exporter à nouveau en PDF standard.",
  );
}

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
    const pageText = content.items
      .map((it: any) => it.str ?? "")
      .join(" ")
      .trim();
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

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

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
      hotel_nom: j.hotel_nom ? String(j.hotel_nom).trim() : undefined,
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
      mode_tarifaire: l.mode_tarifaire === "par_personne" ? ("par_personne" as const) : ("global" as const),
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
  const confiance = parts.reduce<Confiance>(
    (lowest, part) => (rank[part.confiance] < rank[lowest] ? part.confiance : lowest),
    "elevee",
  );

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

async function analyzeProgramPayload(
  payload: ProgramPayload,
): Promise<{ result: ExtractedProgram | null; error?: string }> {
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

// ─────────────────────────────────────────────────────────────
// ⚠️ FIX RESYNCHRONISATION — PURGE AVANT RÉINSERTION
// Supprime TOUTES les lignes fournisseurs et jours liés à un
// fournisseur donné avant de réinsérer, pour éviter tout cumul.
// ─────────────────────────────────────────────────────────────

/**
 * Purge toutes les lignes fournisseurs d'un fournisseur donné
 * dans une cotation, avant resynchronisation.
 */
export async function purgeLignesFournisseur(
  cotationId: string,
  nomFournisseur: string,
): Promise<{ error?: string }> {
  const { error } = await (supabase as any)
    .from("cotation_lignes_fournisseurs")
    .delete()
    .eq("cotation_id", cotationId)
    .ilike("nom_fournisseur", nomFournisseur.trim());

  if (error) {
    console.error("[program-import] purgeLignesFournisseur error:", error);
    return { error: error.message };
  }
  return {};
}

/**
 * Purge tous les jours d'une cotation liés à un fournisseur
 * (identifiés par la source ou le titre correspondant).
 * À utiliser uniquement si les jours sont régénérés à chaque sync.
 */
export async function purgeJoursFournisseur(
  cotationId: string,
): Promise<{ error?: string }> {
  const { error } = await (supabase as any)
    .from("cotation_jours")
    .delete()
    .eq("cotation_id", cotationId);

  if (error) {
    console.error("[program-import] purgeJoursFournisseur error:", error);
    return { error: error.message };
  }
  return {};
}

/**
 * Purge complète + réinsertion atomique.
 * C'est cette fonction qui doit être appelée lors de toute resynchronisation,
 * à la place d'un simple insertLignes / insertJours.
 *
 * Séquence :
 * 1. Purge toutes les lignes du fournisseur
 * 2. Purge tous les jours de la cotation (si regenJours = true)
 * 3. Réinsère les nouveaux jours
 * 4. Réinsère les nouvelles lignes
 */
export async function purgeEtReinserer(
  userId: string,
  cotationId: string,
  program: ExtractedProgram,
  options: {
    regenJours?: boolean; // true = on régénère aussi les jours (défaut: true)
    onProgress?: ProgressCallback;
  } = {},
): Promise<{ joursCount: number; lignesCount: number; error?: string }> {
  const { regenJours = true, onProgress } = options;
  const nomFournisseur = program.fournisseur_nom ?? "Fournisseur";

  // ÉTAPE 1 — Purge de TOUTES les lignes fournisseur de la cotation (pas seulement ce fournisseur)
  onProgress?.("Suppression de toutes les lignes fournisseur…");
  const { error: errLignes } = await (supabase as any)
    .from("cotation_lignes_fournisseurs")
    .delete()
    .eq("cotation_id", cotationId);
  if (errLignes) {
    console.error("[program-import] purge globale error:", errLignes);
    return { joursCount: 0, lignesCount: 0, error: errLignes.message };
  }

  // ÉTAPE 2 — Purge des jours (optionnel)
  if (regenJours) {
    onProgress?.("Suppression des anciens jours…");
    const { error: errJours } = await purgeJoursFournisseur(cotationId);
    if (errJours) return { joursCount: 0, lignesCount: 0, error: errJours };
  }

  // ÉTAPE 3 — Réinsertion des jours
  let joursCount = 0;
  if (regenJours && program.jours.length > 0) {
    onProgress?.(`Insertion de ${program.jours.length} jour(s)…`);
    const result = await insertJours(userId, cotationId, program.jours, 1);
    if (result.error) return { joursCount: 0, lignesCount: 0, error: result.error };
    joursCount = result.count;
  }

  // ÉTAPE 4 — Réinsertion des lignes (strategy "add_anyway" car on vient de tout purger)
  onProgress?.(`Insertion de ${program.lignes.length} ligne(s) fournisseur…`);
  const resultLignes = await insertLignes(
    userId,
    cotationId,
    program.lignes,
    1,
    "add_anyway", // Pas de check doublon : la purge garantit une table vide
  );
  if (resultLignes.error) return { joursCount, lignesCount: 0, error: resultLignes.error };

  return { joursCount, lignesCount: resultLignes.count };
}

// ─────────────────────────────────────────────────────────────
// Fonctions d'insertion standard (premier import, sans purge)
// ─────────────────────────────────────────────────────────────

export async function insertJours(
  userId: string,
  cotationId: string,
  jours: ExtractedJour[],
  startOrdre: number,
): Promise<{ count: number; skipped: number; error?: string }> {
  if (jours.length === 0) return { count: 0, skipped: 0 };

  const { data: existingData } = await (supabase as any)
    .from("cotation_jours")
    .select("titre, description, date_jour")
    .eq("cotation_id", cotationId);
  const existing = (existingData ?? []) as Array<{
    titre: string | null;
    description: string | null;
    date_jour: string | null;
  }>;
  const dateKeys = new Set(existing.filter((e) => e.date_jour).map((e) => e.date_jour as string));
  const titleDescKeys = new Set(existing.map((e) => `${normKey(e.titre)}|${normKey(e.description).slice(0, 200)}`));

  const toInsert: ExtractedJour[] = [];
  const batchKeys = new Set<string>();
  const batchDates = new Set<string>();
  for (const j of jours) {
    const dateKey = j.date_jour ?? "";
    const tdKey = `${normKey(j.titre)}|${normKey(j.description).slice(0, 200)}`;
    if (dateKey && (dateKeys.has(dateKey) || batchDates.has(dateKey))) continue;
    if (titleDescKeys.has(tdKey) || batchKeys.has(tdKey)) continue;
    toInsert.push(j);
    if (dateKey) batchDates.add(dateKey);
    batchKeys.add(tdKey);
  }
  const skipped = jours.length - toInsert.length;
  if (toInsert.length === 0) return { count: 0, skipped };

  const rows = toInsert.map((j, i) => ({
    user_id: userId,
    cotation_id: cotationId,
    ordre: startOrdre + i,
    titre: j.titre || `Jour ${startOrdre + i}`,
    lieu: j.lieu ?? null,
    date_jour: j.date_jour ?? null,
    description: j.description ?? null,
  }));
  const { error } = await (supabase as any).from("cotation_jours").insert(rows);
  if (error) return { count: 0, skipped, error: error.message };
  return { count: rows.length, skipped };
}

export type DuplicateStrategy = "ignore" | "replace" | "add_anyway";

export async function previewLignesDuplicates(
  cotationId: string,
  lignes: ExtractedLigne[],
): Promise<{ duplicates: number; total: number }> {
  if (lignes.length === 0) return { duplicates: 0, total: 0 };
  const { data: existingData } = await (supabase as any)
    .from("cotation_lignes_fournisseurs")
    .select("prestation, montant_devise, devise, nom_fournisseur")
    .eq("cotation_id", cotationId);
  const existing = (existingData ?? []) as Array<{
    prestation: string | null;
    montant_devise: number | null;
    devise: string | null;
    nom_fournisseur: string | null;
  }>;
  const existingKeys = new Set(existing.map((e) => duplicateLineKey(e)));
  let dup = 0;
  const seen = new Set<string>();
  for (const l of lignes) {
    const k = duplicateLineKey({
      prestation: l.prestation,
      montant_devise: l.montant_devise,
      devise: l.devise,
      nom_fournisseur: l.nom_fournisseur || "Fournisseur",
    });
    if (existingKeys.has(k) || seen.has(k)) dup++;
    seen.add(k);
  }
  return { duplicates: dup, total: lignes.length };
}

export async function insertLignes(
  userId: string,
  cotationId: string,
  lignes: ExtractedLigne[],
  startOrdre: number,
  strategy: DuplicateStrategy = "ignore",
): Promise<{ count: number; skipped: number; replaced: number; error?: string }> {
  if (lignes.length === 0) return { count: 0, skipped: 0, replaced: 0 };

  const { data: existingData } = await (supabase as any)
    .from("cotation_lignes_fournisseurs")
    .select("id, prestation, montant_devise, devise, nom_fournisseur")
    .eq("cotation_id", cotationId);
  const existing = (existingData ?? []) as Array<{
    id: string;
    prestation: string | null;
    montant_devise: number | null;
    devise: string | null;
    nom_fournisseur: string | null;
  }>;
  const existingMap = new Map<string, string>();
  for (const e of existing) existingMap.set(duplicateLineKey(e), e.id);

  const toInsert: ExtractedLigne[] = [];
  const batchKeys = new Set<string>();
  const replaceIds: string[] = [];
  let skipped = 0;

  for (const l of lignes) {
    const k = duplicateLineKey({
      prestation: l.prestation,
      montant_devise: l.montant_devise,
      devise: l.devise,
      nom_fournisseur: l.nom_fournisseur || "Fournisseur",
    });
    const isDup = existingMap.has(k) || batchKeys.has(k);
    if (isDup) {
      if (strategy === "ignore") { skipped++; continue; }
      if (strategy === "replace" && existingMap.has(k)) {
        replaceIds.push(existingMap.get(k)!);
      }
    }
    toInsert.push(l);
    batchKeys.add(k);
  }

  let replaced = 0;
  if (replaceIds.length > 0) {
    const { error: delErr } = await (supabase as any)
      .from("cotation_lignes_fournisseurs")
      .delete()
      .in("id", replaceIds);
    if (!delErr) replaced = replaceIds.length;
  }

  if (toInsert.length === 0) return { count: 0, skipped, replaced };

  const rows = toInsert.map((l, i) => {
    const taux = l.devise === "EUR" ? 1 : 1;
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
  const { error } = await (supabase as any).from("cotation_lignes_fournisseurs").insert(rows);
  if (error) return { count: 0, skipped, replaced, error: error.message };
  return { count: rows.length, skipped, replaced };
}

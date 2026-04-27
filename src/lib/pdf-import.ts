// Module d'import PDF : extraction texte (pdfjs), appel à l'edge function IA,
// normalisation et validation avant création des entités métier.

import { supabase } from "@/integrations/supabase/client";
import type { DeviseCode } from "@/lib/fx";
import { DEVISES } from "@/lib/fx";

export type Confiance = "faible" | "moyenne" | "elevee";

export type SupplierContractData = {
  fournisseur_nom?: string;
  dossier_reference?: string;
  description?: string;
  devise?: DeviseCode;
  montant_devise?: number;
  montant_eur?: number;
  taux_change?: number;
  date_echeance?: string;
  reference_fournisseur?: string;
  conditions_paiement?: string;
  echeances?: Array<{
    type: "acompte_1" | "acompte_2" | "acompte_3" | "solde" | "autre";
    date_echeance?: string;
    montant_devise: number;
  }>;
};

export type FxCoverageData = {
  reference?: string;
  banque?: string;
  devise?: DeviseCode;
  montant_devise?: number;
  taux_change?: number;
  montant_eur?: number;
  date_ouverture?: string;
  date_echeance?: string;
  notes?: string;
};

export type PdfImportType = "contrat_fournisseur" | "couverture_fx";

const VALID_DEVISES = new Set(DEVISES.map((d) => d.code));

/** Extrait tout le texte d'un PDF dans le navigateur via pdfjs-dist. */
export async function extractTextFromPdf(file: File): Promise<string> {
  // Import dynamique pour éviter les soucis SSR
  const pdfjs = await import("pdfjs-dist");
  // Worker via CDN (évite les soucis de bundling)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfjs as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageText = content.items.map((it: any) => it.str ?? "").join(" ");
    text += pageText + "\n";
  }
  return text.trim();
}

/** Appelle l'edge function IA pour extraire les données structurées. */
async function callExtraction(
  type: PdfImportType,
  text: string,
): Promise<{ data: Record<string, unknown>; confiance: Confiance; error?: string }> {
  const { data, error } = await supabase.functions.invoke("extract-pdf", {
    body: { type, text },
  });
  if (error) {
    return { data: {}, confiance: "faible", error: error.message };
  }
  if (data?.error) {
    return { data: {}, confiance: "faible", error: data.error };
  }
  return {
    data: (data?.data ?? {}) as Record<string, unknown>,
    confiance: (data?.confiance as Confiance) ?? "moyenne",
  };
}

export async function extractSupplierContractFromPdf(
  text: string,
): Promise<{ data: SupplierContractData; confiance: Confiance; error?: string }> {
  const res = await callExtraction("contrat_fournisseur", text);
  return {
    data: normalizeExtractedPdfData("contrat_fournisseur", res.data) as SupplierContractData,
    confiance: res.confiance,
    error: res.error,
  };
}

export async function extractFxCoverageFromPdf(
  text: string,
): Promise<{ data: FxCoverageData; confiance: Confiance; error?: string }> {
  const res = await callExtraction("couverture_fx", text);
  return {
    data: normalizeExtractedPdfData("couverture_fx", res.data) as FxCoverageData,
    confiance: res.confiance,
    error: res.error,
  };
}

const num = (v: unknown): number | undefined => {
  if (v == null || v === "") return undefined;
  const n = Number(String(v).replace(/[^0-9.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
};

const isoDate = (v: unknown): string | undefined => {
  if (typeof v !== "string" || !v.trim()) return undefined;
  // Si déjà ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  // jj/mm/aaaa
  const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    const [, d, mo, y] = m;
    const yy = y.length === 2 ? `20${y}` : y;
    return `${yy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return undefined;
};

const devise = (v: unknown): DeviseCode | undefined => {
  if (typeof v !== "string") return undefined;
  const code = v.trim().toUpperCase();
  return VALID_DEVISES.has(code as DeviseCode) ? (code as DeviseCode) : undefined;
};

/** Nettoie/normalise les données extraites pour qu'elles collent au schéma DB. */
export function normalizeExtractedPdfData(
  type: PdfImportType,
  raw: Record<string, unknown>,
): SupplierContractData | FxCoverageData {
  if (type === "couverture_fx") {
    return {
      reference: (raw.reference as string) || undefined,
      banque: (raw.banque as string) || undefined,
      devise: devise(raw.devise),
      montant_devise: num(raw.montant_devise),
      taux_change: num(raw.taux_change),
      montant_eur: num(raw.montant_eur),
      date_ouverture: isoDate(raw.date_ouverture),
      date_echeance: isoDate(raw.date_echeance),
      notes: (raw.notes as string) || undefined,
    };
  }
  // contrat fournisseur
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ech = Array.isArray(raw.echeances) ? (raw.echeances as any[]) : [];
  return {
    fournisseur_nom: (raw.fournisseur_nom as string) || undefined,
    dossier_reference: (raw.dossier_reference as string) || undefined,
    description: (raw.description as string) || undefined,
    devise: devise(raw.devise),
    montant_devise: num(raw.montant_devise),
    montant_eur: num(raw.montant_eur),
    taux_change: num(raw.taux_change),
    date_echeance: isoDate(raw.date_echeance),
    reference_fournisseur: (raw.reference_fournisseur as string) || undefined,
    conditions_paiement: (raw.conditions_paiement as string) || undefined,
    echeances: ech
      .map((e) => ({
        type: ["acompte_1", "acompte_2", "acompte_3", "solde", "autre"].includes(
          e?.type,
        )
          ? e.type
          : ("autre" as const),
        date_echeance: isoDate(e?.date_echeance),
        montant_devise: num(e?.montant_devise) ?? 0,
      }))
      .filter((e) => e.montant_devise > 0),
  };
}

/** Vérifie qu'on a le minimum requis avant de créer dans la base. */
export function validatePdfImportBeforeCreation(
  type: PdfImportType,
  data: SupplierContractData | FxCoverageData,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (type === "couverture_fx") {
    const d = data as FxCoverageData;
    if (!d.devise) errors.push("Devise requise.");
    if (!d.montant_devise || d.montant_devise <= 0)
      errors.push("Montant en devise requis.");
    if (!d.taux_change || d.taux_change <= 0)
      errors.push("Taux de change requis.");
    if (!d.date_echeance) errors.push("Date d'échéance requise.");
  } else {
    const d = data as SupplierContractData;
    if (!d.fournisseur_nom?.trim()) errors.push("Nom du fournisseur requis.");
    if (!d.devise) errors.push("Devise requise.");
    if (!d.montant_devise || d.montant_devise <= 0)
      errors.push("Montant en devise requis.");
  }
  return { ok: errors.length === 0, errors };
}

/** Upload du PDF dans le bucket privé pdf-imports. */
export async function uploadPdfToStorage(
  userId: string,
  file: File,
): Promise<{ path: string | null; error: string | null }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage
    .from("pdf-imports")
    .upload(path, file, { contentType: "application/pdf", upsert: false });
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

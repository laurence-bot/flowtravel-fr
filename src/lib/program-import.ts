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
  /** Date du jour au format YYYY-MM-DD si disponible (source de vérité prioritaire). */
  date_jour?: string | null;
  description?: string | null;
  /** Nom de l'hébergement de la nuit, tel qu'écrit dans le document. */
  hotel_nom?: string | null;
  /** Inclusions détectées (repas, transferts…) */
  inclusions?: string[] | null;
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

    const rawResult: ExtractedProgram = {
      jours: data.data.jours ?? [],
      lignes: data.data.lignes ?? [],
      confiance: data.data.confiance ?? data.confiance ?? "basse",
      fournisseur_nom: data.data.fournisseur_nom ?? null,
      destination: data.data.destination ?? null,
    };

    const result = sanitizeExtractedProgram(rawResult);

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
      date_jour: j.date_jour ?? null,
      description: j.description ?? null,
      hotel_nom: j.hotel_nom ?? null,
      inclusions: j.inclusions ?? null,
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
// upsertJoursProgramme — fusionne intelligemment les jours extraits avec
// les jours existants : update sur match (date_jour prioritaire, sinon
// titre normalisé), insert pour les vrais nouveaux jours, puis renumérote
// l'ensemble par date_jour puis ordre.
// ---------------------------------------------------------------------------

export interface UpsertJoursResult {
  inserted: number;
  updated: number;
  skipped: number;
  error: string | null;
}

function normalizeTitre(t: string | null | undefined): string {
  if (!t) return "";
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Calcule date_jour à partir de date_depart + (ordre - 1) jours, en YYYY-MM-DD UTC. */
function addDaysISO(dateDepart: string, daysOffset: number): string {
  // dateDepart au format YYYY-MM-DD : on construit en UTC pour éviter les dérives TZ.
  const [y, m, d] = dateDepart.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + daysOffset);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export async function upsertJoursProgramme(
  userId: string,
  cotationId: string,
  jours: JourExtrait[],
  options?: { dateDepart?: string | null; dateRetour?: string | null },
): Promise<UpsertJoursResult> {
  if (jours.length === 0) return { inserted: 0, updated: 0, skipped: 0, error: null };

  try {
    // 1) Si dateDepart/dateRetour non fournis, on les charge depuis la cotation.
    let dateDepart = options?.dateDepart ?? null;
    let dateRetour = options?.dateRetour ?? null;
    if (!dateDepart || !dateRetour) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cot } = await (supabase as any)
        .from("cotations")
        .select("date_depart, date_retour")
        .eq("id", cotationId)
        .maybeSingle();
      dateDepart = dateDepart ?? cot?.date_depart ?? null;
      dateRetour = dateRetour ?? cot?.date_retour ?? null;
    }

    // 2) Calcule date_jour manquante à partir de date_depart si dispo.
    const enrichedAll: JourExtrait[] = jours.map((j) => {
      if (j.date_jour) return j;
      if (dateDepart && typeof j.ordre === "number" && j.ordre >= 1) {
        return { ...j, date_jour: addDaysISO(dateDepart, j.ordre - 1) };
      }
      return j;
    });

    // 2bis) Garde-fou global : on ignore tout jour hors plage [dateDepart, dateRetour].
    //       Règle métier FlowTravel : aucun jour de programme ne peut tomber
    //       avant le départ ou après le retour de la cotation.
    let outOfRange = 0;
    const enriched: JourExtrait[] = enrichedAll.filter((j) => {
      if (!j.date_jour) return true;
      if (dateDepart && j.date_jour < dateDepart) {
        console.warn("[program-import] jour ignoré (avant date_depart):", j.date_jour, j.titre);
        outOfRange++;
        return false;
      }
      if (dateRetour && j.date_jour > dateRetour) {
        console.warn("[program-import] jour ignoré (après date_retour):", j.date_jour, j.titre);
        outOfRange++;
        return false;
      }
      return true;
    });
    if (enriched.length === 0) {
      return { inserted: 0, updated: 0, skipped: outOfRange, error: null };
    }

    // 2) Récupère les jours existants
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingRaw, error: selErr } = await (supabase as any)
      .from("cotation_jours")
      .select("id, ordre, titre, lieu, date_jour, description, hotel_nom, inclusions")
      .eq("cotation_id", cotationId);

    if (selErr) return { inserted: 0, updated: 0, skipped: 0, error: selErr.message };

    type ExistingRow = {
      id: string;
      ordre: number;
      titre: string | null;
      lieu: string | null;
      date_jour: string | null;
      description: string | null;
      hotel_nom: string | null;
      inclusions: unknown;
    };

    const existing: ExistingRow[] = (existingRaw ?? []) as ExistingRow[];

    // Indexation rapide
    const byDate = new Map<string, ExistingRow>();
    const byTitle = new Map<string, ExistingRow>();
    for (const e of existing) {
      if (e.date_jour) byDate.set(e.date_jour, e);
      const k = normalizeTitre(e.titre);
      if (k) byTitle.set(k, e);
    }

    let inserted = 0;
    let updated = 0;
    const usedExistingIds = new Set<string>();
    const inserts: Record<string, unknown>[] = [];

    for (const j of enriched) {
      const matchByDate = j.date_jour ? byDate.get(j.date_jour) : undefined;
      const matchByTitle = !matchByDate ? byTitle.get(normalizeTitre(j.titre)) : undefined;
      const match = matchByDate ?? matchByTitle;

      if (match && !usedExistingIds.has(match.id)) {
        usedExistingIds.add(match.id);
        const existingText = `${match.titre ?? ""} ${match.description ?? ""}`;
        const incomingText = `${j.titre ?? ""} ${j.description ?? ""}`;
        const flightRegex =
          /\b(vol|envol|flight|départ|depart|arrivée|arrivee|aéroport|aeroport|airport|nuit en vol|nuit à bord|embarquement|atterrissage)\b/i;
        const existingIsFlightDay = flightRegex.test(existingText);
        const incomingIsFlightDay = flightRegex.test(incomingText);
        const preserveExistingFlight = existingIsFlightDay && !incomingIsFlightDay;

        const mergedDescription = preserveExistingFlight
          ? [match.description, j.description].filter(Boolean).join("\n\n")
          : (j.description ?? match.description);

        const patch: Record<string, unknown> = {
          titre: preserveExistingFlight ? match.titre : (j.titre ?? match.titre),
          lieu: j.lieu ?? match.lieu,
          date_jour: match.date_jour ?? j.date_jour ?? null,
          description: mergedDescription,
          hotel_nom: j.hotel_nom ?? match.hotel_nom,
          // Préserve les inclusions existantes si l'extraction n'en fournit pas
          inclusions: j.inclusions ?? match.inclusions ?? null,
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: upErr } = await (supabase as any).from("cotation_jours").update(patch).eq("id", match.id);
        if (upErr) return { inserted, updated, skipped: 0, error: upErr.message };
        updated++;
      } else {
        inserts.push({
          cotation_id: cotationId,
          user_id: userId,
          ordre: 9000 + inserts.length, // temporaire, renuméroté ensuite
          titre: j.titre,
          lieu: j.lieu ?? null,
          date_jour: j.date_jour ?? null,
          description: j.description ?? null,
          hotel_nom: j.hotel_nom ?? null,
          inclusions: j.inclusions ?? null,
        });
      }
    }

    if (inserts.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insErr } = await (supabase as any).from("cotation_jours").insert(inserts);
      if (insErr) return { inserted, updated, skipped: 0, error: insErr.message };
      inserted = inserts.length;
    }

    // 3) Renumérotation finale par date_jour puis ordre.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allRaw, error: reSelErr } = await (supabase as any)
      .from("cotation_jours")
      .select("id, ordre, date_jour")
      .eq("cotation_id", cotationId);

    if (reSelErr) return { inserted, updated, skipped: 0, error: reSelErr.message };

    const all = ((allRaw ?? []) as Array<{ id: string; ordre: number; date_jour: string | null }>)
      .slice()
      .sort((a, b) => {
        if (a.date_jour && b.date_jour) {
          if (a.date_jour < b.date_jour) return -1;
          if (a.date_jour > b.date_jour) return 1;
          return a.ordre - b.ordre;
        }
        if (a.date_jour && !b.date_jour) return -1;
        if (!a.date_jour && b.date_jour) return 1;
        return a.ordre - b.ordre;
      });

    for (let i = 0; i < all.length; i++) {
      const target = i + 1;
      if (all[i].ordre !== target) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("cotation_jours").update({ ordre: target }).eq("id", all[i].id);
      }
    }

    return { inserted, updated, skipped: outOfRange, error: null };
  } catch (e) {
    return {
      inserted: 0,
      updated: 0,
      skipped: 0,
      error: e instanceof Error ? e.message : "Erreur upsertJoursProgramme.",
    };
  }
}

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

      toInsert.push(lineToDbPayload(userId, cotationId, l, startOrdre + idx));
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("cotation_lignes_fournisseurs")
      .select("prestation, montant_devise, devise, nom_fournisseur, mode_tarifaire")
      .eq("cotation_id", cotationId);
    const existingKeys = new Set<string>(((data ?? []) as ExistingSupplierLine[]).map((row) => supplierLineKey(row)));
    const cleaned = sanitizeExtractedProgram({ jours: [], lignes, confiance: "haute" }).lignes;
    for (const l of cleaned) {
      const key = supplierLineKey({
        prestation: l.prestation,
        montant_devise: l.montant_devise,
        devise: l.devise,
        nom_fournisseur: l.nom_fournisseur ?? null,
        mode_tarifaire: l.mode_tarifaire ?? "global",
      });
      if (existingKeys.has(key)) duplicates++;
    }
    return { duplicates };
  } catch {
    return { duplicates: 0 };
  }
}

// ---------------------------------------------------------------------------
// upsertSupplierLinesFromPdf — synchronisation STRICTEMENT IDÉMPOTENTE
// des lignes fournisseurs extraites d'un PDF.
//
// Règle métier globale FlowTravel :
//   Cliquer N fois sur "Sync PDF + vols" doit produire le même résultat
//   qu'un seul clic. Les options ne se dupliquent jamais.
//
// Clé métier (cotation_id implicite) :
//   prestation normalisée + montant_devise + devise + mode_tarifaire
//   (fournisseur exclu volontairement pour éviter les faux doublons)
//
// Comportement :
//   1. récupère toutes les lignes existantes pour cette cotation
//   2. fusionne d'abord les doublons internes côté DB sur la même clé
//   3. pour chaque ligne extraite :
//        - clé déjà présente → UPDATE (rafraîchit quantité/prestation lisible)
//        - clé absente       → INSERT
//   4. ne supprime JAMAIS les lignes existantes hors PDF (couvertures FX,
//      saisies manuelles…) — l'upsert est additif.
// ---------------------------------------------------------------------------

type ExistingSupplierLine = {
  id?: string;
  prestation: string | null;
  montant_devise: number | null;
  devise: string | null;
  nom_fournisseur: string | null;
  mode_tarifaire?: string | null;
};

/** Normalise un libellé fournisseur (retire "Option:", accents, espaces, casse). */
export function normalizeSupplierLineName(s: string | null | undefined): string {
  return (
    (s ?? "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      // Préfixes optionnels à neutraliser pour éviter les faux doublons
      .replace(/^\s*(?:option\s*:|en\s+option\s*:?|optional\s*:|opt\s*:)\s*/i, "")
      .replace(/\bopt(?:ion(?:nel(?:le)?)?)?\b\s*:?\s*/gi, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function normalizeModeTarifaire(mode: string | null | undefined): "global" | "par_personne" {
  return mode === "par_personne" ? "par_personne" : "global";
}

function isAccommodationLineName(name: string | null | undefined): boolean {
  const n = normalizeSupplierLineName(name);
  return (
    n.startsWith("hebergement ") ||
    n.includes(" hotel ") ||
    n.includes(" resort ") ||
    n.includes(" villas ") ||
    n.includes(" villa ")
  );
}

function isPackageLineName(name: string | null | undefined): boolean {
  const n = normalizeSupplierLineName(name);
  return (
    n.includes("circuit") ||
    n.includes("programme") ||
    n.includes("sejour") ||
    n.includes("voyage") ||
    n.includes("package") ||
    n.includes("tour")
  );
}

function roundMoney(n: number | null | undefined): string {
  return Number(n ?? 0).toFixed(2);
}

function lineToDbPayload(userId: string, cotationId: string, l: LigneExtraite, ordre: number) {
  const mode = normalizeModeTarifaire(l.mode_tarifaire);
  const montantDevise = Number(l.montant_devise ?? 0);
  const devise = (l.devise || "EUR").toUpperCase();

  // Taux par défaut solide : EUR = 1, autre devise = 1 tant qu'aucune couverture FX
  // n'a été appliquée. Cela évite les coûts fournisseurs à 0 €.
  const taux = 1;

  return {
    cotation_id: cotationId,
    user_id: userId,
    ordre,
    prestation: l.prestation,
    nom_fournisseur: l.nom_fournisseur?.trim() || "Fournisseur à préciser",
    quantite: Number(l.quantite ?? 1) || 1,
    montant_devise: montantDevise,
    devise,
    taux_change_vers_eur: taux,
    montant_eur: montantDevise * taux,
    mode_tarifaire: mode,
    pct_acompte_1: 30,
    pct_acompte_2: 0,
    pct_acompte_3: 0,
    pct_solde: 70,
    source_fx: "taux_du_jour",
  };
}

export function sanitizeExtractedProgram(program: ExtractedProgram): ExtractedProgram {
  const raw = program.lignes ?? [];

  // Montants des lignes package/circuit : si l'IA a copié ce prix sur chaque hôtel
  // de la liste d'hébergements, ces lignes sont fausses et doivent être supprimées.
  const packageAmounts = new Set(
    raw
      .filter((l) => isPackageLineName(l.prestation) && Number(l.montant_devise ?? 0) > 0)
      .map((l) => `${roundMoney(l.montant_devise)}|${(l.devise || "").toUpperCase()}`),
  );

  const seen = new Set<string>();
  const lignes: LigneExtraite[] = [];

  for (const l of raw) {
    const montant = Number(l.montant_devise ?? 0);
    if (!l.prestation?.trim() || !Number.isFinite(montant) || montant <= 0) continue;

    const amountKey = `${roundMoney(montant)}|${(l.devise || "").toUpperCase()}`;
    const looksLikeAllocatedHotel = isAccommodationLineName(l.prestation) && packageAmounts.has(amountKey);

    // Exemple corrigé : une liste d'hôtels sans prix ne doit pas devenir 5 lignes
    // fournisseur à 2695 USD chacune. Les hôtels restent sur les jours/hotel_nom.
    if (looksLikeAllocatedHotel) continue;

    const normalized: LigneExtraite = {
      ...l,
      quantite: Number(l.quantite ?? 1) || 1,
      montant_devise: montant,
      devise: (l.devise || "EUR").toUpperCase(),
      mode_tarifaire: normalizeModeTarifaire(l.mode_tarifaire),
      nom_fournisseur: l.nom_fournisseur?.trim() || program.fournisseur_nom || null,
    };

    const key = supplierLineKey({
      prestation: normalized.prestation,
      montant_devise: normalized.montant_devise,
      devise: normalized.devise,
      nom_fournisseur: normalized.nom_fournisseur ?? null,
      mode_tarifaire: normalized.mode_tarifaire,
    });

    if (seen.has(key)) continue;
    seen.add(key);
    lignes.push(normalized);
  }

  return { ...program, lignes };
}

/** Clé unique métier d'une ligne fournisseur (cotation_id implicite). */
export function supplierLineKey(l: ExistingSupplierLine): string {
  const presta = normalizeSupplierLineName(l.prestation);
  const montant = Number(l.montant_devise ?? 0).toFixed(2);
  const dev = (l.devise ?? "").toUpperCase();
  const mode = normalizeModeTarifaire(l.mode_tarifaire);

  // IMPORTANT : le fournisseur n'entre volontairement PAS dans la clé.
  // En import PDF, la même prestation peut arriver une fois avec le vrai fournisseur
  // (ex. Jans Tours) puis une fois avec le libellé recopié comme fournisseur.
  // Si on garde le fournisseur dans la clé, la synchro crée des doublons.
  return `${presta}|${montant}|${dev}|${mode}`;
}

export interface UpsertSupplierLinesResult {
  inserted: number;
  updated: number;
  mergedDuplicates: number;
  error: string | null;
}

export async function upsertSupplierLinesFromPdf(
  userId: string,
  cotationId: string,
  lignes: LigneExtraite[],
): Promise<UpsertSupplierLinesResult> {
  const cleanProgram = sanitizeExtractedProgram({ jours: [], lignes, confiance: "haute" });
  const cleanLines = cleanProgram.lignes;

  if (cleanLines.length === 0) {
    return { inserted: 0, updated: 0, mergedDuplicates: 0, error: null };
  }
  try {
    // 1) Récupère l'existant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingRows, error: selErr } = await (supabase as any)
      .from("cotation_lignes_fournisseurs")
      .select("id, prestation, montant_devise, devise, nom_fournisseur, mode_tarifaire, ordre, created_at")
      .eq("cotation_id", cotationId)
      .order("created_at", { ascending: true });
    if (selErr) return { inserted: 0, updated: 0, mergedDuplicates: 0, error: selErr.message };

    type ExistingRow = ExistingSupplierLine & { id: string; ordre?: number | null; created_at?: string };
    const rows = (existingRows ?? []) as ExistingRow[];

    // 2) Fusionne d'abord les doublons internes (même clé) en supprimant les
    //    occurrences en trop. On garde la ligne la plus ancienne (ordre stable).
    const byKey = new Map<string, ExistingRow>();
    const internalDupIds: string[] = [];
    for (const row of rows) {
      const k = supplierLineKey(row);
      if (byKey.has(k)) internalDupIds.push(row.id);
      else byKey.set(k, row);
    }
    let mergedDuplicates = 0;
    if (internalDupIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: dErr } = await (supabase as any)
        .from("cotation_lignes_fournisseurs")
        .delete()
        .in("id", internalDupIds);
      if (dErr) return { inserted: 0, updated: 0, mergedDuplicates: 0, error: dErr.message };
      mergedDuplicates = internalDupIds.length;
    }

    // 3) Calcule le prochain "ordre" pour les insertions
    let maxOrdre = 0;
    for (const row of byKey.values()) {
      if ((row.ordre ?? 0) > maxOrdre) maxOrdre = row.ordre ?? 0;
    }

    // 4) Pour chaque ligne extraite : upsert sur la clé métier
    let inserted = 0;
    let updated = 0;
    const seenInPdf = new Set<string>();

    for (const l of cleanLines) {
      const key = supplierLineKey({
        prestation: l.prestation,
        montant_devise: l.montant_devise,
        devise: l.devise,
        nom_fournisseur: l.nom_fournisseur ?? null,
        mode_tarifaire: l.mode_tarifaire ?? "global",
      });
      // Évite de traiter deux fois la même ligne dans le même PDF
      if (seenInPdf.has(key)) continue;
      seenInPdf.add(key);

      const existing = byKey.get(key);
      if (existing) {
        // UPDATE : rafraîchit prestation lisible / quantité / fournisseur
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: uErr } = await (supabase as any)
          .from("cotation_lignes_fournisseurs")
          .update(lineToDbPayload(userId, cotationId, l, existing.ordre ?? 1))
          .eq("id", existing.id);
        if (uErr) return { inserted, updated, mergedDuplicates, error: uErr.message };
        updated++;
      } else {
        maxOrdre += 1;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: ins, error: iErr } = await (supabase as any)
          .from("cotation_lignes_fournisseurs")
          .insert(lineToDbPayload(userId, cotationId, l, maxOrdre))
          .select("id")
          .single();
        if (iErr) return { inserted, updated, mergedDuplicates, error: iErr.message };
        inserted++;
        if (ins?.id) {
          byKey.set(key, {
            id: ins.id as string,
            prestation: l.prestation,
            montant_devise: l.montant_devise,
            devise: l.devise,
            nom_fournisseur: l.nom_fournisseur ?? null,
            mode_tarifaire: l.mode_tarifaire ?? "global",
            ordre: maxOrdre,
          });
        }
      }
    }

    return { inserted, updated, mergedDuplicates, error: null };
  } catch (e) {
    return {
      inserted: 0,
      updated: 0,
      mergedDuplicates: 0,
      error: e instanceof Error ? e.message : "Erreur upsertSupplierLinesFromPdf.",
    };
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

    const l = await upsertSupplierLinesFromPdf(userId, cotationId, program.lignes);
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

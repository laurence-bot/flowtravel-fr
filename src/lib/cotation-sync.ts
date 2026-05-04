import type { CotationJour } from "@/lib/quote-public";
import type { GeneratedDay } from "@/lib/itinerary-from-flights";

export type SyncJour = Pick<
  CotationJour,
  | "id"
  | "ordre"
  | "titre"
  | "description"
  | "lieu"
  | "date_jour"
  | "image_url"
  | "gallery_urls"
  | "hotel_nom"
  | "created_at"
>;

export type JourUpdate = {
  id: string;
  patch: {
    ordre: number;
    date_jour: string | null;
    titre: string;
    lieu: string | null;
    description: string | null;
  };
};

export type JourInsert = {
  ordre: number;
  date_jour: string | null;
  titre: string;
  lieu: string | null;
  description: string | null;
};

export type JourSyncPlan = {
  updates: JourUpdate[];
  inserts: JourInsert[];
  deleteIds: string[];
  targetCount: number;
  conflicts: string[];
  preservedExtraCount: number;
};

export function normKey(s: string | null | undefined): string {
  return (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractDayNumber(titre: string | null | undefined): number | null {
  const m = normKey(titre).match(/^j(?:our)?\s*(\d{1,3})\b/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function isPlaceholderTitle(titre: string | null | undefined): boolean {
  const t = normKey(titre);
  return /^j(?:our)?\s*\d{1,3}(?:\s*(?:a completer|destination|bali|java|votre destination))?$/.test(t);
}

export function dayContentScore(j: Pick<SyncJour, "titre" | "description" | "lieu" | "image_url" | "gallery_urls" | "hotel_nom">): number {
  let score = 0;
  if (j.description?.trim()) score += Math.min(80, j.description.trim().length / 6);
  if (j.lieu?.trim()) score += 8;
  if (j.hotel_nom?.trim()) score += 10;
  if (j.image_url) score += 12;
  if (Array.isArray(j.gallery_urls)) score += Math.min(20, j.gallery_urls.length * 5);
  if (j.titre?.trim() && !isPlaceholderTitle(j.titre)) score += 14;
  return score;
}

export function isEmptyPlaceholderDay(j: SyncJour): boolean {
  return isPlaceholderTitle(j.titre) && dayContentScore(j) < 10;
}

function addDays(date: string, offset: number): string | null {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function buildFallbackTargets(start: string | null | undefined, end: string | null | undefined, minimumCount: number): GeneratedDay[] {
  const targets: GeneratedDay[] = [];
  if (start && end) {
    const s = new Date(`${start}T00:00:00`);
    const e = new Date(`${end}T00:00:00`);
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && e >= s) {
      const count = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
      for (let i = 0; i < count; i++) {
        targets.push({
          ordre: i + 1,
          date_jour: addDays(start, i) ?? start,
          titre: `Jour ${i + 1}`,
          lieu: null,
          description: null,
          isFlightDay: false,
        });
      }
    }
  }
  if (targets.length > 0) return targets;
  for (let i = 0; i < minimumCount; i++) {
    targets.push({
      ordre: i + 1,
      date_jour: null as unknown as string,
      titre: `Jour ${i + 1}`,
      lieu: null,
      description: null,
      isFlightDay: false,
    });
  }
  return targets;
}

function joinUnique(parts: Array<string | null | undefined>): string | null {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const text = part?.trim();
    if (!text) continue;
    const key = normKey(text).slice(0, 180);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out.length > 0 ? out.join("\n\n") : null;
}

function sameMeaning(a: SyncJour, b: SyncJour): boolean {
  if (a.date_jour && b.date_jour && a.date_jour === b.date_jour) return true;
  const an = extractDayNumber(a.titre);
  const bn = extractDayNumber(b.titre);
  if (an && bn && an === bn) return true;
  const ak = `${normKey(a.titre)}|${normKey(a.description).slice(0, 160)}`;
  const bk = `${normKey(b.titre)}|${normKey(b.description).slice(0, 160)}`;
  return ak !== "|" && ak === bk;
}

export function buildJourSyncPlan(params: {
  existing: SyncJour[];
  generatedFromFlights: GeneratedDay[];
  fallbackStart: string | null | undefined;
  fallbackEnd: string | null | undefined;
}): JourSyncPlan {
  const orderedExisting = [...params.existing].sort((a, b) => {
    const ao = a.ordre - b.ordre;
    if (ao !== 0) return ao;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });
  const targets = params.generatedFromFlights.length > 0
    ? params.generatedFromFlights
    : buildFallbackTargets(params.fallbackStart, params.fallbackEnd, orderedExisting.length);

  const used = new Set<string>();
  const selectedByTarget: SyncJour[] = [];
  const updates: JourUpdate[] = [];
  const inserts: JourInsert[] = [];
  const conflicts: string[] = [];

  const existingDates = orderedExisting.map((j) => j.date_jour).filter(Boolean) as string[];
  if (params.generatedFromFlights.length > 0 && existingDates.length > 0) {
    const targetDates = new Set(targets.map((t) => t.date_jour));
    const outside = existingDates.filter((d) => !targetDates.has(d));
    if (outside.length > 0) conflicts.push(`${outside.length} date(s) du programme PDF ne correspondent pas aux dates des vols.`);
  }
  if (params.generatedFromFlights.length > 0 && orderedExisting.length > targets.length) {
    conflicts.push(`${orderedExisting.length - targets.length} jour(s) en trop détecté(s) par rapport aux vols.`);
  }

  // Compute alignment offset: match PDF "Jour N" titles to the correct target.
  // If flight targets exist and existing PDF days are numbered Jour 1..N, anchor
  // PDF's "Jour 1" to the first non-flight target (real arrival day in destination).
  // This avoids attaching destination text to a flight/transit day.
  let pdfDayOffset = 0;
  if (params.generatedFromFlights.length > 0) {
    const firstNonFlightIdx = targets.findIndex((t) => !t.isFlightDay);
    if (firstNonFlightIdx > 0) pdfDayOffset = firstNonFlightIdx;
  }

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const ordre = i + 1;
    // PDF "Jour N" maps to target index (pdfDayOffset + N - 1)
    const expectedPdfDayNumber = i - pdfDayOffset + 1;
    const candidates = orderedExisting.filter((j) => {
      if (used.has(j.id)) return false;
      const n = extractDayNumber(j.titre);
      // Date match is strongest, then PDF day number with offset, then raw ordre as last resort
      if (j.date_jour && j.date_jour === target.date_jour) return true;
      if (n != null && n === expectedPdfDayNumber) return true;
      // Fallback only when there are no titled-day candidates at all (avoid mis-grabbing)
      if (n == null && j.ordre === ordre && !target.isFlightDay) return true;
      return false;
    });
    const selected = [...candidates].sort((a, b) => dayContentScore(b) - dayContentScore(a))[0];

    if (!selected) {
      inserts.push({
        ordre,
        date_jour: target.date_jour ?? null,
        titre: target.titre || `Jour ${ordre}`,
        lieu: target.lieu ?? null,
        description: target.description ?? null,
      });
      continue;
    }

    used.add(selected.id);
    selectedByTarget.push(selected);
    const keepExistingTitle = !!selected.titre?.trim() && !isPlaceholderTitle(selected.titre);
    const titre = target.isFlightDay
      ? target.titre
      : keepExistingTitle
        ? selected.titre ?? target.titre ?? `Jour ${ordre}`
        : target.titre || `Jour ${ordre}`;
    const description = target.isFlightDay
      ? joinUnique([target.description, selected.description])
      : joinUnique([selected.description, target.description]);
    updates.push({
      id: selected.id,
      patch: {
        ordre,
        date_jour: target.date_jour ?? selected.date_jour ?? null,
        titre,
        lieu: selected.lieu?.trim() ? selected.lieu : target.lieu ?? null,
        description,
      },
    });
  }

  const deleteIds: string[] = [];
  let preservedExtraCount = 0;
  for (const j of orderedExisting) {
    if (used.has(j.id)) continue;
    const duplicateOfSelected = selectedByTarget.some((selected) => sameMeaning(j, selected));
    if (isEmptyPlaceholderDay(j) || duplicateOfSelected || dayContentScore(j) < 18) {
      deleteIds.push(j.id);
    } else {
      preservedExtraCount += 1;
    }
  }
  if (preservedExtraCount > 0) {
    conflicts.push(`${preservedExtraCount} jour(s) avec texte ont été conservés hors synchronisation pour éviter une perte de contenu.`);
  }

  return { updates, inserts, deleteIds, targetCount: targets.length, conflicts, preservedExtraCount };
}

export function duplicateLineKey(l: {
  prestation: string | null;
  montant_devise: number | null;
  devise: string | null;
  nom_fournisseur: string | null;
}): string {
  return `${normKey(l.prestation)}|${Number(l.montant_devise ?? 0).toFixed(2)}|${(l.devise ?? "").toUpperCase()}|${normKey(l.nom_fournisseur)}`;
}
import type { InclusionKey, Inclusions } from "@/lib/quote-public";
import type { FlightSegmentLite } from "@/lib/itinerary-from-flights";

// ─────────────────────────────────────────────
// Mots-clés par catégorie (FR + EN)
// ─────────────────────────────────────────────
const KEYWORDS: Record<InclusionKey, { inclus: RegExp[]; exclus: RegExp[] }> = {
  vol_international: {
    inclus: [/vol\s+international/i, /flight/i, /billet\s+d.avion/i, /envol/i, /vol\s+aller/i, /vol\s+retour/i],
    exclus: [/non\s+inclus/i, /non\s+compris/i, /à\s+votre\s+charge/i],
  },
  vol_domestique: {
    inclus: [/vol\s+domestique/i, /vol\s+intern[ae]/i, /vol\s+IU\s*\d+/i, /vol\s+intérieur/i],
    exclus: [/non\s+inclus/i],
  },
  hebergement: {
    inclus: [/hébergement/i, /nuit/i, /hôtel/i, /hotel/i, /lodge/i, /villa/i, /riad/i, /resort/i, /chambre/i, /logement/i],
    exclus: [/non\s+inclus/i, /non\s+compris/i],
  },
  petit_dejeuner: {
    inclus: [/petit[- ]déjeuner/i, /petit[- ]dejeuner/i, /breakfast/i, /p\.dej/i],
    exclus: [/non\s+inclus/i, /sans\s+petit/i],
  },
  dejeuner: {
    inclus: [/déjeuner/i, /dejeuner/i, /lunch/i, /repas\s+de\s+midi/i, /dîner\s+et\s+déjeuner/i],
    exclus: [/non\s+inclus/i, /libre/i, /à\s+votre\s+charge/i],
  },
  diner: {
    inclus: [/dîner/i, /diner/i, /dinner/i, /repas\s+du\s+soir/i, /soirée\s+gastronomique/i],
    exclus: [/non\s+inclus/i, /libre/i, /à\s+votre\s+charge/i],
  },
  guide: {
    inclus: [/guide/i, /guide\s+francophone/i, /accompagnateur/i, /escort/i],
    exclus: [/non\s+inclus/i, /sans\s+guide/i],
  },
  transfert: {
    inclus: [/transfert/i, /transfer/i, /navette/i, /prise\s+en\s+charge/i, /chauffeur/i],
    exclus: [/non\s+inclus/i],
  },
  location_voiture: {
    inclus: [/location\s+(?:de\s+)?voiture/i, /location\s+(?:de\s+)?v[eé]hicule/i, /car\s+rental/i, /auto\s+location/i],
    exclus: [/non\s+inclus/i],
  },
  excursion: {
    inclus: [/excursion/i, /visite\s+guid[eé]e/i, /sortie/i, /safari/i, /trek/i, /randonnée/i],
    exclus: [/non\s+inclus/i, /optionnel/i, /en\s+option/i],
  },
  entrees: {
    inclus: [/entr[eé]es?/i, /billets?\s+d.entr[eé]e/i, /droits?\s+d.entr[eé]e/i, /admission/i],
    exclus: [/non\s+inclus/i],
  },
};

// ─────────────────────────────────────────────
// Détection depuis le texte d'un jour
// ─────────────────────────────────────────────
function detectFromText(text: string): Inclusions {
  const result: Inclusions = {};
  for (const [key, { inclus, exclus }] of Object.entries(KEYWORDS) as Array<[InclusionKey, { inclus: RegExp[]; exclus: RegExp[] }]>) {
    const found = inclus.some((re) => re.test(text));
    if (!found) continue;
    const isExcluded = exclus.some((re) => {
      const match = inclus.find((r) => r.test(text));
      if (!match) return false;
      const idx = text.search(match);
      const ctx = text.slice(Math.max(0, idx - 40), idx + 60);
      return re.test(ctx);
    });
    result[key] = !isExcluded;
  }
  return result;
}

// ─────────────────────────────────────────────
// Injection depuis les segments de vol
// ─────────────────────────────────────────────
function detectFromSegments(
  segments: FlightSegmentLite[],
  jourDate: string | null,
): Partial<Inclusions> {
  if (!segments.length || !jourDate) return {};
  const result: Partial<Inclusions> = {};

  for (const seg of segments) {
    if (seg.date_depart === jourDate || seg.date_arrivee === jourDate) {
      const isDomestic =
        seg.aeroport_depart.slice(0, 2) === seg.aeroport_arrivee.slice(0, 2);
      if (isDomestic) result.vol_domestique = true;
      else result.vol_international = true;
    }
  }
  return result;
}

// ─────────────────────────────────────────────
// Fusion : texte + vols (vols prioritaires pour vol_*)
// ─────────────────────────────────────────────
export function detectInclusions(params: {
  titre: string | null;
  description: string | null;
  segments?: FlightSegmentLite[];
  jourDate?: string | null;
  existingInclusions?: Inclusions | null;
}): Inclusions {
  const { titre, description, segments = [], jourDate, existingInclusions } = params;

  const fullText = [titre, description].filter(Boolean).join(" ");
  const fromText = detectFromText(fullText);
  const fromVols = detectFromSegments(segments, jourDate ?? null);

  const detected: Inclusions = { ...fromText, ...fromVols };

  if (existingInclusions && Object.keys(existingInclusions).length > 0) {
    return { ...detected, ...existingInclusions };
  }

  return detected;
}

// ─────────────────────────────────────────────
// Config d'affichage des pastilles
// ─────────────────────────────────────────────
export const INCLUSION_CONFIG: Record<InclusionKey, { label: string; icon: string }> = {
  vol_international: { label: "Vol international", icon: "plane" },
  vol_domestique:   { label: "Vol domestique",    icon: "plane" },
  hebergement:      { label: "Hébergement",       icon: "hotel" },
  petit_dejeuner:   { label: "Petit-déjeuner",    icon: "coffee" },
  dejeuner:         { label: "Déjeuner",          icon: "utensils" },
  diner:            { label: "Dîner",             icon: "utensils" },
  guide:            { label: "Guide",             icon: "user" },
  transfert:        { label: "Transfert",         icon: "car" },
  location_voiture: { label: "Location voiture",  icon: "car" },
  excursion:        { label: "Excursion",         icon: "map" },
  entrees:          { label: "Entrées",           icon: "ticket" },
};

// ─────────────────────────────────────────────
// Génération globale inclus / à prévoir
// ─────────────────────────────────────────────

export type InclusionSummary = {
  inclus: Array<{ label: string; count: number; total: number }>;
  aPrevoir: Array<{ label: string }>;
};

export function generateInclusText(params: {
  jours: Array<{
    titre: string | null;
    description: string | null;
    date_jour: string | null;
    inclusions: Inclusions | null;
  }>;
  nombrePax: number;
  hasVolInternational: boolean;
  hasVolDomestique: boolean;
}): { inclus_text: string; non_inclus_text: string } {
  const { jours, hasVolInternational, hasVolDomestique } = params;
  const totalJours = jours.length;

  const counts: Partial<Record<InclusionKey, number>> = {};
  const excluded = new Set<InclusionKey>();

  for (const jour of jours) {
    const inc = jour.inclusions ?? {};
    for (const [key, val] of Object.entries(inc) as Array<[InclusionKey, boolean]>) {
      if (val === true) {
        counts[key] = (counts[key] ?? 0) + 1;
      } else if (val === false) {
        excluded.add(key);
      }
    }
  }

  if (hasVolInternational) counts.vol_international = 1;
  if (hasVolDomestique) counts.vol_domestique = 1;

  const inclusLines: string[] = [];

  if (counts.vol_international) inclusLines.push("• Vols internationaux aller-retour");
  if (counts.vol_domestique) inclusLines.push("• Vol(s) domestique(s)");

  if (counts.hebergement) {
    const nuits = counts.hebergement;
    inclusLines.push(`• Hébergement — ${nuits} nuit${nuits > 1 ? "s" : ""} en chambre double`);
  }

  if (counts.petit_dejeuner) {
    const n = counts.petit_dejeuner;
    inclusLines.push(`• ${n} petit${n > 1 ? "s" : ""}-déjeuner${n > 1 ? "s" : ""}`);
  }
  if (counts.dejeuner) {
    const n = counts.dejeuner;
    inclusLines.push(`• ${n} déjeuner${n > 1 ? "s" : ""}`);
  }
  if (counts.diner) {
    const n = counts.diner;
    inclusLines.push(`• ${n} dîner${n > 1 ? "s" : ""}`);
  }

  if (counts.guide) inclusLines.push("• Guide francophone");
  if (counts.transfert) inclusLines.push("• Transferts privés");
  if (counts.location_voiture) inclusLines.push("• Location de véhicule");
  if (counts.excursion) {
    const n = counts.excursion;
    inclusLines.push(`• ${n} excursion${n > 1 ? "s" : ""} et visites guidées`);
  }
  if (counts.entrees) inclusLines.push("• Droits d'entrée sur les sites visités");

  const aPrevoirLines: string[] = [];
  aPrevoirLines.push("• Visa et formalités administratives");
  aPrevoirLines.push("• Assurance voyage (recommandée)");
  aPrevoirLines.push("• Pourboires et dépenses personnelles");

  const repasManquants: string[] = [];
  if (!counts.petit_dejeuner && !excluded.has("petit_dejeuner") && totalJours > 0) {
    repasManquants.push("petits-déjeuners");
  }
  const dejManquants = totalJours - (counts.dejeuner ?? 0);
  if (dejManquants > 0 && totalJours > 0) {
    repasManquants.push(
      dejManquants === totalJours
        ? "déjeuners"
        : `${dejManquants} déjeuner${dejManquants > 1 ? "s" : ""}`,
    );
  }
  const dinerManquants = totalJours - (counts.diner ?? 0);
  if (dinerManquants > 0 && totalJours > 0) {
    repasManquants.push(
      dinerManquants === totalJours
        ? "dîners"
        : `${dinerManquants} dîner${dinerManquants > 1 ? "s" : ""}`,
    );
  }
  if (repasManquants.length > 0) {
    aPrevoirLines.push(`• Repas non inclus : ${repasManquants.join(", ")}`);
  }

  aPrevoirLines.push("• Boissons (sauf mention contraire)");
  if (!counts.excursion) aPrevoirLines.push("• Excursions et activités optionnelles");

  return {
    inclus_text: inclusLines.join("\n"),
    non_inclus_text: aPrevoirLines.join("\n"),
  };
}

import type { InclusionKey, Inclusions } from "@/lib/quote-public";
import type { FlightSegmentLite } from "@/lib/itinerary-from-flights";
import { IATA_COUNTRY } from "@/lib/iata";

// ─────────────────────────────────────────────
// Mots-clés par catégorie (FR + EN)
//
// Règles métier globales FlowTravel :
// - Une "Nuit en vol" / "Nuit à bord" / "Nuit en avion" n'est JAMAIS un
//   hébergement. Le mot-clé "nuit" seul est trop large et a été retiré pour
//   éviter de marquer un jour aérien comme hébergement.
// - Un "vol international" ne doit JAMAIS être interprété comme un vol
//   domestique. L'ancien regex `vol intern[ae]` matchait "vol interna…" de
//   "vol international" → corrigé.
// - La détection définitive vol_domestique vs vol_international se fait sur
//   les segments aériens (pays IATA), pas sur du texte ambigu.
// ─────────────────────────────────────────────
const KEYWORDS: Record<InclusionKey, { inclus: RegExp[]; exclus: RegExp[] }> = {
  vol_international: {
    inclus: [/vol\s+international/i, /vols?\s+internationaux/i, /billet\s+d.avion/i, /vol\s+aller/i, /vol\s+retour/i],
    exclus: [/non\s+inclus/i, /non\s+compris/i, /à\s+votre\s+charge/i],
  },
  vol_domestique: {
    // STRICT : "domestique" / "intérieur" / "intra-…" uniquement.
    // On évite tout regex qui pourrait matcher "international".
    inclus: [/vol\s+domestique/i, /vols?\s+domestiques/i, /vol\s+int[eé]rieur/i, /vol\s+intra[- ]?\w+/i],
    exclus: [/non\s+inclus/i],
  },
  hebergement: {
    // Hébergement = lieu de couchage RÉEL (hôtel, lodge, villa, riad, resort,
    // chambre, logement, camp, croisière, bateau). Le mot "nuit" seul a été
    // RETIRÉ : il matchait à tort "Nuit en vol" / "Nuit à bord".
    inclus: [
      /h[ée]bergement/i,
      /h[ôo]tel/i,
      /lodge/i,
      /villa/i,
      /riad/i,
      /resort/i,
      /chambre/i,
      /logement/i,
      /camp\b/i,
      /croisi[èe]re/i,
      /bateau/i,
      /maison\s+d.h[ôo]tes/i,
      /pension/i,
      /guest[- ]?house/i,
    ],
    exclus: [
      /non\s+inclus/i,
      /non\s+compris/i,
      /nuit\s+(en\s+vol|à\s+bord|en\s+avion|aérienne|a[ée]rienne)/i,
      /à\s+bord/i,
      /en\s+vol/i,
    ],
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
      // Exclusion "globale" : si l'expression d'exclusion apparaît n'importe
      // où dans le texte (ex. "nuit en vol"), on considère le contexte exclu.
      // Cela rattrape les cas où le mot-clé inclus n'est pas adjacent à
      // l'exclusion (ex. "Nuit à bord — arrivée demain").
      if (re.test(text)) return true;
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
//
// Règle métier globale :
// - Un segment est "client-international" dès lors qu'il franchit une
//   frontière (pays IATA différents).
// - Un segment est "client-domestique" UNIQUEMENT si les deux aéroports
//   sont dans le même pays ET que ce pays est le pays de destination
//   visité. Les segments intra-pays d'origine (ex: CDG → MRS sur le
//   retour) sont absorbés dans le voyage international et ne génèrent
//   PAS le badge "Vol domestique".
// - Le badge n'est posé que sur le JOUR DE DÉPART du segment, jamais sur
//   son jour d'arrivée. Cela évite d'afficher "Vol international" /
//   "Vol domestique" le jour où le client pose le pied à destination ou
//   chez lui en fin de voyage.
// ─────────────────────────────────────────────
export type TripFlightContext = {
  homeCountry?: string | null;
  destCountry?: string | null;
};

function detectFromSegments(
  segments: FlightSegmentLite[],
  jourDate: string | null,
  ctx?: TripFlightContext,
): Partial<Inclusions> {
  if (!segments.length || !jourDate) return {};
  const result: Partial<Inclusions> = {};
  const homeCountry = ctx?.homeCountry ?? null;
  const destCountry = ctx?.destCountry ?? null;

  for (const seg of segments) {
    // Ne flagger QUE sur le jour de départ du segment.
    if (seg.date_depart !== jourDate) continue;

    const cFrom = IATA_COUNTRY[seg.aeroport_depart.toUpperCase()] ?? null;
    const cTo = IATA_COUNTRY[seg.aeroport_arrivee.toUpperCase()] ?? null;
    const sameCountry = cFrom && cTo && cFrom === cTo;

    if (!sameCountry) {
      result.vol_international = true;
      continue;
    }

    // Segment intra-pays. Domestique au sens client UNIQUEMENT si on est
    // dans le pays de destination visité — pas dans le pays d'origine.
    if (destCountry && cFrom === destCountry && cFrom !== homeCountry) {
      result.vol_domestique = true;
    }
    // Sinon (intra-pays d'origine, ex: CDG→MRS sur le retour) : absorbé
    // dans le voyage international, on n'ajoute pas vol_domestique.
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
  tripContext?: TripFlightContext;
}): Inclusions {
  const { titre, description, segments = [], jourDate, existingInclusions, tripContext } = params;

  const fullText = [titre, description].filter(Boolean).join(" ");
  const fromText = detectFromText(fullText);
  const fromVols = detectFromSegments(segments, jourDate ?? null, tripContext);

  // Les vols sont prioritaires : si les segments disent "international" et le
  // texte dit "domestique" (ou vice versa), on garde la version segments.
  const detected: Inclusions = { ...fromText, ...fromVols };

  // Garde-fou supplémentaire : si on a explicitement des segments pour ce jour
  // sans vol domestique, on supprime un éventuel vol_domestique mal détecté
  // depuis le texte (ex. "vols internationaux" qui aurait matché un ancien
  // regex). Idem pour vol_international si le jour ne contient AUCUN vol.
  if (segments.length > 0 && jourDate) {
    const hasFlightOnDay = segments.some((s) => s.date_depart === jourDate);
    if (hasFlightOnDay) {
      if (fromVols.vol_domestique === undefined) delete detected.vol_domestique;
      if (fromVols.vol_international === undefined) delete detected.vol_international;
    } else {
      // Aucun vol au départ ce jour-là → aucun badge vol, peu importe le texte
      delete detected.vol_domestique;
      delete detected.vol_international;
    }
  }

  if (existingInclusions && Object.keys(existingInclusions).length > 0) {
    return { ...detected, ...existingInclusions };
  }

  return detected;
}

// ─────────────────────────────────────────────
// Helper : détermine homeCountry / destCountry à partir des segments
// (réutilisable par les appelants pour passer un tripContext cohérent).
// ─────────────────────────────────────────────
export function inferTripContext(segments: FlightSegmentLite[]): TripFlightContext {
  if (segments.length === 0) return {};
  const sorted = [...segments].sort((a, b) => a.ordre - b.ordre);
  const first = sorted[0];
  const homeCountry = IATA_COUNTRY[first.aeroport_depart.toUpperCase()] ?? null;
  let destCountry: string | null = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const c = IATA_COUNTRY[sorted[i].aeroport_arrivee.toUpperCase()] ?? null;
    if (c && c !== homeCountry) {
      destCountry = c;
      break;
    }
  }
  if (!destCountry) {
    destCountry = IATA_COUNTRY[sorted[sorted.length - 1].aeroport_arrivee.toUpperCase()] ?? null;
  }
  return { homeCountry, destCountry };
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

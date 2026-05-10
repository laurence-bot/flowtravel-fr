// Construction d'un squelette d'itinéraire à partir des vols (flight_segments).
// Logique : les vols définissent les bornes (J1 = date départ vol aller, dernier
// jour = date d'arrivée vol retour). Les segments aller produisent un texte type
// "Départ de Marseille à HH:MM avec X, escale à Y de … à …, arrivée à Z le lendemain".
// Si le vol arrive le lendemain, le J1 est marqué "Nuit en vol — Arrivée à destination le …".

import { iataToCity, IATA_COUNTRY, countryNameFr } from "@/lib/iata";
import { airlineName } from "@/lib/airlines";


export type FlightSegmentLite = {
  id: string;
  flight_option_id: string;
  ordre: number;
  compagnie: string | null;
  numero_vol: string | null;
  aeroport_depart: string;
  date_depart: string | null;
  heure_depart: string | null;
  aeroport_arrivee: string;
  date_arrivee: string | null;
  heure_arrivee: string | null;
  duree_escale_minutes: number | null;
};

export type FlightOptionLite = {
  id: string;
  compagnie: string | null;
  date_depart: string | null;
  date_retour: string | null;
  created_at: string;
};

/** Type métier d'une journée générée depuis les vols. */
export type FlightDayType =
  | "departure_day"     // Jour de départ international (quitte le pays d'origine)
  | "overnight_flight"  // Nuit en vol entre départ et arrivée (pas de jour dédié, info portée par J1)
  | "arrival_day"       // Jour d'arrivée à destination (programme terrestre commence)
  | "domestic_transfer" // Vol domestique dans le pays de destination
  | "inbound_flight"    // Jour de départ retour (quitte le pays de destination)
  | "final_arrival"     // Jour d'arrivée finale dans le pays d'origine
  | "stay";             // Jour de séjour (à compléter par le programme terrestre)

export type GeneratedDay = {
  ordre: number;
  date_jour: string;
  titre: string;
  lieu: string | null;
  description: string | null;
  isFlightDay: boolean; // true pour départ/arrivée intl/retour/transfert domestique
  type_jour?: FlightDayType;
};

/** Choisit le vol de référence : confirmé > 1er créé. */
export function pickReferenceFlight(
  vols: FlightOptionLite[],
  chosenFlightOptionId: string | null,
): FlightOptionLite | null {
  if (vols.length === 0) return null;
  if (chosenFlightOptionId) {
    const found = vols.find((v) => v.id === chosenFlightOptionId);
    if (found) return found;
  }
  return [...vols].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
}

/** Sépare les segments d'un vol A/R en aller / retour (plus grand gap au sol). */
export function splitOutboundReturn(segments: FlightSegmentLite[]): {
  outbound: FlightSegmentLite[];
  inbound: FlightSegmentLite[];
} {
  const sorted = [...segments].sort((a, b) => a.ordre - b.ordre);
  if (sorted.length === 0) return { outbound: [], inbound: [] };
  if (sorted.length === 1) return { outbound: sorted, inbound: [] };

  // Trouve le plus grand écart entre arrivée(N) et départ(N+1) — c'est le séjour.
  let maxGap = -1;
  let cutAfter = -1;
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i];
    const nxt = sorted[i + 1];
    if (cur.date_arrivee && cur.heure_arrivee && nxt.date_depart && nxt.heure_depart) {
      const arr = new Date(`${cur.date_arrivee}T${cur.heure_arrivee}`).getTime();
      const dep = new Date(`${nxt.date_depart}T${nxt.heure_depart}`).getTime();
      const gap = dep - arr;
      if (gap > maxGap) {
        maxGap = gap;
        cutAfter = i;
      }
    }
  }
  // Si le plus grand gap est < 24h, on considère qu'il n'y a pas de retour (one-way).
  if (cutAfter < 0 || maxGap < 24 * 3600 * 1000) {
    return { outbound: sorted, inbound: [] };
  }
  return {
    outbound: sorted.slice(0, cutAfter + 1),
    inbound: sorted.slice(cutAfter + 1),
  };
}

const fmtTime = (t: string | null): string => (t ? t.slice(0, 5) : "");

const fmtDateLong = (d: string): string => {
  const date = new Date(d + "T00:00:00");
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
};

/** Génère le texte narratif d'un trajet (aller ou retour) à partir de ses segments. */
export function buildFlightNarrative(segs: FlightSegmentLite[], fallbackCompagnie: string | null): string {
  if (segs.length === 0) return "";
  const first = segs[0];
  const last = segs[segs.length - 1];
  const compagnie = airlineName(first.compagnie || fallbackCompagnie || "");
  const villeDepart = iataToCity(first.aeroport_depart);
  const villeArrivee = iataToCity(last.aeroport_arrivee);

  const parts: string[] = [];

  // Phrase d'ouverture
  if (first.date_depart && first.heure_depart) {
    parts.push(
      `Départ de ${villeDepart} le ${fmtDateLong(first.date_depart)} à ${fmtTime(first.heure_depart)}` +
        (compagnie ? ` à bord de ${compagnie}` : "") +
        (first.numero_vol ? ` (vol ${first.numero_vol})` : "") +
        ".",
    );
  } else {
    parts.push(`Départ de ${villeDepart}${compagnie ? ` à bord de ${compagnie}` : ""}.`);
  }

  // Escales
  for (let i = 0; i < segs.length - 1; i++) {
    const cur = segs[i];
    const nxt = segs[i + 1];
    const villeEscale = iataToCity(cur.aeroport_arrivee);
    let escaleDuree = "";
    if (cur.duree_escale_minutes && cur.duree_escale_minutes > 0) {
      const h = Math.floor(cur.duree_escale_minutes / 60);
      const m = cur.duree_escale_minutes % 60;
      escaleDuree = m > 0 ? ` (${h}h${String(m).padStart(2, "0")})` : ` (${h}h)`;
    }
    const heuresEscale =
      cur.heure_arrivee && nxt.heure_depart ? ` de ${fmtTime(cur.heure_arrivee)} à ${fmtTime(nxt.heure_depart)}` : "";
    parts.push(`Escale à ${villeEscale}${heuresEscale}${escaleDuree}.`);
  }

  // Détection nuit en vol
  const departDate = first.date_depart;
  const arriveeDate = last.date_arrivee;
  const isNightFlight = departDate && arriveeDate && departDate !== arriveeDate;

  if (isNightFlight) {
    parts.push(`Nuit à bord.`);
  }

  // Phrase d'arrivée
  if (arriveeDate && last.heure_arrivee) {
    parts.push(`Arrivée à ${villeArrivee} le ${fmtDateLong(arriveeDate)} à ${fmtTime(last.heure_arrivee)}.`);
  } else {
    parts.push(`Arrivée à ${villeArrivee}.`);
  }

  return parts.join(" ");
}

/** Liste de toutes les dates entre deux dates (incluses). Calcul en UTC pour éviter les décalages de fuseau. */
function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const sm = start.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const em = end.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!sm || !em) return out;
  const s = Date.UTC(+sm[1], +sm[2] - 1, +sm[3]);
  const e = Date.UTC(+em[1], +em[2] - 1, +em[3]);
  if (e < s) return out;
  for (let t = s; t <= e; t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Format un segment de vol en ligne narrative compacte (descriptif).
 * Ex: "Vol TK1368 Marseille → Istanbul de 19h00 à 23h15."
 */
function segmentSentence(seg: FlightSegmentLite, fallbackCompagnie: string | null): string {
  const compagnie = airlineName(seg.compagnie || fallbackCompagnie || "");
  const ville1 = iataToCity(seg.aeroport_depart);
  const ville2 = iataToCity(seg.aeroport_arrivee);
  const num = seg.numero_vol ? `Vol ${seg.numero_vol} ` : "";
  const heures =
    seg.heure_depart && seg.heure_arrivee
      ? ` de ${fmtTime(seg.heure_depart)} à ${fmtTime(seg.heure_arrivee)}`
      : "";
  const overnight = seg.date_depart && seg.date_arrivee && seg.date_depart !== seg.date_arrivee ? " (+1)" : "";
  const cieSuffix = compagnie && !num ? ` (${compagnie})` : "";
  return `${num}${ville1} → ${ville2}${heures}${overnight}${cieSuffix}.`;
}

/**
 * Construit le squelette de jours à partir des vols.
 *
 * Logique métier travel design premium (universelle, pas de hardcode pays) :
 * - Détection du pays d'origine (aéroport du tout 1er segment) et du pays de destination
 *   (aéroport du dernier segment aller, après vols domestiques éventuels).
 * - Jour de départ international : titre "Départ de {ville} à destination de {pays}".
 * - Jour d'arrivée internationale : fusionne les derniers vols (ex: domestique d'arrivée)
 *   et marque le début du programme terrestre — titre "Arrivée à {ville}".
 * - Jour de retour international : titre "Vol retour vers {pays_origine}".
 * - Jour d'arrivée finale : titre "Arrivée à {ville_origine}", créé même si aucun jour
 *   civil n'existe (le moteur étend automatiquement la plage).
 * - Jamais de titre "Transit" : les vols intermédiaires sont absorbés dans la nuit en vol
 *   ou dans le jour d'arrivée fusionné.
 */
export function buildItineraryFromFlights(
  vol: FlightOptionLite,
  segments: FlightSegmentLite[],
  fallbackDepart: string | null,
  fallbackRetour: string | null,
): GeneratedDay[] {
  const { outbound, inbound } = splitOutboundReturn(segments);

  const startDate = outbound[0]?.date_depart || vol.date_depart || fallbackDepart || null;
  const endDate =
    inbound[inbound.length - 1]?.date_arrivee ||
    outbound[outbound.length - 1]?.date_arrivee ||
    vol.date_retour ||
    fallbackRetour ||
    startDate;

  if (!startDate || !endDate) return [];

  const dates = daysBetween(startDate, endDate);
  if (dates.length === 0) return [];

  // Pays d'origine = pays du tout premier départ. Pays de destination = pays du
  // dernier aéroport d'arrivée du trajet aller (après éventuels vols domestiques).
  const homeIata = outbound[0]?.aeroport_depart ?? null;
  const homeCountry = homeIata ? IATA_COUNTRY[homeIata.toUpperCase()] ?? null : null;
  const villeOrigine = homeIata ? iataToCity(homeIata) : null;

  // Le pays de destination est celui du dernier segment aller qui n'est PAS encore
  // dans le pays d'origine (et qui clôture la chaîne intl).
  let destCountry: string | null = null;
  let destIata: string | null = null;
  for (let i = outbound.length - 1; i >= 0; i--) {
    const c = IATA_COUNTRY[outbound[i].aeroport_arrivee.toUpperCase()];
    if (c && c !== homeCountry) {
      destCountry = c;
      destIata = outbound[i].aeroport_arrivee;
      break;
    }
  }
  // Fallback : dernier segment aller
  if (!destIata && outbound.length > 0) {
    destIata = outbound[outbound.length - 1].aeroport_arrivee;
    destCountry = IATA_COUNTRY[destIata.toUpperCase()] ?? null;
  }
  const villeDestination = destIata ? iataToCity(destIata) : null;
  const paysDestNom = countryNameFr(destCountry) ?? villeDestination ?? "destination";
  const paysOrigineNom = countryNameFr(homeCountry) ?? villeOrigine ?? "votre ville";

  // ------- Jour de DÉPART international -------
  // = date du segment outbound qui quitte le pays d'origine pour la 1ère fois.
  let departureDate: string | null = null;
  for (const seg of outbound) {
    const cFrom = IATA_COUNTRY[seg.aeroport_depart.toUpperCase()];
    const cTo = IATA_COUNTRY[seg.aeroport_arrivee.toUpperCase()];
    if (cFrom === homeCountry && cTo !== homeCountry) {
      departureDate = seg.date_depart;
      break;
    }
  }
  if (!departureDate) departureDate = outbound[0]?.date_depart ?? startDate;

  // ------- Jour d'ARRIVÉE internationale (jour où on touche le sol final) -------
  // = date d'arrivée du DERNIER segment outbound (qui peut être un domestique d'arrivée
  //   comme CGK→YIA). Si plusieurs segments arrivent le même jour, on garde celui-là.
  const arrivalDate = outbound.length > 0
    ? outbound[outbound.length - 1].date_arrivee ?? outbound[outbound.length - 1].date_depart ?? null
    : null;
  // Heure d'arrivée finale = heure du dernier segment outbound
  const heureArriveeFinale = outbound[outbound.length - 1]?.heure_arrivee ?? null;
  // Ville d'atterrissage final = ville du dernier segment outbound
  const villeArriveeFinale = outbound.length > 0
    ? iataToCity(outbound[outbound.length - 1].aeroport_arrivee)
    : villeDestination;

  // ------- Jour de RETOUR international (départ du pays visité) -------
  let inboundDepartureDate: string | null = null;
  if (inbound.length > 0) {
    for (const seg of inbound) {
      const cFrom = IATA_COUNTRY[seg.aeroport_depart.toUpperCase()];
      if (cFrom === destCountry) {
        inboundDepartureDate = seg.date_depart;
        break;
      }
    }
    if (!inboundDepartureDate) inboundDepartureDate = inbound[0]?.date_depart ?? null;
  }

  // ------- Jour d'ARRIVÉE finale (retour au pays d'origine) -------
  let finalArrivalDate: string | null = null;
  if (inbound.length > 0) {
    for (let i = inbound.length - 1; i >= 0; i--) {
      const cTo = IATA_COUNTRY[inbound[i].aeroport_arrivee.toUpperCase()];
      if (cTo === homeCountry) {
        finalArrivalDate = inbound[i].date_arrivee ?? inbound[i].date_depart ?? null;
        break;
      }
    }
    if (!finalArrivalDate) {
      finalArrivalDate = inbound[inbound.length - 1].date_arrivee ?? null;
    }
  }

  // Étendre la plage de dates si l'arrivée finale tombe APRÈS endDate (ex: vol retour +1)
  let allDates = dates;
  if (finalArrivalDate && finalArrivalDate > allDates[allDates.length - 1]) {
    allDates = daysBetween(startDate, finalArrivalDate);
  }

  // Helpers pour groupement des segments par date
  const outboundByDate = new Map<string, FlightSegmentLite[]>();
  for (const seg of outbound) {
    const d = seg.date_depart;
    if (!d) continue;
    if (!outboundByDate.has(d)) outboundByDate.set(d, []);
    outboundByDate.get(d)!.push(seg);
  }
  const inboundByDate = new Map<string, FlightSegmentLite[]>();
  for (const seg of inbound) {
    const d = seg.date_depart;
    if (!d) continue;
    if (!inboundByDate.has(d)) inboundByDate.set(d, []);
    inboundByDate.get(d)!.push(seg);
  }
  // Segments arrivant un jour différent de leur départ (à mentionner sur le jour d'arrivée)
  const outboundArrByDate = new Map<string, FlightSegmentLite[]>();
  for (const seg of outbound) {
    const da = seg.date_arrivee;
    if (!da || da === seg.date_depart) continue;
    if (!outboundArrByDate.has(da)) outboundArrByDate.set(da, []);
    outboundArrByDate.get(da)!.push(seg);
  }

  const days: GeneratedDay[] = allDates.map((d, i) => {
    const ordre = i + 1;
    let titre = `Jour ${ordre}`;
    let description: string | null = null;
    let lieu: string | null = villeDestination;
    let isFlightDay = false;
    let type_jour: FlightDayType = "stay";

    // ===== JOUR D'ARRIVÉE FINALE =====
    if (finalArrivalDate && d === finalArrivalDate && inbound.length > 0) {
      titre = `Arrivée à ${villeOrigine ?? paysOrigineNom}`;
      lieu = villeOrigine;
      isFlightDay = true;
      type_jour = "final_arrival";
      const segs = inbound.filter(s => (s.date_arrivee ?? s.date_depart) === d);
      const lines = segs.map(s => segmentSentence(s, vol.compagnie));
      description = `Arrivée à ${villeOrigine ?? paysOrigineNom} après votre vol international.\n${lines.join("\n")}\nFin de votre voyage.`.trim();
    }
    // ===== JOUR DE RETOUR INTERNATIONAL =====
    else if (inboundDepartureDate && d === inboundDepartureDate && inbound.length > 0) {
      titre = `Vol retour vers ${paysOrigineNom}`;
      lieu = villeDestination;
      isFlightDay = true;
      type_jour = "inbound_flight";
      const segs = inboundByDate.get(d) ?? [];
      const compagnie = airlineName(segs[0]?.compagnie || vol.compagnie || "");
      const villeDep = segs[0] ? iataToCity(segs[0].aeroport_depart) : (villeDestination ?? "");
      const lines = segs.map(s => segmentSentence(s, vol.compagnie));
      const lastSeg = segs[segs.length - 1];
      const overnight = lastSeg && lastSeg.date_arrivee && lastSeg.date_depart && lastSeg.date_arrivee !== lastSeg.date_depart;
      const closing = overnight ? "\nNuit en vol." : "";
      description = `Après votre transfert vers l'aéroport de ${villeDep}, envol vers ${paysOrigineNom}${compagnie ? ` sur compagnie ${compagnie}` : ""}.\n${lines.join("\n")}${closing}`.trim();
    }
    // ===== JOUR D'ARRIVÉE À DESTINATION =====
    else if (arrivalDate && d === arrivalDate && outbound.length > 0 && d !== departureDate) {
      titre = `Arrivée à ${villeArriveeFinale ?? villeDestination ?? paysDestNom}`;
      lieu = villeArriveeFinale ?? villeDestination;
      isFlightDay = true;
      type_jour = "arrival_day";
      // Inclut tous les segments outbound qui atterrissent ce jour-là (ex: dernier intl + domestique)
      const segsArr = outboundArrByDate.get(d) ?? [];
      const segsDay = outboundByDate.get(d) ?? [];
      const allSegs = [...segsArr, ...segsDay].filter((s, idx, arr) => arr.findIndex(x => x.id === s.id) === idx)
        .sort((a, b) => (a.heure_depart ?? "").localeCompare(b.heure_depart ?? ""));
      const lines = allSegs.map(s => segmentSentence(s, vol.compagnie));
      const heure = heureArriveeFinale ? ` à ${fmtTime(heureArriveeFinale)}` : "";
      description = `Arrivée à l'aéroport de ${villeArriveeFinale ?? paysDestNom}${heure} après vos vols internationaux.\n${lines.join("\n")}\nAccueil par votre guide puis transfert vers votre hébergement.`.trim();
    }
    // ===== JOUR DE DÉPART INTERNATIONAL =====
    else if (d === departureDate && outbound.length > 0) {
      titre = `Départ de ${villeOrigine ?? paysOrigineNom} à destination de ${paysDestNom}`;
      lieu = villeOrigine;
      isFlightDay = true;
      type_jour = "departure_day";
      const segsDay = outboundByDate.get(d) ?? outbound.slice(0, 1);
      const compagnie = airlineName(segsDay[0]?.compagnie || vol.compagnie || "");
      const lines = segsDay.map(s => segmentSentence(s, vol.compagnie));
      const heureDep = segsDay[0]?.heure_depart ? fmtTime(segsDay[0].heure_depart) : null;
      const moment = heureDep
        ? (heureDep < "12:00" ? "En matinée" : heureDep < "18:00" ? "En après-midi" : "En fin de journée")
        : "";
      const opener = `${moment ? moment + ", e" : "E"}nvol depuis ${villeOrigine ?? "votre ville"} à destination de ${paysDestNom}${compagnie ? ` sur compagnie ${compagnie}` : ""}.`;
      // Nuit en vol si arrivée à destination > date de départ
      const overnight = arrivalDate && arrivalDate !== d;
      const closing = overnight ? "\nCorrespondance puis continuation. Nuit en vol." : "";
      description = `${opener}\n${lines.join("\n")}${closing}`.trim();
    }
    // ===== JOUR DE SÉJOUR (intermédiaire) =====
    else {
      // Vol domestique sur un jour de séjour : enrichit le titre sans en faire un "Transit"
      const segsDay = outboundByDate.get(d) ?? [];
      const inSegsDay = inboundByDate.get(d) ?? [];
      const allDaySegs = [...segsDay, ...inSegsDay];
      const domestic = allDaySegs.find(s => {
        const cF = IATA_COUNTRY[s.aeroport_depart.toUpperCase()];
        const cT = IATA_COUNTRY[s.aeroport_arrivee.toUpperCase()];
        return cF && cT && cF === cT && cF === destCountry;
      });
      if (domestic) {
        const villeA = iataToCity(domestic.aeroport_depart);
        const villeB = iataToCity(domestic.aeroport_arrivee);
        titre = `${villeA} → ${villeB}`;
        lieu = villeB;
        isFlightDay = true;
        type_jour = "domestic_transfer";
        description = segmentSentence(domestic, vol.compagnie);
      } else {
        titre = `Jour ${ordre} — ${villeDestination ?? "À compléter"}`;
        lieu = villeDestination;
        type_jour = "stay";
      }
    }

    return { ordre, date_jour: d, titre, lieu, description, isFlightDay, type_jour };
  });

  return days;
}

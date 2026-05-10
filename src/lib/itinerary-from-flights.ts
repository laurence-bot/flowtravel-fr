// Construction d'un squelette d'itinéraire à partir des vols (flight_segments).
// Logique : les vols définissent les bornes (J1 = date départ vol aller, dernier
// jour = date d'arrivée vol retour). Les segments aller produisent un texte type
// "Départ de Marseille à HH:MM avec X, escale à Y de … à …, arrivée à Z le lendemain".
// Si le vol arrive le lendemain, le J1 est marqué "Nuit en vol — Arrivée à destination le …".

import { iataToCity, IATA_COUNTRY, countryNameFr } from "@/lib/iata";
import { airlineName } from "@/lib/airlines";
import { analyserConnexionVol, type VolPoint } from "@/lib/flight-connections";

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
 * Construit le squelette de jours à partir des vols.
 * - J1 = date du 1er segment aller (départ).
 * - Dernier jour = date d'arrivée du dernier segment retour (ou last seg si pas de retour).
 * - Jours intermédiaires = un jour par date civile.
 * - Si vol aller arrive le lendemain → J1 contient "Nuit en vol".
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

  const villeDestination = outbound.length > 0 ? iataToCity(outbound[outbound.length - 1].aeroport_arrivee) : null;
  const villeOrigine = outbound.length > 0 ? iataToCity(outbound[0].aeroport_depart) : null;

  const outboundNarr = buildFlightNarrative(outbound, vol.compagnie);
  const inboundNarr = buildFlightNarrative(inbound, vol.compagnie);

  const arrDate = outbound[outbound.length - 1]?.date_arrivee;
  const isOvernightOutbound = !!(startDate && arrDate && startDate !== arrDate);
  const heureArriveeDest = outbound[outbound.length - 1]?.heure_arrivee ?? null;

  const inboundReturnDate = inbound[inbound.length - 1]?.date_arrivee || inbound[inbound.length - 1]?.date_depart || null;
  const villeRetour = inbound.length > 0 ? iataToCity(inbound[inbound.length - 1].aeroport_arrivee) : villeOrigine;

  // Map des dates de transit outbound (strictement entre départ et arrivée à destination)
  // → ville d'escale + détails. Une date transit appartient au segment [seg[i].date_arrivee, seg[i+1].date_depart].
  const transitInfo = new Map<string, { ville: string; heureArr: string | null; heureDep: string | null }>();
  if (isOvernightOutbound && arrDate) {
    for (const d of dates) {
      if (d <= startDate! || d >= arrDate) continue;
      // Trouver le segment dont le layover couvre cette date
      let found: { ville: string; heureArr: string | null; heureDep: string | null } | null = null;
      for (let i = 0; i < outbound.length - 1; i++) {
        const cur = outbound[i];
        const nxt = outbound[i + 1];
        if (!cur.date_arrivee || !nxt.date_depart) continue;
        if (d >= cur.date_arrivee && d <= nxt.date_depart) {
          found = {
            ville: iataToCity(cur.aeroport_arrivee),
            heureArr: cur.heure_arrivee,
            heureDep: nxt.heure_depart,
          };
          break;
        }
      }
      if (!found) {
        // Vol direct de nuit sans escale : transit "à bord"
        found = { ville: villeOrigine ?? "destination", heureArr: null, heureDep: null };
      }
      transitInfo.set(d, found);
    }
  }

  const days: GeneratedDay[] = dates.map((d, i) => {
    const isFirst = i === 0;
    const isLast = i === dates.length - 1;
    const isReturnDay = inbound.length > 0 && inboundReturnDate && d === inboundReturnDate;
    let titre = `Jour ${i + 1}`;
    let description: string | null = null;
    let lieu: string | null = null;
    let isFlightDay = false;

    if (isFirst) {
      titre = isOvernightOutbound
        ? `Départ de ${villeOrigine ?? "votre ville"} — Nuit en vol`
        : `Départ de ${villeOrigine ?? "votre ville"}`;
      description = outboundNarr || null;
      lieu = villeOrigine;
      isFlightDay = true;
    } else if (arrDate && d === arrDate && isOvernightOutbound) {
      // Jour d'arrivée à destination (vol overnight)
      titre = `Arrivée à ${villeDestination ?? "destination"}`;
      lieu = villeDestination;
      isFlightDay = true;
      const hh = heureArriveeDest ? ` à ${fmtTime(heureArriveeDest)}` : "";
      description = `Arrivée à ${villeDestination ?? "destination"} le ${fmtDateLong(arrDate)}${hh}. Début du programme réceptif.`;
    } else if (transitInfo.has(d)) {
      const t = transitInfo.get(d)!;
      titre = `Transit ${t.ville}`;
      lieu = t.ville;
      isFlightDay = true;
      const plage =
        t.heureArr && t.heureDep
          ? ` Escale de ${fmtTime(t.heureArr)} à ${fmtTime(t.heureDep)}.`
          : "";
      description = `Transit à ${t.ville} le ${fmtDateLong(d)}.${plage}`;
    } else if (isReturnDay || (isLast && inbound.length > 0)) {
      titre = `Retour à ${villeRetour ?? "votre ville"}`;
      description = inboundNarr || null;
      lieu = villeDestination;
      isFlightDay = true;
    } else {
      // Jour intermédiaire
      lieu = villeDestination;
      titre = `Jour ${i + 1} — ${villeDestination ?? "À compléter"}`;
    }

    return {
      ordre: i + 1,
      date_jour: d,
      titre,
      lieu,
      description,
      isFlightDay,
    };
  });

  // Détection automatique des transits entre segments (escales longues / nuits hors réceptif).
  // Pour chaque paire (segment N → N+1) du vol aller puis du vol retour, on calcule la
  // durée au sol et le type de connexion. Les ESCALES (<8h) ne créent pas de jour ; les
  // NUIT_ENTIERE et STOPOVER_JOUR enrichissent le jour correspondant à la date d'arrivée.
  const enrichTransit = (segs: FlightSegmentLite[]) => {
    for (let i = 0; i < segs.length - 1; i++) {
      const cur = segs[i];
      const nxt = segs[i + 1];
      if (!cur.date_arrivee || !cur.heure_arrivee || !nxt.date_depart || !nxt.heure_depart) continue;
      const a: VolPoint = {
        ville: iataToCity(cur.aeroport_arrivee),
        codeIATA: cur.aeroport_arrivee,
        dateArrivee: cur.date_arrivee,
        heureArrivee: cur.heure_arrivee.slice(0, 5),
        dateDepart: cur.date_arrivee,
        heureDepart: cur.heure_arrivee.slice(0, 5),
      };
      const b: VolPoint = {
        ...a,
        dateDepart: nxt.date_depart,
        heureDepart: nxt.heure_depart.slice(0, 5),
      };
      const conn = analyserConnexionVol(a, b);
      if (!conn.jourDedie) continue;
      const target = days.find((d) => d.date_jour === cur.date_arrivee);
      if (!target) continue;
      // Ne pas écraser un jour d'arrivée à destination déjà correctement typé
      if (target.isFlightDay && /arriv/i.test(target.titre ?? "")) continue;
      target.titre = conn.titreJour || target.titre;
      target.lieu = conn.ville;
      target.isFlightDay = true;
      const alerte = conn.alerte ? `${conn.alerte}\n\n` : "";
      target.description = `${alerte}Transit ${conn.ville} — durée ${conn.dureeHeures}h.`;
    }
  };
  enrichTransit(outbound);
  enrichTransit(inbound);

  // Enrichissement des titres avec vols domestiques (segment intra-pays sur un jour réceptif)
  const enrichVolsDomestiques = (segs: FlightSegmentLite[]) => {
    for (const seg of segs) {
      if (!seg.date_depart || !seg.numero_vol) continue;

      // Détection pays via table IATA_COUNTRY — fiable pour tous les pays
      // (l'heuristique 2-lettres échoue p.ex. pour l'Indonésie : CGK≠YIA≠DPS)
      const paysDepart = IATA_COUNTRY[seg.aeroport_depart.toUpperCase()];
      const paysArrivee = IATA_COUNTRY[seg.aeroport_arrivee.toUpperCase()];
      const isDomestic = paysDepart && paysArrivee && paysDepart === paysArrivee;
      if (!isDomestic) continue;

      const target = days.find((d) => d.date_jour === seg.date_depart);
      if (!target || target.isFlightDay) continue;

      const villeDepart = iataToCity(seg.aeroport_depart);
      const villeArrivee = iataToCity(seg.aeroport_arrivee);
      const volRef = seg.numero_vol ? ` (${seg.compagnie ?? ""}${seg.numero_vol})` : "";

      if (!target.titre.toLowerCase().includes("vol")) {
        const titreActuel = target.titre;
        if (titreActuel.toLowerCase().includes(villeDepart.toLowerCase())) {
          target.titre = titreActuel.replace(
            new RegExp(villeDepart, "i"),
            `${villeDepart} - ${villeArrivee} (vol domestique${volRef})`,
          );
        } else {
          target.titre = `${titreActuel} — Vol domestique vers ${villeArrivee}${volRef}`;
        }
      }
    }
  };
  enrichVolsDomestiques(outbound);
  enrichVolsDomestiques(inbound);

  return days;
}

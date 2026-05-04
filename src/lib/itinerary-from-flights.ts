// Construction d'un squelette d'itinéraire à partir des vols (flight_segments).
// Logique : les vols définissent les bornes (J1 = date départ vol aller, dernier
// jour = date d'arrivée vol retour). Les segments aller produisent un texte type
// "Départ de Marseille à HH:MM avec X, escale à Y de … à …, arrivée à Z le lendemain".
// Si le vol arrive le lendemain, le J1 est marqué "Nuit en vol — Arrivée à destination le …".

import { iataToCity } from "@/lib/iata";
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

export type GeneratedDay = {
  ordre: number;
  date_jour: string;
  titre: string;
  lieu: string | null;
  description: string | null;
  isFlightDay: boolean; // J1 (vol aller) ou dernier jour (vol retour)
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
export function buildFlightNarrative(
  segs: FlightSegmentLite[],
  fallbackCompagnie: string | null,
): string {
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
      cur.heure_arrivee && nxt.heure_depart
        ? ` de ${fmtTime(cur.heure_arrivee)} à ${fmtTime(nxt.heure_depart)}`
        : "";
    parts.push(`Escale à ${villeEscale}${heuresEscale}${escaleDuree}.`);
  }

  // Détection nuit en vol
  const departDate = first.date_depart;
  const arriveeDate = last.date_arrivee;
  const isNightFlight =
    departDate && arriveeDate && departDate !== arriveeDate;

  if (isNightFlight) {
    parts.push(`Nuit à bord.`);
  }

  // Phrase d'arrivée
  if (arriveeDate && last.heure_arrivee) {
    parts.push(
      `Arrivée à ${villeArrivee} le ${fmtDateLong(arriveeDate)} à ${fmtTime(last.heure_arrivee)}.`,
    );
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

  const startDate =
    outbound[0]?.date_depart || vol.date_depart || fallbackDepart || null;
  const endDate =
    inbound[inbound.length - 1]?.date_arrivee ||
    outbound[outbound.length - 1]?.date_arrivee ||
    vol.date_retour ||
    fallbackRetour ||
    startDate;

  if (!startDate || !endDate) return [];

  const dates = daysBetween(startDate, endDate);
  if (dates.length === 0) return [];

  const villeDestination =
    outbound.length > 0
      ? iataToCity(outbound[outbound.length - 1].aeroport_arrivee)
      : null;
  const villeOrigine =
    outbound.length > 0 ? iataToCity(outbound[0].aeroport_depart) : null;

  const outboundNarr = buildFlightNarrative(outbound, vol.compagnie);
  const inboundNarr = buildFlightNarrative(inbound, vol.compagnie);

  const arrDate = outbound[outbound.length - 1]?.date_arrivee;
  const isOvernightOutbound = !!(startDate && arrDate && startDate !== arrDate);

  const days: GeneratedDay[] = dates.map((d, i) => {
    const isFirst = i === 0;
    const isLast = i === dates.length - 1;
    let titre = `Jour ${i + 1}`;
    let description: string | null = null;
    let lieu: string | null = null;
    let isFlightDay = false;

    if (isFirst) {
      titre = isOvernightOutbound
        ? `Vol vers ${villeDestination ?? "votre destination"} — Nuit en vol`
        : `Envol vers ${villeDestination ?? "votre destination"}`;
      description = outboundNarr || null;
      lieu = villeOrigine;
      isFlightDay = true;
    } else if (isLast && inbound.length > 0) {
      titre = `Vol retour vers ${
        inbound[inbound.length - 1]
          ? iataToCity(inbound[inbound.length - 1].aeroport_arrivee)
          : "votre ville"
      }`;
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

  // Si le vol aller arrive le lendemain (nuit en vol), le J2 marque l'arrivée.
  if (isOvernightOutbound && days.length >= 2 && arrDate) {
    const j2 = days[1];
    if (!j2.isFlightDay) {
      j2.titre = `Arrivée à ${villeDestination ?? "destination"}`;
      j2.description =
        `Arrivée à ${villeDestination ?? "destination"} le ${fmtDateLong(arrDate)}` +
        (outbound[outbound.length - 1]?.heure_arrivee
          ? ` à ${fmtTime(outbound[outbound.length - 1].heure_arrivee)}`
          : "") +
        `.`;
    }
  }

  return days;
}

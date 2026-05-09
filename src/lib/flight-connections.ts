/**
 * flight-connections.ts
 * Extraction et normalisation des données de vol depuis un PDF importé.
 *
 * Stratégie de parsing :
 *  - On lit le texte brut extrait côté client (pdf.js ou pdfmake)
 *  - On détecte les lignes de vol via regex robuste multi-format
 *  - On calcule la date de chaque jour de l'itinéraire depuis le premier vol aller
 *
 * Formats supportés :
 *   TK  1368   Dim, 30AUG   MRS - IST   19:00 - 23:15   03:15 h
 *   GA  204    Mar, 01SEP   CGK - YIA   07:50 - 09:10   01:20 h
 *   AF  006    Lun, 15JUN   CDG - JFK   10:30 - 13:45   08:15 h
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FlightSegment {
  /** Compagnie IATA (ex: "TK", "GA", "AF") */
  airline: string;
  /** Numéro de vol (ex: "1368") */
  flightNumber: string;
  /** Date ISO 8601 — YYYY-MM-DD (ex: "2026-08-30") */
  date: string;
  /** Aéroport départ IATA (ex: "MRS") */
  origin: string;
  /** Aéroport arrivée IATA (ex: "IST") */
  destination: string;
  /** Heure départ "HH:MM" */
  departureTime: string;
  /** Heure arrivée "HH:MM" (peut être J+1, J+2…) */
  arrivalTime: string;
  /** Décalage jours arrivée (0 = même jour, 1 = lendemain…) */
  arrivalDayOffset: number;
  /** Durée brute ex: "03:15 h" */
  durationRaw: string;
}

export interface FlightGroup {
  /** Vols aller (du départ au premier aéroport de destination finale) */
  outbound: FlightSegment[];
  /** Vols retour */
  inbound: FlightSegment[];
  /** Date ISO du premier vol aller — sert d'ancre pour les jours */
  tripStartDate: string | null;
  /** Date ISO du dernier vol retour */
  tripEndDate: string | null;
}

// ---------------------------------------------------------------------------
// Constantes de parsing
// ---------------------------------------------------------------------------

/**
 * Mapping des abréviations de mois PDF → numéro de mois (1-based).
 * Couvre FR + EN pour être robuste face aux PDFs multi-langue.
 */
const MONTH_MAP: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  FEV: 2,
  MAR: 3,
  APR: 4,
  AVR: 4,
  MAY: 5,
  MAI: 5,
  JUN: 6,
  JUI: 6,
  JUL: 7,
  AUG: 8,
  AOU: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

/**
 * Regex principale de détection d'un segment de vol.
 *
 * Groupes capturés :
 *   1 → compagnie (2-3 lettres)
 *   2 → numéro de vol (chiffres)
 *   3 → jour semaine optionnel (ignoré)
 *   4 → jour du mois (1-2 chiffres)
 *   5 → mois (3 lettres)
 *   6 → aéroport départ (3 lettres)
 *   7 → aéroport arrivée (3 lettres)
 *   8 → heure départ (HH:MM)
 *   9 → heure arrivée (HH:MM)
 *  10 → décalage jours arrivée (+1, +2…) — optionnel
 *  11 → durée brute
 */
const FLIGHT_LINE_REGEX =
  /^([A-Z]{2,3})\s+(\d{1,4})\s+(?:(?:Lun|Mar|Mer|Jeu|Ven|Sam|Dim|Mon|Tue|Wed|Thu|Fri|Sat|Sun)[,.]?\s+)?(\d{1,2})(JAN|FEB|FEV|MAR|APR|AVR|MAY|MAI|JUN|JUI|JUL|AUG|AOU|SEP|OCT|NOV|DEC)\s+([A-Z]{3})\s*[-–]\s*([A-Z]{3})\s+(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})\s*(\+\d)?\s*([\d:]+\s*h)/im;

// ---------------------------------------------------------------------------
// Helpers date
// ---------------------------------------------------------------------------

/**
 * Détermine l'année du vol.
 * Si le mois est déjà passé dans l'année courante → on prend l'année suivante.
 * Évite d'assigner 2025 à un vol en août quand on est en mai 2026.
 */
function resolveYear(month: number, day: number): number {
  const now = new Date();
  const currentYear = now.getFullYear();
  const candidateDate = new Date(currentYear, month - 1, day);
  // Si la date candidate est > 6 mois dans le passé, on prend l'année suivante
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  return candidateDate < sixMonthsAgo ? currentYear + 1 : currentYear;
}

/**
 * Construit une date ISO YYYY-MM-DD depuis jour + mois string + year.
 */
function buildISODate(day: number, monthStr: string, year: number): string {
  const month = MONTH_MAP[monthStr.toUpperCase()];
  if (!month) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Ajoute N jours à une date ISO et retourne le nouveau ISO.
 */
export function addDaysToISO(isoDate: string, days: number): string {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Parser principal
// ---------------------------------------------------------------------------

/**
 * Parse le texte brut d'un PDF de billets avion et retourne les segments groupés.
 *
 * @param rawText  Texte extrait du PDF (via pdf.js getText() ou équivalent)
 * @returns        FlightGroup avec vols aller/retour et dates d'ancrage
 */
export function parseFlightPDF(rawText: string): FlightGroup {
  const segments: FlightSegment[] = [];

  // Nettoyage : uniformiser les séparateurs, supprimer les lignes vides
  const lines = rawText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Tentative de reconstruction de lignes multi-lignes :
  // certains PDF cassent une ligne de vol en 2-3 lignes.
  // On concatène les lignes consécutives courtes avec la précédente.
  const mergedLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prev = mergedLines[mergedLines.length - 1] ?? "";
    // Si la ligne précédente ressemble au début d'un segment et cette ligne
    // commence par un aéroport IATA ou une heure, on fusionne
    if (prev && /^[A-Z]{2,3}\s+\d{1,4}/.test(prev) && /^(?:[A-Z]{3}\s*[-–]|[\d]{2}:)/.test(line)) {
      mergedLines[mergedLines.length - 1] = `${prev} ${line}`;
    } else {
      mergedLines.push(line);
    }
  }

  // Extraction des segments
  let firstMonth: number | null = null;
  let firstYear: number | null = null;

  for (const line of mergedLines) {
    const match = FLIGHT_LINE_REGEX.exec(line);
    if (!match) continue;

    const [
      ,
      airline,
      flightNumber,
      dayStr,
      monthStr,
      origin,
      destination,
      departureTime,
      arrivalTime,
      dayOffsetStr,
      durationRaw,
    ] = match;

    const day = parseInt(dayStr, 10);
    const monthNum = MONTH_MAP[monthStr.toUpperCase()];
    if (!monthNum) continue;

    // On mémorise le mois du premier vol pour résoudre les années cohérentes
    if (firstMonth === null) {
      firstMonth = monthNum;
      firstYear = resolveYear(monthNum, day);
    }

    // Pour les vols suivants : si le mois est < premier mois → année suivante
    let year = firstYear!;
    if (monthNum < firstMonth) {
      year = firstYear! + 1;
    }

    const date = buildISODate(day, monthStr, year);
    const arrivalDayOffset = dayOffsetStr ? parseInt(dayOffsetStr.replace("+", ""), 10) : 0;

    segments.push({
      airline: airline.toUpperCase(),
      flightNumber,
      date,
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      departureTime,
      arrivalTime,
      arrivalDayOffset,
      durationRaw: durationRaw.trim(),
    });
  }

  return groupFlights(segments);
}

// ---------------------------------------------------------------------------
// Groupement aller / retour
// ---------------------------------------------------------------------------

/**
 * Sépare les segments en aller et retour.
 *
 * Heuristique :
 *  - On identifie l'aéroport d'origine du voyage (premier segment).
 *  - Les segments dont la destination est cet aéroport marquent le retour.
 *  - On coupe au premier vol dont la destination = aéroport d'origine.
 */
function groupFlights(segments: FlightSegment[]): FlightGroup {
  if (segments.length === 0) {
    return { outbound: [], inbound: [], tripStartDate: null, tripEndDate: null };
  }

  const homeAirport = segments[0].origin;
  let splitIndex = segments.length; // par défaut : tout en aller

  for (let i = 1; i < segments.length; i++) {
    if (segments[i].destination === homeAirport) {
      splitIndex = i + 1; // on inclut ce vol retour dans inbound
      break;
    }
  }

  // Chercher aussi depuis la fin : le dernier bloc dont l'origine ≠ homeAirport
  // et la destination = homeAirport
  let returnStart = splitIndex;
  for (let i = segments.length - 1; i >= 1; i--) {
    if (segments[i].destination === homeAirport) {
      returnStart = i;
      break;
    }
  }

  const outbound = segments.slice(0, returnStart);
  const inbound = segments.slice(returnStart);

  const tripStartDate = outbound[0]?.date ?? null;
  const lastInbound = inbound[inbound.length - 1];
  const tripEndDate = lastInbound
    ? addDaysToISO(lastInbound.date, lastInbound.arrivalDayOffset)
    : (outbound[outbound.length - 1]?.date ?? null);

  return { outbound, inbound, tripStartDate, tripEndDate };
}

// ---------------------------------------------------------------------------
// Calcul des dates de l'itinéraire
// ---------------------------------------------------------------------------

/**
 * Calcule la date de chaque jour de l'itinéraire (J1, J2, … Jn).
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  RÈGLE MÉTIER FlowTravel                                            │
 * │                                                                     │
 * │  J1  = date de DÉPART depuis l'aéroport d'origine (ex: MRS 30AUG) │
 * │        → titre attendu : "Départ France"                            │
 * │                                                                     │
 * │  J2  = date d'ARRIVÉE à la première destination (ex: YIA 01SEP)   │
 * │        = date du dernier segment aller + arrivalDayOffset du dernier│
 * │                                                                     │
 * │  J3…J(n-1) = jours sur place, calculés par +1 jour depuis J2      │
 * │                                                                     │
 * │  Jn  = date d'ARRIVÉE retour en France                             │
 * │        = date du dernier vol retour + arrivalDayOffset              │
 * │        → titre attendu : "Retour France" / "Arrivée France"        │
 * │                                                                     │
 * │  Les escales intermédiaires (IST, CGK…) ne génèrent PAS de jour.  │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Exemple concret (itinéraire 12 jours Yogyakarta/Bali) :
 *   Aller  : MRS→IST (30AUG)  IST→CGK (31AUG)  CGK→YIA (01SEP)
 *   Retour : DPS→IST (12SEP)  IST→MRS (13SEP)
 *
 *   J1  = 30 AUG  (départ MRS)
 *   J2  = 01 SEP  (arrivée YIA — dernier segment aller)
 *   J3  = 02 SEP
 *   …
 *   J11 = 11 SEP
 *   J12 = 13 SEP  (arrivée MRS — dernier segment retour + offset 0)
 *
 * Les jours J3…J11 sont distribués linéairement entre J2 et J12.
 *
 * @param flightGroup  Résultat de parseFlightPDF
 * @param totalDays    Nombre de jours dans l'itinéraire (ex: 12)
 * @returns            Tableau de dates ISO [0]=J1 … [n-1]=Jn
 */
export function computeItineraryDates(flightGroup: FlightGroup, totalDays: number): string[] {
  if (totalDays <= 0) return [];

  const { outbound, inbound, tripStartDate, tripEndDate } = flightGroup;

  // Cas dégénéré : aucun vol détecté
  if (!tripStartDate) return Array(totalDays).fill("");

  // ── J1 : date de départ (premier segment aller, date de DÉPART)
  const j1 = tripStartDate; // = outbound[0].date

  // ── J2 : arrivée à destination finale aller
  // = date du dernier segment aller + son arrivalDayOffset
  const lastOutbound = outbound[outbound.length - 1];
  const j2 = lastOutbound ? addDaysToISO(lastOutbound.date, lastOutbound.arrivalDayOffset) : addDaysToISO(j1, 1);

  // ── Jn : arrivée retour en France (peut être null si pas de vols retour)
  const jn = tripEndDate ?? null;

  // Cas minimal : 1 seul jour
  if (totalDays === 1) return [j1];

  // Cas 2 jours : départ + retour
  if (totalDays === 2) return [j1, jn ?? j2];

  // ── Cas général : totalDays >= 3
  // J1 et J2 sont fixes. Jn est fixe si on a des vols retour.
  // J3…J(n-1) sont distribués linéairement entre J2 et Jn.

  const dates: string[] = [];

  // J1 = départ
  dates.push(j1);

  // J2 = arrivée destination
  dates.push(j2);

  if (totalDays === 2) return dates;

  if (jn) {
    // Jours intermédiaires J3…J(n-1) : J2+1, J2+2, … J2+(totalDays-3)
    // totalDays=12 → i de 1 à 9 inclus → 9 jours → J3..J11
    for (let i = 1; i <= totalDays - 3; i++) {
      dates.push(addDaysToISO(j2, i));
    }
    // Jn = retour France
    dates.push(jn);
  } else {
    // Pas de vols retour détectés : continuation linéaire depuis J2
    for (let i = 1; i <= totalDays - 2; i++) {
      dates.push(addDaysToISO(j2, i));
    }
  }

  return dates;
}

/**
 * Métadonnées sur les jours "spéciaux" pour permettre à l'UI
 * de proposer des titres automatiques.
 *
 * @returns  Map : index de jour (0-based) → type de jour
 */
export type SpecialDayType = "departure" | "arrival_destination" | "return_home";

export function getSpecialDays(flightGroup: FlightGroup, totalDays: number): Map<number, SpecialDayType> {
  const map = new Map<number, SpecialDayType>();
  if (totalDays === 0) return map;

  // J1 (index 0) = départ
  map.set(0, "departure");

  if (totalDays >= 2) {
    // J2 (index 1) = arrivée à destination
    map.set(1, "arrival_destination");
  }

  // Jn (index totalDays-1) = retour maison (si vols retour détectés)
  if (flightGroup.inbound.length > 0 && totalDays >= 3) {
    map.set(totalDays - 1, "return_home");
  }

  return map;
}

// ---------------------------------------------------------------------------
// Utilitaires de formatage
// ---------------------------------------------------------------------------

/**
 * Formate une date ISO en string lisible pour l'UI.
 * Ex: "2026-09-01" → "1 sept. 2026"
 */
export function formatDateFR(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Résumé textuel d'un segment de vol pour l'affichage.
 * Ex: "TK 1368 · MRS → IST · 19:00 – 23:15"
 */
export function formatSegmentLabel(seg: FlightSegment): string {
  const offset = seg.arrivalDayOffset > 0 ? ` +${seg.arrivalDayOffset}` : "";
  return `${seg.airline} ${seg.flightNumber} · ${seg.origin} → ${seg.destination} · ${seg.departureTime} – ${seg.arrivalTime}${offset}`;
}

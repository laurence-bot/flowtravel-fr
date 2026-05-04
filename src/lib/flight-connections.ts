// Détection automatique du type de connexion entre deux vols.
// - ESCALE        : moins de 8h au sol → pas de jour dédié.
// - NUIT_ENTIERE  : arrivée après 17h LOCAL ET départ le lendemain → jour dédié + alerte hébergement.
// - STOPOVER_JOUR : arrivée tôt, plage de jour avec visite possible.
//
// ⚠️ FIX CRITIQUE FUSEAU HORAIRE :
// On parse l'heure locale directement depuis la string "HH:MM"
// sans passer par new Date() qui introduit des décalages UTC.

export type TypeConnexion = "ESCALE" | "NUIT_ENTIERE" | "STOPOVER_JOUR";

export interface VolPoint {
  ville: string;
  codeIATA: string;
  dateArrivee: string;  // YYYY-MM-DD
  heureArrivee: string; // HH:MM
  dateDepart: string;   // YYYY-MM-DD
  heureDepart: string;  // HH:MM
}

export interface ResultatConnexion {
  ville: string;
  codeIATA: string;
  type: TypeConnexion;
  dureeHeures: number;
  nuit: boolean;
  jourDedie: boolean;
  nonInclus: boolean;
  titreJour: string;
  alerte: string | null;
}

// Parse une date YYYY-MM-DD et une heure HH:MM en minutes depuis epoch
// Sans conversion UTC — on travaille toujours en heure locale des vols
function toMinutes(date: string, heure: string): number {
  const [annee, mois, jour] = date.split("-").map(Number);
  const [h, m] = heure.split(":").map(Number);
  // Nombre de jours depuis une origine arbitraire, converti en minutes
  const jours = annee * 365 * 24 * 60 + mois * 30 * 24 * 60 + jour * 24 * 60;
  return jours + h * 60 + m;
}

// Extrait l'heure locale (entier) depuis une string "HH:MM"
function heureLocale(heure: string): number {
  return parseInt(heure.split(":")[0], 10);
}

export function analyserConnexionVol(
  volArrivee: VolPoint,
  volDepart: VolPoint,
): ResultatConnexion {
  const minutesArrivee = toMinutes(volArrivee.dateArrivee, volArrivee.heureArrivee);
  const minutesDepart = toMinutes(volDepart.dateDepart, volDepart.heureDepart);
  const diffHeures = (minutesDepart - minutesArrivee) / 60;

  // Heure locale d'arrivée extraite directement de la string — pas de getUTCHours()
  const hArrivee = heureLocale(volArrivee.heureArrivee);

  // CAS 1 — Escale courte (moins de 8h au sol)
  if (diffHeures < 8) {
    return {
      ville: volArrivee.ville,
      codeIATA: volArrivee.codeIATA,
      type: "ESCALE",
      dureeHeures: Math.round(diffHeures * 10) / 10,
      nuit: false,
      jourDedie: false,
      nonInclus: false,
      titreJour: "",
      alerte: null,
    };
  }

  // CAS 2 — Nuit entière
  // Condition : arrivée à partir de 17h00 locale ET départ un jour calendaire différent
  const arriveeApres17h = hArrivee >= 17;
  const departLendemain = volDepart.dateDepart !== volArrivee.dateArrivee;

  if (arriveeApres17h && departLendemain) {
    return {
      ville: volArrivee.ville,
      codeIATA: volArrivee.codeIATA,
      type: "NUIT_ENTIERE",
      dureeHeures: Math.round(diffHeures * 10) / 10,
      nuit: true,
      jourDedie: true,
      nonInclus: true,
      titreJour: `ARRIVÉE ${volArrivee.ville.toUpperCase()} — Nuit en transit`,
      alerte: `⚠️ Nuit à ${volArrivee.ville} non incluse au réceptif — hébergement à budgéter`,
    };
  }

  // CAS 3 — Stopover de jour (arrivée avant 17h, temps libre dans la journée)
  return {
    ville: volArrivee.ville,
    codeIATA: volArrivee.codeIATA,
    type: "STOPOVER_JOUR",
    dureeHeures: Math.round(diffHeures * 10) / 10,
    nuit: diffHeures > 20,
    jourDedie: true,
    nonInclus: diffHeures > 20,
    titreJour: `STOPOVER ${volArrivee.ville.toUpperCase()} — Visites possibles`,
    alerte:
      diffHeures > 20
        ? `⚠️ Stopover avec nuit à ${volArrivee.ville} — hébergement à prévoir`
        : null,
  };
}

export function analyserTousLesVols(vols: VolPoint[]): ResultatConnexion[] {
  const out: ResultatConnexion[] = [];
  for (let i = 0; i < vols.length - 1; i++) {
    out.push(analyserConnexionVol(vols[i], vols[i + 1]));
  }
  return out;
}

export function genererJoursDedies(resultats: ResultatConnexion[]) {
  return resultats
    .filter((r) => r.jourDedie)
    .map((r) => ({
      titreJour: r.titreJour,
      alerte: r.alerte,
      nonInclus: r.nonInclus,
    }));
}

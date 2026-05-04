// Détection automatique du type de connexion entre deux vols.
// - ESCALE        : moins de 8h au sol → pas de jour dédié.
// - NUIT_ENTIERE  : arrivée tard ET départ le lendemain → jour dédié + alerte hébergement non inclus.
// - STOPOVER_JOUR : arrivée tôt, plage de jour avec visite possible (nuit hors réceptif si > 20h).

export type TypeConnexion = "ESCALE" | "NUIT_ENTIERE" | "STOPOVER_JOUR";

export interface VolPoint {
  ville: string;
  codeIATA: string;
  dateArrivee: string;   // YYYY-MM-DD
  heureArrivee: string;  // HH:MM
  dateDepart: string;    // YYYY-MM-DD
  heureDepart: string;   // HH:MM
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

export function analyserConnexionVol(volArrivee: VolPoint, volDepart: VolPoint): ResultatConnexion {
  const arrivee = new Date(`${volArrivee.dateArrivee}T${volArrivee.heureArrivee}:00`);
  const depart = new Date(`${volDepart.dateDepart}T${volDepart.heureDepart}:00`);
  const diffHeures = (depart.getTime() - arrivee.getTime()) / 3_600_000;
  const heureArrivee = arrivee.getUTCHours();

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

  const arriveeApres17h = heureArrivee >= 17;
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

  return {
    ville: volArrivee.ville,
    codeIATA: volArrivee.codeIATA,
    type: "STOPOVER_JOUR",
    dureeHeures: Math.round(diffHeures * 10) / 10,
    nuit: diffHeures > 20,
    jourDedie: true,
    nonInclus: diffHeures > 20,
    titreJour: `STOPOVER ${volArrivee.ville.toUpperCase()} — Visites possibles`,
    alerte: diffHeures > 20
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
    .map((r) => ({ titreJour: r.titreJour, alerte: r.alerte, nonInclus: r.nonInclus }));
}

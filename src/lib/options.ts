// Module options fournisseurs / vols + générateurs d'emails.

import type { DeviseCode } from "@/lib/fx";
import type { Cotation, CotationLigne } from "@/lib/cotations";
import type { Contact } from "@/hooks/use-data";

export type FournisseurOptionStatut =
  | "a_demander"
  | "demandee"
  | "option_confirmee"
  | "option_refusee"
  | "option_expiree"
  | "annulee"
  | "confirmee";

export type FournisseurOption = {
  id: string;
  user_id: string;
  cotation_id: string;
  ligne_fournisseur_id: string | null;
  fournisseur_id: string | null;
  nom_fournisseur: string;
  email_fournisseur: string | null;
  prestation: string | null;
  statut: FournisseurOptionStatut;
  deadline_option_date: string | null;
  deadline_option_time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type FlightOptionStatut = "en_option" | "confirmee" | "expiree" | "annulee";

export type FlightOption = {
  id: string;
  user_id: string;
  cotation_id: string;
  compagnie: string;
  routing: string;
  numero_vol: string | null;
  date_depart: string | null;
  heure_depart: string | null;
  date_retour: string | null;
  heure_retour: string | null;
  prix: number;
  devise: DeviseCode;
  deadline_option_date: string | null;
  deadline_option_time: string | null;
  statut: FlightOptionStatut;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const FOURN_OPTION_STATUT_LABELS: Record<FournisseurOptionStatut, string> = {
  a_demander: "À demander",
  demandee: "Option demandée",
  option_confirmee: "Option confirmée",
  option_refusee: "Option refusée",
  option_expiree: "Option expirée",
  annulee: "Annulée",
  confirmee: "Confirmée (réservée)",
};

export const FOURN_OPTION_STATUT_TONES: Record<
  FournisseurOptionStatut,
  "neutral" | "info" | "success" | "danger" | "warn" | "muted"
> = {
  a_demander: "neutral",
  demandee: "info",
  option_confirmee: "success",
  option_refusee: "danger",
  option_expiree: "warn",
  annulee: "muted",
  confirmee: "success",
};

export const FLIGHT_OPTION_STATUT_LABELS: Record<FlightOptionStatut, string> = {
  en_option: "En option",
  confirmee: "Confirmée",
  expiree: "Expirée",
  annulee: "Annulée",
};

export const FLIGHT_OPTION_STATUT_TONES: Record<
  FlightOptionStatut,
  "neutral" | "info" | "success" | "danger" | "warn" | "muted"
> = {
  en_option: "info",
  confirmee: "success",
  expiree: "warn",
  annulee: "muted",
};

/** Combine date + time en Date JS, ou null. */
export function combineDeadline(date: string | null, time: string | null): Date | null {
  if (!date) return null;
  const t = time && time.length >= 4 ? time : "23:59";
  const dt = new Date(`${date}T${t}`);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

/** Heures restantes avant la deadline (négatif si dépassé). */
export function hoursUntilDeadline(date: string | null, time: string | null): number | null {
  const dt = combineDeadline(date, time);
  if (!dt) return null;
  return (dt.getTime() - Date.now()) / 3600000;
}

export type DeadlineUrgence = "ok" | "soon" | "critical" | "expired" | "none";

export function deadlineUrgence(date: string | null, time: string | null): DeadlineUrgence {
  const h = hoursUntilDeadline(date, time);
  if (h === null) return "none";
  if (h < 0) return "expired";
  if (h < 24) return "critical";
  if (h < 72) return "soon";
  return "ok";
}

export function formatDeadline(date: string | null, time: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  const dStr = d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return time ? `${dStr} à ${time.slice(0, 5)}` : dStr;
}

export function formatTimeRemaining(date: string | null, time: string | null): string {
  const h = hoursUntilDeadline(date, time);
  if (h === null) return "—";
  if (h < 0) {
    const past = Math.abs(h);
    if (past < 24) return `dépassée de ${past.toFixed(0)} h`;
    return `dépassée de ${Math.floor(past / 24)} j`;
  }
  if (h < 1) return `< 1 h`;
  if (h < 24) return `${h.toFixed(0)} h restantes`;
  const days = Math.floor(h / 24);
  return `${days} j restant${days > 1 ? "s" : ""}`;
}

// ============================================================
// Email templates
// ============================================================

export type EmailTemplateKind =
  | "demande_option_fournisseur"
  | "confirmation_fournisseur"
  | "annulation_option_fournisseur"
  | "demande_option_vol"
  | "confirmation_vol"
  | "annulation_option_vol";

export const EMAIL_TEMPLATE_LABELS: Record<EmailTemplateKind, string> = {
  demande_option_fournisseur: "Demande d'option fournisseur",
  confirmation_fournisseur: "Confirmation fournisseur",
  annulation_option_fournisseur: "Annulation d'option fournisseur",
  demande_option_vol: "Demande d'option vol",
  confirmation_vol: "Confirmation vol",
  annulation_option_vol: "Annulation d'option vol",
};

export type EmailDraft = {
  to: string;
  subject: string;
  body: string;
};

function periodeStr(cot: Cotation): string {
  const d = cot.date_depart;
  const r = cot.date_retour;
  if (d && r) return `du ${d} au ${r}`;
  if (d) return `départ ${d}`;
  return "dates à confirmer";
}

function clientLabel(cot: Cotation, client: Contact | undefined): string {
  return client?.nom ?? "Client";
}

export function buildFournisseurOptionEmail(
  kind:
    | "demande_option_fournisseur"
    | "confirmation_fournisseur"
    | "annulation_option_fournisseur",
  opts: {
    cot: Cotation;
    client: Contact | undefined;
    option: FournisseurOption;
    ligne?: CotationLigne;
    montantEurDisplay?: string;
  },
): EmailDraft {
  const { cot, client, option, ligne } = opts;
  const dest = cot.destination ?? "destination à préciser";
  const periode = periodeStr(cot);
  const clientNom = clientLabel(cot, client);
  const prestation = option.prestation ?? ligne?.prestation ?? "Prestation";
  const deadline = formatDeadline(option.deadline_option_date, option.deadline_option_time);

  if (kind === "demande_option_fournisseur") {
    return {
      to: option.email_fournisseur ?? "",
      subject: `Demande d'option – ${clientNom} / ${dest} / ${periode}`,
      body: `Bonjour,

Nous travaillons actuellement sur un projet de voyage pour nos clients :

- Destination : ${dest}
- Dates : ${periode}
- Nombre de personnes : ${cot.nombre_pax}
- Prestation concernée : ${prestation}

Pouvez-vous, s'il vous plaît, nous confirmer la disponibilité et poser une option jusqu'au ${deadline} ?

Merci également de nous indiquer vos conditions d'annulation et de paiement.

Bien cordialement,`,
    };
  }

  if (kind === "confirmation_fournisseur") {
    const montant = opts.montantEurDisplay ?? "à confirmer";
    return {
      to: option.email_fournisseur ?? "",
      subject: `Confirmation de réservation – ${clientNom} / ${dest} / ${periode}`,
      body: `Bonjour,

Nous vous confirmons la réservation suivante :

- Client : ${clientNom}
- Destination : ${dest}
- Dates : ${periode}
- Prestation : ${prestation}
- Montant : ${montant}
- Conditions de paiement : selon vos conditions habituelles

Merci de nous confirmer la bonne prise en compte de cette réservation.

Bien cordialement,`,
    };
  }

  // annulation
  return {
    to: option.email_fournisseur ?? "",
    subject: `Annulation d'option – ${clientNom} / ${dest} / ${periode}`,
    body: `Bonjour,

Nous vous remercions pour l'option accordée.
Le projet n'étant pas confirmé à ce stade, nous vous prions d'annuler l'option suivante :

- Client : ${clientNom}
- Dates : ${periode}
- Prestation : ${prestation}

Merci pour votre retour.

Bien cordialement,`,
  };
}

export function buildFlightOptionEmail(
  kind: "demande_option_vol" | "confirmation_vol" | "annulation_option_vol",
  opts: {
    cot: Cotation;
    client: Contact | undefined;
    flight: FlightOption;
    to?: string;
  },
): EmailDraft {
  const { cot, client, flight } = opts;
  const dest = cot.destination ?? "destination à préciser";
  const clientNom = clientLabel(cot, client);
  const periode = periodeStr(cot);
  const deadline = formatDeadline(flight.deadline_option_date, flight.deadline_option_time);
  const horaires = [
    flight.date_depart && `Départ : ${flight.date_depart}${flight.heure_depart ? ` ${flight.heure_depart.slice(0, 5)}` : ""}`,
    flight.date_retour && `Retour : ${flight.date_retour}${flight.heure_retour ? ` ${flight.heure_retour.slice(0, 5)}` : ""}`,
  ]
    .filter(Boolean)
    .join("\n- ");

  const blocVol = `- Compagnie : ${flight.compagnie}
- Routing : ${flight.routing}${flight.numero_vol ? `\n- N° vol : ${flight.numero_vol}` : ""}
- ${horaires || "Horaires à confirmer"}
- Prix : ${flight.prix} ${flight.devise} (${cot.nombre_pax} pax)`;

  if (kind === "demande_option_vol") {
    return {
      to: opts.to ?? "",
      subject: `Demande d'option vol – ${clientNom} / ${dest} / ${periode}`,
      body: `Bonjour,

Pourriez-vous nous poser une option sur le vol suivant pour notre client ${clientNom} :

${blocVol}

Merci de maintenir l'option jusqu'au ${deadline}.

Bien cordialement,`,
    };
  }

  if (kind === "confirmation_vol") {
    return {
      to: opts.to ?? "",
      subject: `Confirmation vol – ${clientNom} / ${dest} / ${periode}`,
      body: `Bonjour,

Nous vous confirmons la réservation du vol suivant pour notre client ${clientNom} :

${blocVol}

Merci de nous transmettre les billets et la confirmation définitive.

Bien cordialement,`,
    };
  }

  return {
    to: opts.to ?? "",
    subject: `Annulation option vol – ${clientNom} / ${dest} / ${periode}`,
    body: `Bonjour,

Nous vous prions d'annuler l'option vol suivante, le projet n'étant pas confirmé :

${blocVol}

Merci pour votre retour.

Bien cordialement,`,
  };
}

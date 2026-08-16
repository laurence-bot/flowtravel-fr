// Module Demandes clients / Prospects
export type DemandeCanal = "email" | "telephone" | "site_web" | "whatsapp" | "recommandation" | "autre";
export type DemandeStatut = "nouvelle" | "en_cours" | "a_relancer" | "transformee_en_cotation" | "perdue";
export type Demande = {
  id: string;
  user_id: string;
  client_id: string | null;
  nom_client: string;
  email: string | null;
  telephone: string | null;
  canal: DemandeCanal;
  destination: string | null;
  date_depart_souhaitee: string | null;
  date_retour_souhaitee: string | null;
  budget: number | null;
  nombre_pax: number;
  message_client: string | null;
  statut: DemandeStatut;
  raison_perte: string | null;
  notes: string | null;
  agent_id: string | null;
  dernier_contact_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DemandeResolvedTravelDetails = {
  destination: string | null;
  dateDepart: string | null;
  dateRetour: string | null;
  dateLabel: string | null;
  budget: number | null;
  budgetLabel: string | null;
  nombrePax: number;
  nombrePaxLabel: string;
};
export const DEMANDE_STATUT_LABELS: Record<DemandeStatut, string> = {
  nouvelle: "Nouvelle",
  en_cours: "En cours",
  a_relancer: "À relancer",
  transformee_en_cotation: "Transformée",
  perdue: "Perdue",
};
export const DEMANDE_STATUT_TONES: Record<DemandeStatut, "neutral" | "info" | "warning" | "success" | "danger"> = {
  nouvelle: "neutral",
  en_cours: "info",
  a_relancer: "warning",
  transformee_en_cotation: "success",
  perdue: "danger",
};
export const DEMANDE_CANAL_LABELS: Record<DemandeCanal, string> = {
  email: "Email",
  telephone: "Téléphone",
  site_web: "Site web",
  whatsapp: "WhatsApp",
  recommandation: "Recommandation",
  autre: "Autre",
};

function normalizeDemandFieldKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseDemandMessageFields(message: string | null | undefined): Record<string, string> {
  if (!message) return {};

  const fields: Record<string, string> = {};
  const lines = message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^([^:]+)\s*:\s*(.+)$/);
    if (!match) continue;
    const [, rawKey, rawValue] = match;
    const key = normalizeDemandFieldKey(rawKey);
    const value = rawValue.trim();
    if (!key || !value) continue;
    fields[key] = value;
  }

  return fields;
}

function firstField(fields: Record<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    const value = fields[key];
    if (value) return value;
  }
  return null;
}

function parsePaxValue(rawValue: string | null, fallback: number | null | undefined): { value: number; label: string } {
  const fallbackValue = Math.max(1, fallback ?? 1);
  if (!rawValue) {
    return { value: fallbackValue, label: String(fallbackValue) };
  }

  const rangeMatch = rawValue.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    return { value: Math.max(1, max), label: `${min}-${max}` };
  }

  const numbers = rawValue.match(/\d+/g);
  if (!numbers?.length) {
    return { value: fallbackValue, label: rawValue };
  }

  const parsed = Number(numbers[numbers.length - 1]);
  const safeValue = Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
  return { value: safeValue, label: rawValue };
}

function parseBudgetValue(rawValue: string | null, fallback: number | null | undefined): { value: number | null; label: string | null } {
  if (!rawValue) {
    return {
      value: fallback ?? null,
      label: fallback ? String(fallback) : null,
    };
  }

  const normalized = rawValue.toLowerCase().replace(/\s+/g, "").replace(/€/g, "");
  const numberMatches = [...normalized.matchAll(/(\d+(?:[.,]\d+)?)(k)?/g)];

  if (!numberMatches.length) {
    return { value: fallback ?? null, label: rawValue };
  }

  const parsedNumbers = numberMatches
    .map((match) => {
      const base = Number(match[1].replace(",", "."));
      if (!Number.isFinite(base)) return null;
      return match[2] ? base * 1000 : base;
    })
    .filter((value): value is number => value !== null);

  return {
    value: parsedNumbers.length ? Math.max(...parsedNumbers) : fallback ?? null,
    label: rawValue,
  };
}

export function resolveDemandeTravelDetails(demande: Demande): DemandeResolvedTravelDetails {
  const fields = parseDemandMessageFields(demande.message_client);

  const destination =
    demande.destination ??
    firstField(fields, ["destination", "destination ou region revee", "region revee"]);

  const dateDepart = demande.date_depart_souhaitee ?? null;
  const dateRetour = demande.date_retour_souhaitee ?? null;
  const dateLabel =
    dateDepart
      ? `${dateDepart}${dateRetour ? ` → ${dateRetour}` : ""}`
      : firstField(fields, ["periode", "periode envisagee", "dates"]);

  const budgetParsed = parseBudgetValue(
    firstField(fields, ["budget", "budget par voyageur"]),
    typeof demande.budget === "number" ? demande.budget : null,
  );
  const paxParsed = parsePaxValue(
    firstField(fields, ["voyageurs", "nombre de voyageurs", "pax"]),
    demande.nombre_pax,
  );

  return {
    destination: destination?.trim() || null,
    dateDepart,
    dateRetour,
    dateLabel,
    budget: budgetParsed.value,
    budgetLabel: budgetParsed.label,
    nombrePax: paxParsed.value,
    nombrePaxLabel: paxParsed.label,
  };
}
/** Nombre de jours depuis le dernier contact (ou la création). */
export function joursDepuisContact(d: Demande): number {
  const ref = d.dernier_contact_at ?? d.created_at;
  const diff = Date.now() - new Date(ref).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
/** Une demande active sans réponse depuis X jours. */
export function isSansReponse(d: Demande, seuilJours = 5): boolean {
  if (d.statut === "transformee_en_cotation" || d.statut === "perdue") return false;
  return joursDepuisContact(d) >= seuilJours;
}

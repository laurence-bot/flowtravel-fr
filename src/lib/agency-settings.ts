// Module Paramètres agence : types, validation Zod, helpers signature email.
import { z } from "zod";

export type PaymentMethodKey = "virement" | "lien_cb" | "autre";

export type CancelationTierAgence = {
  jours_avant: number;
  /** Pénalité en pourcentage (0-100). */
  pct_penalite?: number;
  /** Pénalité forfaitaire en EUR (utilisée si pct_penalite est nul). */
  montant_eur?: number;
  /** Précision : "par personne" ou "par dossier". */
  par_personne?: boolean;
  libelle?: string;
};

export type AgencySettings = {
  id: string;
  user_id: string;
  agency_name: string | null;
  legal_name: string | null;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  siret: string | null;
  vat_number: string | null;
  primary_contact_name: string | null;
  utilise_couvertures_fx: boolean;
  // Bulletin / signature
  signature_url: string | null;
  signature_nom: string | null;
  // Paiement client
  payment_methods: PaymentMethodKey[];
  iban: string | null;
  bic: string | null;
  titulaire_compte: string | null;
  lien_paiement_cb: string | null;
  lien_paiement_cb_libelle: string | null;
  instructions_paiement_autres: string | null;
  // Échéancier client par défaut
  pct_acompte_client_1: number;
  pct_acompte_client_2: number;
  pct_solde_client: number;
  delai_acompte_2_jours: number | null;
  delai_solde_jours: number | null;
  // Conditions annulation agence
  conditions_annulation_agence: CancelationTierAgence[];
  // Mentions légales
  garant_insolvabilite: string | null;
  assureur_rc_pro: string | null;
  numero_police_rc: string | null;
  immat_atout_france: string | null;
  numero_iata: string | null;
  cgv_text: string | null;
  created_at: string;
  updated_at: string;
};

export const agencySettingsSchema = z.object({
  agency_name: z.string().trim().max(120).optional().or(z.literal("")),
  legal_name: z.string().trim().max(160).optional().or(z.literal("")),
  email: z.string().trim().email("Email invalide").max(160).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  website: z
    .string()
    .trim()
    .max(200)
    .refine((v) => !v || /^https?:\/\//i.test(v) || /^[\w.-]+\.[a-z]{2,}/i.test(v), {
      message: "URL invalide",
    })
    .optional()
    .or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  siret: z.string().trim().max(40).optional().or(z.literal("")),
  vat_number: z.string().trim().max(40).optional().or(z.literal("")),
  primary_contact_name: z.string().trim().max(120).optional().or(z.literal("")),
});

export type AgencySettingsInput = z.infer<typeof agencySettingsSchema>;

/** Construit la signature d'email à partir des paramètres agence. */
export function buildEmailSignature(a: AgencySettings | null | undefined): string {
  if (!a) return "";
  const lines = [
    a.primary_contact_name,
    a.agency_name,
    a.phone,
    a.email,
    a.website,
  ].filter((v): v is string => Boolean(v && v.trim()));
  if (lines.length === 0) return "";
  return lines.join("\n");
}

/** Ajoute la signature à un corps d'email se terminant par "Bien cordialement,". */
export function appendSignature(body: string, agency: AgencySettings | null | undefined): string {
  const sig = buildEmailSignature(agency);
  if (!sig) return body;
  return `${body}\n\n${sig}`;
}

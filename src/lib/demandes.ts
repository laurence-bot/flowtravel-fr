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

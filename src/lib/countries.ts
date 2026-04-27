// Liste des pays + zone fiscale (UE / Hors UE) pour piloter automatiquement
// l'application de la TVA sur marge sur les cotations / dossiers.

export type CountryCode = string; // libellé FR utilisé comme clé simple

/** 27 États membres de l'Union européenne (au 27/04/2026). */
export const EU_COUNTRIES: readonly string[] = [
  "Allemagne",
  "Autriche",
  "Belgique",
  "Bulgarie",
  "Chypre",
  "Croatie",
  "Danemark",
  "Espagne",
  "Estonie",
  "Finlande",
  "France",
  "Grèce",
  "Hongrie",
  "Irlande",
  "Italie",
  "Lettonie",
  "Lituanie",
  "Luxembourg",
  "Malte",
  "Pays-Bas",
  "Pologne",
  "Portugal",
  "République tchèque",
  "Roumanie",
  "Slovaquie",
  "Slovénie",
  "Suède",
];

/** Sélection ciblée de destinations hors UE fréquentes pour une agence de voyages. */
export const NON_EU_COUNTRIES: readonly string[] = [
  "Afrique du Sud",
  "Argentine",
  "Australie",
  "Brésil",
  "Cambodge",
  "Canada",
  "Chili",
  "Chine",
  "Colombie",
  "Corée du Sud",
  "Costa Rica",
  "Cuba",
  "Égypte",
  "Émirats arabes unis",
  "Équateur",
  "États-Unis",
  "Indonésie",
  "Inde",
  "Islande",
  "Israël",
  "Japon",
  "Jordanie",
  "Kenya",
  "Madagascar",
  "Maldives",
  "Maroc",
  "Maurice",
  "Mexique",
  "Namibie",
  "Norvège",
  "Nouvelle-Zélande",
  "Oman",
  "Ouzbékistan",
  "Pérou",
  "Philippines",
  "Polynésie française",
  "Royaume-Uni",
  "Sénégal",
  "Seychelles",
  "Singapour",
  "Sri Lanka",
  "Suisse",
  "Tanzanie",
  "Thaïlande",
  "Tunisie",
  "Turquie",
  "Vietnam",
];

/** Liste complète triée alphabétiquement, regroupable dans un select. */
export const ALL_COUNTRIES: readonly string[] = [
  ...EU_COUNTRIES,
  ...NON_EU_COUNTRIES,
].slice().sort((a, b) => a.localeCompare(b, "fr"));

const EU_SET = new Set(EU_COUNTRIES.map((c) => c.toLowerCase()));

/** Renvoie true si le pays donné fait partie de l'UE. */
export function isEUCountry(pays: string | null | undefined): boolean {
  if (!pays) return false;
  return EU_SET.has(pays.trim().toLowerCase());
}

/** Régime TVA suggéré en fonction du pays (UE → marge_ue, sinon hors_ue). */
export function suggestRegimeTva(
  pays: string | null | undefined,
): "marge_ue" | "hors_ue" {
  return isEUCountry(pays) ? "marge_ue" : "hors_ue";
}

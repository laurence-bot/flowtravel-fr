// Helpers pour appliquer la charte graphique d'une agence sur la page client publique.
// Les couleurs sont stockées en hex sur agency_settings, on les applique
// directement comme variables CSS sur un conteneur racine.

export type AgencyTheme = {
  agency_name: string | null;
  legal_name: string | null;
  logo_url: string | null;
  logo_dark_url: string | null;
  logo_symbol_url: string | null;
  brand_baseline: string | null;
  brand_signature_quote: string | null;
  pdf_footer_text: string | null;
  cgv_text: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  color_primary: string | null;
  color_signature: string | null;
  color_ornament: string | null;
  color_background: string | null;
  color_muted: string | null;
  color_secondary: string | null;
  font_heading: string | null;
  font_body: string | null;
};

const DEFAULTS = {
  color_primary: "#0B0B0B",
  color_signature: "#A14E2C",
  color_ornament: "#C9A96E",
  color_background: "#F5F1E8",
  color_muted: "#EAE3D6",
  color_secondary: "#6A6F4C",
  font_heading: "Cormorant Garamond",
  font_body: "Inter",
};

export function themeStyle(theme: AgencyTheme | null | undefined): React.CSSProperties {
  const t = theme ?? ({} as AgencyTheme);
  return {
    // CSS custom properties consommées dans la page publique
    ["--brand-primary" as never]: t.color_primary || DEFAULTS.color_primary,
    ["--brand-signature" as never]: t.color_signature || DEFAULTS.color_signature,
    ["--brand-ornament" as never]: t.color_ornament || DEFAULTS.color_ornament,
    ["--brand-background" as never]: t.color_background || DEFAULTS.color_background,
    ["--brand-muted" as never]: t.color_muted || DEFAULTS.color_muted,
    ["--brand-secondary" as never]: t.color_secondary || DEFAULTS.color_secondary,
    ["--brand-font-heading" as never]: `"${t.font_heading || DEFAULTS.font_heading}", serif`,
    ["--brand-font-body" as never]: `"${t.font_body || DEFAULTS.font_body}", sans-serif`,
  } as React.CSSProperties;
}

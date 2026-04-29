// Types et utilitaires pour le devis web public (page client immersive).

export type QuotePublicLink = {
  id: string;
  user_id: string;
  cotation_id: string;
  token: string;
  expires_at: string;
  viewed_at: string | null;
  accepted_at: string | null;
  callback_requested_at: string | null;
  modification_requested_at: string | null;
  modification_request_text: string | null;
  created_at: string;
  updated_at: string;
};

export type CotationJour = {
  id: string;
  user_id: string;
  cotation_id: string;
  ordre: number;
  titre: string;
  description: string | null;
  lieu: string | null;
  date_jour: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

/** Génère un token URL-safe de 32 octets (≈ 43 caractères base64url). */
export function generatePublicToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

import { z } from "zod";

// Domaines email personnels interdits (élargir si besoin)
export const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.fr",
  "ymail.com",
  "rocketmail.com",
  "hotmail.com",
  "hotmail.fr",
  "outlook.com",
  "outlook.fr",
  "live.com",
  "live.fr",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "free.fr",
  "orange.fr",
  "wanadoo.fr",
  "laposte.net",
  "sfr.fr",
  "bbox.fr",
  "neuf.fr",
  "numericable.fr",
  "proton.me",
  "protonmail.com",
  "tutanota.com",
  "gmx.com",
  "gmx.fr",
  "mail.com",
  "yandex.com",
  "zoho.com",
]);

export function extractEmailDomain(email: string): string {
  return email.trim().toLowerCase().split("@")[1] ?? "";
}

export function isProEmail(email: string): boolean {
  const domain = extractEmailDomain(email);
  if (!domain) return false;
  return !PERSONAL_EMAIL_DOMAINS.has(domain);
}

export const demoRequestSchema = z.object({
  prenom: z.string().trim().min(2, "Prénom requis").max(80),
  nom: z.string().trim().min(2, "Nom requis").max(80),
  email: z
    .string()
    .trim()
    .email("Email invalide")
    .max(160)
    .refine(isProEmail, {
      message:
        "Merci d'utiliser une adresse email professionnelle (les adresses gmail, yahoo, hotmail, etc. ne sont pas acceptées).",
    }),
  telephone: z.string().trim().min(8, "Téléphone requis").max(30),
  agence_nom: z.string().trim().min(2, "Nom de l'agence requis").max(160),
  agence_siret: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal("")),
  agence_site_web: z
    .string()
    .trim()
    .max(200)
    .optional()
    .or(z.literal("")),
  agence_taille: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().max(800).optional().or(z.literal("")),
  cgu_accepted: z
    .boolean()
    .refine((v) => v === true, "Vous devez accepter les conditions d'usage de la démo."),
});

export type DemoRequestInput = z.infer<typeof demoRequestSchema>;

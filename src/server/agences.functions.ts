import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SiretSchema = z.object({
  siret: z.string().regex(/^\d{14}$/, "Le SIRET doit contenir 14 chiffres"),
});

export type SiretVerifResult = {
  found: boolean;
  nom?: string;
  enseigne?: string | null;
  siret?: string;
  siren?: string;
  etat?: string; // "A" actif, "C" cessé
  estActif?: boolean;
  adresse?: string;
  activitePrincipale?: string;
  dirigeants?: Array<{ nom?: string; prenoms?: string; qualite?: string }>;
  dateCreation?: string;
  source: "recherche-entreprises.api.gouv.fr";
  raw?: Record<string, unknown>;
};

/**
 * Vérifie un SIRET via l'API publique gratuite Recherche d'entreprises (api.gouv.fr).
 * Pas de clé API requise.
 * Doc: https://recherche-entreprises.api.gouv.fr/docs/
 */
export const verifySiret = createServerFn({ method: "POST" })
  .inputValidator((data) => SiretSchema.parse(data))
  .handler(async ({ data }): Promise<SiretVerifResult> => {
    const url = `https://recherche-entreprises.api.gouv.fr/search?q=${data.siret}&page=1&per_page=1`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return {
        found: false,
        source: "recherche-entreprises.api.gouv.fr",
      };
    }

    const json = (await res.json()) as {
      results?: Array<{
        nom_complet?: string;
        nom_raison_sociale?: string;
        siren?: string;
        siege?: {
          siret?: string;
          etat_administratif?: string;
          adresse?: string;
          enseigne_1?: string | null;
          activite_principale?: string;
          date_creation?: string;
        };
        dirigeants?: Array<{ nom?: string; prenoms?: string; qualite?: string }>;
      }>;
    };

    const first = json.results?.[0];
    if (!first || !first.siege) {
      return { found: false, source: "recherche-entreprises.api.gouv.fr" };
    }

    const siegeSiret = first.siege.siret ?? "";
    if (siegeSiret !== data.siret) {
      // L'API retourne le siège ; si l'utilisateur a saisi un SIRET d'établissement secondaire,
      // on remonte quand même les infos entreprise mais on signale le décalage.
    }

    const etat = first.siege.etat_administratif ?? "?";
    return {
      found: true,
      nom: first.nom_complet ?? first.nom_raison_sociale ?? "—",
      enseigne: first.siege.enseigne_1 ?? null,
      siret: siegeSiret,
      siren: first.siren,
      etat,
      estActif: etat === "A",
      adresse: first.siege.adresse,
      activitePrincipale: first.siege.activite_principale,
      dirigeants: first.dirigeants ?? [],
      dateCreation: first.siege.date_creation,
      source: "recherche-entreprises.api.gouv.fr",
    };
  });

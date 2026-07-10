import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Génère un texte court, élégant et "premium" pour décrire une journée d'itinéraire,
 * dans le ton de marque La Voyagerie. 3 à 5 lignes.
 */
export const generateDayText = createServerFn({ method: "POST" })
  .inputValidator((d: {
    titre?: string | null;
    lieu?: string | null;
    destination?: string | null;
    typeVoyage?: string | null;
    hebergement?: string | null;
    activites?: string | null;
    ambiance?: string | null;
  }) =>
    z.object({
      titre: z.string().max(200).nullish(),
      lieu: z.string().max(200).nullish(),
      destination: z.string().max(200).nullish(),
      typeVoyage: z.string().max(200).nullish(),
      hebergement: z.string().max(500).nullish(),
      activites: z.string().max(1000).nullish(),
      ambiance: z.string().max(500).nullish(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return { ok: false as const, error: "Lovable AI non configuré." };
    }

    const facts = [
      data.titre && `Titre du jour : ${data.titre}`,
      data.lieu && `Lieu principal : ${data.lieu}`,
      data.destination && `Destination du voyage : ${data.destination}`,
      data.typeVoyage && `Type de voyage : ${data.typeVoyage}`,
      data.hebergement && `Hébergement : ${data.hebergement}`,
      data.activites && `Activités prévues : ${data.activites}`,
      data.ambiance && `Ambiance recherchée : ${data.ambiance}`,
    ].filter(Boolean).join("\n");

    const systemPrompt = `Tu rédiges des descriptions de journée d'itinéraire pour une agence de voyages haut de gamme : La Voyagerie.

Ton de marque :
- premium, immersif, naturel, sensoriel
- évite le marketing creux ("expérience inoubliable", "voyage de rêve", "magique")
- privilégie les images concrètes (lumières, parfums, matières, paysages, gestes)
- adresse-toi au voyageur en "vous"
- pas de superlatifs, pas d'exclamations, pas d'émojis

Format STRICT :
- 3 à 5 phrases maximum
- entre 50 et 90 mots
- un seul paragraphe, pas de titre, pas de listes
- français impeccable
- ne jamais inventer un hébergement ou une activité non mentionnés
- si peu d'info, reste évocateur sur le lieu et la destination`;

    const userPrompt = `Rédige le texte de cette journée :\n\n${facts || "(peu d'informations fournies, reste évocateur)"}`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (res.status === 429) {
        return { ok: false as const, error: "Trop de requêtes, réessayez dans un instant." };
      }
      if (res.status === 402) {
        return { ok: false as const, error: "Crédits IA épuisés. Ajoutez des crédits dans Settings → Workspace → Usage." };
      }
      if (!res.ok) {
        const t = await res.text();
        console.error("Lovable AI error", res.status, t);
        return { ok: false as const, error: `Erreur IA (${res.status}).` };
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = json.choices?.[0]?.message?.content?.trim();
      if (!text) {
        return { ok: false as const, error: "Réponse IA vide." };
      }
      return { ok: true as const, text };
    } catch (e) {
      console.error("generateDayText error", e);
      return { ok: false as const, error: "Erreur réseau IA." };
    }
  });

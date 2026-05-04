import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Génère une phrase d'accroche pour l'introduction narrative d'une cotation,
 * à partir du programme jour par jour rédigé par l'agent.
 * Ton La Voyagerie : premium, sensoriel, sobre.
 */
export const generateQuoteIntro = createServerFn({ method: "POST" })
  .inputValidator((d: {
    titre?: string | null;
    destination?: string | null;
    paysDestination?: string | null;
    typeVoyage?: string | null;
    nombrePax?: number | null;
    dateDepart?: string | null;
    dateRetour?: string | null;
    jours?: Array<{
      ordre?: number | null;
      titre?: string | null;
      lieu?: string | null;
      description?: string | null;
    }> | null;
  }) =>
    z.object({
      titre: z.string().max(300).nullish(),
      destination: z.string().max(200).nullish(),
      paysDestination: z.string().max(200).nullish(),
      typeVoyage: z.string().max(200).nullish(),
      nombrePax: z.number().int().nullish(),
      dateDepart: z.string().max(50).nullish(),
      dateRetour: z.string().max(50).nullish(),
      jours: z.array(z.object({
        ordre: z.number().nullish(),
        titre: z.string().max(300).nullish(),
        lieu: z.string().max(200).nullish(),
        description: z.string().max(4000).nullish(),
      })).max(60).nullish(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false as const, error: "Lovable AI non configuré." };

    const programme = (data.jours ?? [])
      .slice()
      .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
      .map((j) => {
        const head = `J${j.ordre ?? "?"}${j.titre ? ` — ${j.titre}` : ""}${j.lieu ? ` (${j.lieu})` : ""}`;
        return j.description ? `${head}\n${j.description}` : head;
      })
      .join("\n\n");

    const facts = [
      data.titre && `Voyage : ${data.titre}`,
      data.destination && `Destination : ${data.destination}`,
      data.paysDestination && `Pays : ${data.paysDestination}`,
      data.typeVoyage && `Type : ${data.typeVoyage}`,
      data.nombrePax && `Voyageurs : ${data.nombrePax}`,
      data.dateDepart && `Départ : ${data.dateDepart}`,
      data.dateRetour && `Retour : ${data.dateRetour}`,
    ].filter(Boolean).join("\n");

    const systemPrompt = `Tu rédiges l'introduction narrative d'un devis de voyage haut de gamme pour l'agence La Voyagerie.

Ton de marque :
- premium, immersif, sensoriel, naturel
- évite tout marketing creux ("expérience inoubliable", "voyage de rêve", "magique", "sur-mesure")
- privilégie les images concrètes (lumières, paysages, parfums, gestes, matières) issues du programme réel
- adresse-toi au voyageur en "vous"
- pas de superlatifs, pas d'exclamations, pas d'émojis, pas de titre

Format STRICT :
- 2 à 3 phrases, un seul paragraphe
- entre 35 et 70 mots
- doit refléter le programme réel (lieux, ambiance) sans inventer hébergement ou activité non mentionnés
- français impeccable, ton chaleureux mais sobre`;

    const userPrompt = `Voici le contexte du voyage :
${facts || "(peu d'informations)"}

Programme jour par jour rédigé par l'agent :
${programme || "(pas encore détaillé)"}

Rédige l'introduction narrative qui ouvrira le devis.`;

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

      if (res.status === 429) return { ok: false as const, error: "Trop de requêtes, réessayez dans un instant." };
      if (res.status === 402) return { ok: false as const, error: "Crédits IA épuisés." };
      if (!res.ok) {
        const t = await res.text();
        console.error("Lovable AI error", res.status, t);
        return { ok: false as const, error: `Erreur IA (${res.status}).` };
      }

      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = json.choices?.[0]?.message?.content?.trim();
      if (!text) return { ok: false as const, error: "Réponse IA vide." };
      return { ok: true as const, text };
    } catch (e) {
      console.error("generateQuoteIntro error", e);
      return { ok: false as const, error: "Erreur réseau IA." };
    }
  });

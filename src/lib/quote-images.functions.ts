import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const searchUnsplash = createServerFn({ method: "POST" })
  .inputValidator((d: { query: string; page?: number; color?: string }) =>
    z.object({
      query: z.string().min(1).max(200),
      page: z.number().int().min(1).max(20).optional(),
      color: z.string().max(40).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env.UNSPLASH_ACCESS_KEY;
    if (!key) return { ok: false as const, error: "Clé Unsplash non configurée." };

    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", data.query);
    url.searchParams.set("page", String(data.page ?? 1));
    url.searchParams.set("per_page", "12");
    url.searchParams.set("orientation", "landscape");
    url.searchParams.set("content_filter", "high");
    url.searchParams.set("order_by", "relevant");
    if (data.color) url.searchParams.set("color", data.color);

    try {
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
      });
      if (!res.ok) return { ok: false as const, error: `Unsplash ${res.status}` };

      const json = (await res.json()) as {
        results: Array<{
          id: string;
          urls: { regular: string; small: string; full: string };
          alt_description: string | null;
          user: { name: string; links: { html: string } };
          links: { html: string };
        }>;
        total_pages: number;
      };
      return {
        ok: true as const,
        results: json.results
          .filter((r) => r.alt_description && r.alt_description.length > 5)
          .map((r) => ({
            id: r.id,
            url: r.urls.regular,
            thumb: r.urls.small,
            full: r.urls.full,
            alt: r.alt_description ?? "",
            author: r.user.name,
            authorUrl: r.user.links.html,
            photoUrl: r.links.html,
          })),
        totalPages: json.total_pages,
      };
    } catch (e) {
      return { ok: false as const, error: "Erreur réseau Unsplash." };
    }
  });

export const generateAiImage = createServerFn({ method: "POST" })
  .inputValidator((d: { prompt: string }) =>
    z.object({ prompt: z.string().min(3).max(1000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false as const, error: "Lovable AI non configuré." };

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-image-preview",
          messages: [{
            role: "user",
            content: `Photographie réaliste, qualité éditoriale, format paysage 16:9, lumineux et inspirant : ${data.prompt}`,
          }],
          modalities: ["image", "text"],
        }),
      });
      if (!res.ok) {
        if (res.status === 429) return { ok: false as const, error: "Trop de requêtes." };
        if (res.status === 402) return { ok: false as const, error: "Crédits IA épuisés." };
        return { ok: false as const, error: `Erreur IA (${res.status}).` };
      }
      const json = await res.json() as {
        choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>;
      };
      const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!url) return { ok: false as const, error: "Aucune image renvoyée." };
      return { ok: true as const, dataUrl: url };
    } catch (e) {
      return { ok: false as const, error: "Erreur réseau IA." };
    }
  });

// ─────────────────────────────────────────────────────────
// Extraction des lieux depuis titre + description
// Gère les formats "LIEU1 - LIEU2 - LIEU3" et texte libre
// ─────────────────────────────────────────────────────────
function extractLieux(params: {
  titre: string | null;
  lieu: string | null;
  description: string | null;
  destination: string | null;
}): string[] {
  const { titre, lieu, description, destination } = params;
  const lieux: string[] = [];

  if (lieu?.trim()) lieux.push(lieu.trim());

  const titreCleaned = (titre ?? "")
    .replace(/^jour\s*\d+\s*[—\-–]\s*/i, "")
    .replace(/^(vol\s+(aller|retour|vers)|arrivée\s+[àa]|envol\s+vers|nuit\s+en\s+vol)[^A-Z]*/i, "")
    .trim();

  const titreSegments = titreCleaned
    .split(/\s+[-–—]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2 && s.length < 50)
    .filter((s) => !/^(jour|day|nuit|transit|transfert|arrivée|départ|vol)$/i.test(s));

  lieux.push(...titreSegments);

  if (description) {
    const locationPatterns = [
      /\b(?:temple|site|forêt|parc|village|lac|montagne|rizières?|cascade|baie|plage)\s+(?:de\s+|du\s+|d[e'])?([A-Z][a-zÀ-ÿ]+(?:\s+[A-Z][a-zÀ-ÿ]+)*)/g,
      /\b(?:à|de|au|en|vers|depuis)\s+([A-Z][a-zÀ-ÿ]{2,}(?:\s+[A-Z][a-zÀ-ÿ]+)*)/g,
    ];
    for (const pattern of locationPatterns) {
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(description)) !== null) {
        const loc = m[1].trim();
        if (loc.length > 2 && loc.length < 40 && !lieux.includes(loc)) {
          lieux.push(loc);
        }
      }
    }
  }

  if (destination?.trim() && lieux.length === 0) {
    lieux.push(destination.trim());
  }

  return [...new Set(lieux)].slice(0, 4);
}

function buildUnsplashQueries(lieux: string[], destination: string | null): string[] {
  const queries: string[] = [];

  if (lieux.length === 0) {
    queries.push(`${destination ?? "travel"} landscape photography`);
    return queries;
  }

  if (lieux[0]) queries.push(lieux[0]);

  if (lieux[0] && destination && !lieux[0].toLowerCase().includes(destination.toLowerCase())) {
    const dest = destination.split(/[,\s-]/)[0].trim();
    queries.push(`${lieux[0]} ${dest}`);
  }

  if (lieux[1]) queries.push(lieux[1]);

  if (destination) {
    const dest = destination.split(/[,\s-]/)[0].trim();
    queries.push(`${dest} travel landscape`);
  }

  return [...new Set(queries)].filter(Boolean);
}

async function searchGoogleImages(
  query: string,
): Promise<Array<{ url: string; credit: string; displayLink: string }>> {
  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_KEY;
  const cx = process.env.GOOGLE_CUSTOM_SEARCH_CX;
  if (!apiKey || !cx) return [];

  try {
    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("cx", cx);
    url.searchParams.set("q", `${query} travel photography`);
    url.searchParams.set("searchType", "image");
    url.searchParams.set("imgType", "photo");
    url.searchParams.set("imgSize", "large");
    url.searchParams.set("num", "5");
    url.searchParams.set("safe", "active");
    url.searchParams.set("imgColorType", "color");
    url.searchParams.set("rights", "cc_publicdomain|cc_attribute|cc_sharealike");

    const res = await fetch(url.toString());
    if (!res.ok) return [];

    const json = (await res.json()) as {
      items?: Array<{
        link: string;
        displayLink: string;
        image?: { width: number; height: number };
      }>;
    };

    return (json.items ?? [])
      .filter((item) => !item.image || item.image.width > item.image.height)
      .map((item) => ({
        url: item.link,
        credit: `Photo : ${item.displayLink}`,
        displayLink: item.displayLink,
      }));
  } catch {
    return [];
  }
}

/**
 * Vérifie via Gemini vision que la photo correspond bien au lieu/contexte demandé.
 */
async function verifyPhotoRelevance(params: {
  photoUrl: string;
  lieu: string;
  titre: string;
  destination: string | null;
}): Promise<{ relevant: boolean; score: number; reason: string }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { relevant: true, score: 5, reason: "Vérification non disponible" };

  const { photoUrl, lieu, titre, destination } = params;

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
          {
            role: "system",
            content: `Tu es un expert en photographie de voyage. Tu évalues si une photo correspond bien à un lieu ou contexte de voyage donné.
Réponds UNIQUEMENT en JSON valide sans markdown :
{
  "score": <0-10>,
  "relevant": <true|false>,
  "reason": "<explication courte en français>"
}
Score 8-10 = photo parfaitement pertinente (le bon lieu, bonne ambiance, haute qualité)
Score 5-7 = acceptable mais imprécise (région correcte mais pas exactement le lieu)
Score 0-4 = non pertinente (mauvais lieu, mauvaise ambiance, photo générique)
relevant = true si score >= 6`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Évalue si cette photo correspond à : "${titre}"${lieu ? ` (lieu: ${lieu})` : ""}${destination ? ` — destination: ${destination}` : ""}.
Est-ce que la photo montre bien ce lieu ou cette ambiance de voyage ?`,
              },
              {
                type: "image_url",
                image_url: { url: photoUrl },
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) return { relevant: true, score: 5, reason: "Erreur vérification" };

    const json = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";

    const clean = content.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) return { relevant: true, score: 5, reason: "Parse error" };

    const result = JSON.parse(match[0]) as {
      score?: number;
      relevant?: boolean;
      reason?: string;
    };

    const score = Number(result.score ?? 5);
    return {
      score,
      relevant: result.relevant !== false && score >= 6,
      reason: result.reason ?? "",
    };
  } catch (e) {
    console.error("[verifyPhotoRelevance] error:", e);
    return { relevant: true, score: 5, reason: "Erreur de vérification" };
  }
}

async function searchUnsplashSingle(
  query: string,
  key: string,
  excludeIds: Set<string> = new Set(),
  verificationContext?: { titre: string; lieu: string; destination: string | null },
): Promise<{
  id: string; url: string; full: string; thumb: string;
  alt: string; author: string; credit: string;
  relevanceScore?: number;
} | null> {
  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("page", "1");
  url.searchParams.set("per_page", "8");
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("content_filter", "high");
  url.searchParams.set("order_by", "relevant");

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      results: Array<{
        id: string; width: number; height: number; likes: number;
        urls: { regular: string; small: string; full: string };
        alt_description: string | null;
        user: { name: string };
      }>;
    };

    if (!json.results?.length) return null;

    const candidates = json.results
      .filter((r) => r.width > r.height)
      .filter((r) => !excludeIds.has(r.id))
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 3);

    if (candidates.length === 0) return null;

    if (!verificationContext) {
      const best = candidates[0];
      return {
        id: best.id,
        url: best.urls.regular,
        full: best.urls.full,
        thumb: best.urls.small,
        alt: best.alt_description ?? "",
        author: best.user.name,
        credit: `Photo : ${best.user.name} / Unsplash`,
      };
    }

    let bestPhoto: {
      id: string; url: string; full: string; thumb: string;
      alt: string; author: string; credit: string; relevanceScore: number;
    } | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const verification = await verifyPhotoRelevance({
        photoUrl: candidate.urls.regular,
        lieu: verificationContext.lieu,
        titre: verificationContext.titre,
        destination: verificationContext.destination,
      });

      console.log(
        `[verify] "${candidate.alt_description}" → score ${verification.score} — ${verification.reason}`,
      );

      if (verification.score > bestScore) {
        bestScore = verification.score;
        bestPhoto = {
          id: candidate.id,
          url: candidate.urls.regular,
          full: candidate.urls.full,
          thumb: candidate.urls.small,
          alt: candidate.alt_description ?? "",
          author: candidate.user.name,
          credit: `Photo : ${candidate.user.name} / Unsplash`,
          relevanceScore: verification.score,
        };
      }

      if (verification.score >= 9) break;
    }

    if (bestPhoto && bestScore >= 6) return bestPhoto;

    console.log(`[verify] Aucune photo pertinente pour query "${query}" (meilleur score: ${bestScore})`);
    return null;
  } catch {
    return null;
  }
}

export const suggestDayPhoto = createServerFn({ method: "POST" })
  .inputValidator((d: {
    titre: string;
    lieu?: string | null;
    description?: string | null;
    destination?: string | null;
    excludeIds?: string[];
  }) =>
    z.object({
      titre: z.string().min(1).max(300),
      lieu: z.string().max(100).nullable().optional(),
      description: z.string().max(2000).nullable().optional(),
      destination: z.string().max(100).nullable().optional(),
      excludeIds: z.array(z.string()).max(50).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    const excludeIds = new Set(data.excludeIds ?? []);

    const lieux = extractLieux({
      titre: data.titre,
      lieu: data.lieu ?? null,
      description: data.description ?? null,
      destination: data.destination ?? null,
    });

    console.log("[suggestDayPhoto] lieux extraits:", lieux);

    const queries = buildUnsplashQueries(lieux, data.destination ?? null);

    console.log("[suggestDayPhoto] queries Unsplash:", queries);

    const verificationContext = {
      titre: data.titre,
      lieu: lieux[0] ?? data.lieu ?? "",
      destination: data.destination ?? null,
    };

    if (unsplashKey) {
      for (const query of queries) {
        const photo = await searchUnsplashSingle(query, unsplashKey, excludeIds, verificationContext);
        if (photo) {
          console.log(`[suggestDayPhoto] photo acceptée (score ${photo.relevanceScore}) avec query: "${query}"`);
          return { ok: true as const, photo, source: "unsplash" as const };
        }
      }
    }

    console.log("[suggestDayPhoto] Unsplash sans résultat, tentative Google...");
    const fallbackQuery = lieux[0] ?? data.destination ?? data.titre;
    const googleCandidates = await searchGoogleImages(fallbackQuery);

    if (googleCandidates.length > 0) {
      let bestGooglePhoto: {
        url: string; credit: string; displayLink: string; score: number; reason: string;
      } | null = null;
      let bestGoogleScore = 0;

      for (const candidate of googleCandidates.slice(0, 3)) {
        try {
          const headRes = await fetch(candidate.url, { method: "HEAD" });
          if (!headRes.ok) continue;
          const contentType = headRes.headers.get("content-type") ?? "";
          if (!contentType.startsWith("image/")) continue;
        } catch {
          continue;
        }

        const verification = await verifyPhotoRelevance({
          photoUrl: candidate.url,
          lieu: verificationContext.lieu,
          titre: verificationContext.titre,
          destination: verificationContext.destination,
        });

        console.log(
          `[verify-google] "${candidate.displayLink}" → score ${verification.score} — ${verification.reason}`,
        );

        if (verification.score > bestGoogleScore) {
          bestGoogleScore = verification.score;
          bestGooglePhoto = {
            ...candidate,
            score: verification.score,
            reason: verification.reason,
          };
        }

        if (verification.score >= 9) break;
      }

      if (bestGooglePhoto && bestGoogleScore >= 5) {
        console.log(
          `[suggestDayPhoto] Google accepté (score ${bestGoogleScore}): ${bestGooglePhoto.displayLink}`,
        );
        return {
          ok: true as const,
          photo: {
            id: `google-${Date.now()}`,
            url: bestGooglePhoto.url,
            full: bestGooglePhoto.url,
            thumb: bestGooglePhoto.url,
            alt: fallbackQuery,
            author: bestGooglePhoto.credit,
            credit: bestGooglePhoto.credit,
            relevanceScore: bestGoogleScore,
          },
          source: "google" as const,
        };
      }

      console.log(`[suggestDayPhoto] Google : aucune photo pertinente (meilleur score: ${bestGoogleScore})`);
    }

    return {
      ok: false as const,
      error: `Aucune photo pertinente trouvée pour "${lieux[0] ?? data.titre}". Essayez l'onglet Unsplash pour une recherche manuelle.`,
    };
  });

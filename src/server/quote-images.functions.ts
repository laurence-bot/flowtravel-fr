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
): Promise<{ url: string; credit: string } | null> {
  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_KEY;
  const cx = process.env.GOOGLE_CUSTOM_SEARCH_CX;
  if (!apiKey || !cx) return null;

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
    if (!res.ok) return null;

    const json = (await res.json()) as {
      items?: Array<{
        link: string;
        displayLink: string;
        image?: { width: number; height: number };
      }>;
    };

    const best = json.items?.find(
      (item) => !item.image || (item.image.width > item.image.height),
    );

    if (!best?.link) return null;
    return {
      url: best.link,
      credit: `Photo : ${best.displayLink}`,
    };
  } catch {
    return null;
  }
}

async function searchUnsplashSingle(
  query: string,
  key: string,
  excludeIds: Set<string> = new Set(),
): Promise<{
  id: string; url: string; full: string; thumb: string;
  alt: string; author: string; credit: string;
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

    const scored = json.results
      .filter((r) => r.width > r.height)
      .filter((r) => !excludeIds.has(r.id))
      .map((r) => ({
        ...r,
        score: r.likes * 1.5 + (r.alt_description ? 10 : 0),
      }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0] ?? json.results[0];
    if (!best) return null;

    return {
      id: best.id,
      url: best.urls.regular,
      full: best.urls.full,
      thumb: best.urls.small,
      alt: best.alt_description ?? "",
      author: best.user.name,
      credit: `Photo : ${best.user.name} / Unsplash`,
    };
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
  }) =>
    z.object({
      titre: z.string().min(1).max(300),
      lieu: z.string().max(100).nullable().optional(),
      description: z.string().max(2000).nullable().optional(),
      destination: z.string().max(100).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;

    const lieux = extractLieux({
      titre: data.titre,
      lieu: data.lieu ?? null,
      description: data.description ?? null,
      destination: data.destination ?? null,
    });

    console.log("[suggestDayPhoto] lieux extraits:", lieux);

    const queries = buildUnsplashQueries(lieux, data.destination ?? null);

    console.log("[suggestDayPhoto] queries Unsplash:", queries);

    if (unsplashKey) {
      for (const query of queries) {
        const photo = await searchUnsplashSingle(query, unsplashKey);
        if (photo) {
          console.log(`[suggestDayPhoto] Unsplash trouvé avec query: "${query}"`);
          return { ok: true as const, photo, source: "unsplash" as const };
        }
      }
    }

    console.log("[suggestDayPhoto] Unsplash sans résultat, tentative Google...");
    const fallbackQuery = lieux[0] ?? data.destination ?? data.titre;
    const googlePhoto = await searchGoogleImages(fallbackQuery);

    if (googlePhoto) {
      return {
        ok: true as const,
        photo: {
          id: `google-${Date.now()}`,
          url: googlePhoto.url,
          full: googlePhoto.url,
          thumb: googlePhoto.url,
          alt: fallbackQuery,
          author: googlePhoto.credit,
          credit: googlePhoto.credit,
        },
        source: "google" as const,
      };
    }

    return {
      ok: false as const,
      error: `Aucune photo trouvée pour "${lieux[0] ?? data.titre}". Essayez l'onglet Unsplash pour une recherche manuelle.`,
    };
  });

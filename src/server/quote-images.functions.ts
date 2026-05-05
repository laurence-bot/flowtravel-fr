import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Recherche d'images sur Unsplash.
 * Nécessite la variable d'env UNSPLASH_ACCESS_KEY.
 */
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
    if (!key) {
      return { ok: false as const, error: "Clé Unsplash non configurée." };
    }
    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", data.query);
    url.searchParams.set("page", String(data.page ?? 1));
    url.searchParams.set("per_page", "12");
    url.searchParams.set("orientation", "landscape");
    url.searchParams.set("content_filter", "high");
    url.searchParams.set("order_by", "relevant");
    url.searchParams.set("color", data.color ?? "");

    try {
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Client-ID ${key}`,
          "Accept-Version": "v1",
        },
      });
      if (!res.ok) {
        return { ok: false as const, error: `Unsplash ${res.status}` };
      }
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
      console.error("searchUnsplash error", e);
      return { ok: false as const, error: "Erreur réseau Unsplash." };
    }
  });

/**
 * Génération d'image via Lovable AI Gateway (Gemini image preview).
 * Renvoie une data URL base64 que le client peut uploader vers le bucket.
 */
export const generateAiImage = createServerFn({ method: "POST" })
  .inputValidator((d: { prompt: string }) =>
    z.object({ prompt: z.string().min(3).max(1000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return { ok: false as const, error: "Lovable AI non configuré." };
    }

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-image-preview",
          messages: [
            {
              role: "user",
              content: `Photographie réaliste, qualité éditoriale, format paysage 16:9, lumineux et inspirant : ${data.prompt}`,
            },
          ],
          modalities: ["image", "text"],
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error("AI image error", res.status, txt);
        if (res.status === 429) return { ok: false as const, error: "Trop de requêtes, réessayez dans un instant." };
        if (res.status === 402) return { ok: false as const, error: "Crédits IA épuisés." };
        return { ok: false as const, error: `Erreur IA (${res.status}).` };
      }

      const json = await res.json() as {
        choices?: Array<{
          message?: {
            images?: Array<{ image_url?: { url?: string } }>;
          };
        }>;
      };
      const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!url) {
        return { ok: false as const, error: "Aucune image renvoyée." };
      }
      return { ok: true as const, dataUrl: url };
    } catch (e) {
      console.error("generateAiImage error", e);
      return { ok: false as const, error: "Erreur réseau IA." };
    }
  });

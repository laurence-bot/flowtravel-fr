// Edge function : recherche web d'un hôtel (nom + lieu)
// → retourne { hotel_url, hotel_photo_url, hotel_nom_confirme }
// Utilise Gemini (via Lovable AI Gateway) pour trouver le site officiel et une photo.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hotel_nom, lieu } = await req.json();

    if (!hotel_nom || typeof hotel_nom !== "string") {
      return new Response(
        JSON.stringify({ error: "hotel_nom requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY non configuré" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const query = `${hotel_nom}${lieu ? ` ${lieu}` : ""} site officiel hôtel`;

    const aiRes = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `Tu es un assistant spécialisé dans la recherche d'hôtels pour des agences de voyage haut de gamme.
Tu reçois un nom d'hôtel et une ville. Tu dois trouver :
1. L'URL exacte du site officiel de l'hôtel (pas booking.com, pas tripadvisor — le site propre à l'hôtel).
2. L'URL directe d'une belle photo de l'hôtel (extérieur ou lobby) trouvée sur le site officiel ou sur un site de presse hôtelière. L'URL doit se terminer par .jpg, .jpeg, .png ou .webp et être directement accessible.
3. Le nom exact confirmé de l'hôtel.

Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks, exactement dans ce format :
{
  "hotel_nom_confirme": "Nom exact de l'hôtel",
  "hotel_url": "https://...",
  "hotel_photo_url": "https://...photo.jpg"
}

Si tu ne trouves pas le site officiel, mets null pour hotel_url.
Si tu ne trouves pas de photo directe, mets null pour hotel_photo_url.`,
            },
            {
              role: "user",
              content: query,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "web_search",
                description: "Search the web for hotel information",
                parameters: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                  },
                  required: ["query"],
                },
              },
            },
          ],
        }),
      },
    );

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("[enrich-hotel] AI error", aiRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Erreur passerelle IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content ?? "";
    console.log("[enrich-hotel] raw content:", content);

    let result: {
      hotel_nom_confirme?: string;
      hotel_url?: string | null;
      hotel_photo_url?: string | null;
    } = {};
    try {
      const clean = content
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/gi, "")
        .trim();
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) result = JSON.parse(match[0]);
    } catch (e) {
      console.error("[enrich-hotel] JSON parse error", e, content);
    }

    const isValidUrl = (u: unknown): boolean => {
      if (!u || typeof u !== "string") return false;
      try {
        const url = new URL(u);
        return url.protocol === "https:" || url.protocol === "http:";
      } catch {
        return false;
      }
    };

    const isValidImageUrl = (u: unknown): boolean => {
      if (!isValidUrl(u)) return false;
      const s = String(u).toLowerCase();
      return (
        s.includes(".jpg") ||
        s.includes(".jpeg") ||
        s.includes(".png") ||
        s.includes(".webp") ||
        s.includes("image") ||
        s.includes("photo") ||
        s.includes("media")
      );
    };

    return new Response(
      JSON.stringify({
        hotel_nom_confirme: result.hotel_nom_confirme ?? hotel_nom,
        hotel_url: isValidUrl(result.hotel_url) ? result.hotel_url : null,
        hotel_photo_url: isValidImageUrl(result.hotel_photo_url)
          ? result.hotel_photo_url
          : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[enrich-hotel] error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

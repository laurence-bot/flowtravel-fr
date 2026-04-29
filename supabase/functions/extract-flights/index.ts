// Edge function : analyse une capture d'écran de vols via Lovable AI (Gemini vision)
// et renvoie une liste structurée de segments prêts à insérer.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Tu es un assistant qui extrait des informations de vols depuis une capture d'écran de réservation/GDS.

Pour CHAQUE segment de vol visible (un segment = un tronçon entre 2 aéroports, sans escale au milieu), extrais :
- compagnie : code IATA 2 lettres (ex: AF, KL, ET). Si écrit "AF 3180 (par KL)", c'est compagnie="AF" (commercial) — préfère le code commercial.
- numero_vol : numéro de vol complet (ex: "AF3180", "KL1234")
- aeroport_depart : code IATA 3 lettres
- aeroport_arrivee : code IATA 3 lettres
- date_depart : format YYYY-MM-DD. Si l'année n'est pas visible, utilise l'année courante (2026) ou l'année prochaine si la date est passée.
- heure_depart : format HH:MM (24h)
- date_arrivee : format YYYY-MM-DD. Attention au "+1" qui signifie arrivée le lendemain.
- heure_arrivee : format HH:MM (24h)

Conventions de dates : "25JAN" = 25 janvier, "01FEB" = 1er février, etc.
Conventions horaires : "06:30 - 08:30" signifie départ 06:30, arrivée 08:30.

Tu DOIS répondre UNIQUEMENT avec un JSON valide, sans texte avant/après, sans markdown :
{ "segments": [ { ... }, ... ] }

L'ordre des segments doit suivre la chronologie (aller puis retour).`;

const TOOL = {
  type: "function" as const,
  function: {
    name: "extract_flight_segments",
    description: "Renvoie la liste structurée des segments de vol détectés.",
    parameters: {
      type: "object",
      properties: {
        segments: {
          type: "array",
          items: {
            type: "object",
            properties: {
              compagnie: { type: "string" },
              numero_vol: { type: "string" },
              aeroport_depart: { type: "string" },
              aeroport_arrivee: { type: "string" },
              date_depart: { type: "string" },
              heure_depart: { type: "string" },
              date_arrivee: { type: "string" },
              heure_arrivee: { type: "string" },
            },
            required: ["aeroport_depart", "aeroport_arrivee"],
            additionalProperties: false,
          },
        },
      },
      required: ["segments"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageDataUrl } = await req.json();
    if (!imageDataUrl || typeof imageDataUrl !== "string") {
      return new Response(JSON.stringify({ error: "imageDataUrl requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY manquant" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: "Extrais tous les segments de vol de cette capture." },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "extract_flight_segments" } },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requêtes atteinte. Réessayez dans une minute." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "Crédits IA épuisés. Ajoutez des fonds dans les paramètres." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, txt);
      return new Response(JSON.stringify({ error: `Erreur IA: ${aiRes.status}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiRes.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    let segments: unknown = [];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        segments = parsed.segments ?? [];
      } catch (e) {
        console.error("JSON parse error:", e, toolCall.function.arguments);
      }
    }

    return new Response(JSON.stringify({ segments }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-flights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

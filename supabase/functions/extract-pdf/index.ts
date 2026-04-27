// Edge function : extraction structurée d'un PDF via Lovable AI Gateway.
// Reçoit { type: "contrat_fournisseur" | "couverture_fx", text: string }.
// Retourne { data, confiance }.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPPLIER_TOOL = {
  type: "function",
  function: {
    name: "extract_supplier_contract",
    description:
      "Extrait les informations d'un contrat / facture fournisseur de voyage.",
    parameters: {
      type: "object",
      properties: {
        fournisseur_nom: { type: "string", description: "Nom du fournisseur." },
        dossier_reference: {
          type: "string",
          description: "Référence du dossier ou nom du voyage.",
        },
        description: { type: "string", description: "Libellé / prestation." },
        devise: {
          type: "string",
          description:
            "Code ISO 4217 (EUR, USD, GBP, ZAR, CHF, CAD, AUD, JPY, AED, MAD, TND).",
        },
        montant_devise: {
          type: "number",
          description: "Montant total dans la devise.",
        },
        montant_eur: {
          type: "number",
          description: "Contre-valeur EUR si présente.",
        },
        taux_change: {
          type: "number",
          description: "Taux de change appliqué si présent.",
        },
        date_echeance: {
          type: "string",
          description: "Date d'échéance solde au format YYYY-MM-DD.",
        },
        reference_fournisseur: {
          type: "string",
          description: "Numéro de facture / référence fournisseur.",
        },
        conditions_paiement: { type: "string" },
        echeances: {
          type: "array",
          description: "Liste des échéances (acomptes + solde).",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["acompte_1", "acompte_2", "acompte_3", "solde", "autre"],
              },
              date_echeance: { type: "string" },
              montant_devise: { type: "number" },
            },
            required: ["type", "montant_devise"],
            additionalProperties: false,
          },
        },
        confiance: {
          type: "string",
          enum: ["faible", "moyenne", "elevee"],
          description: "Auto-évaluation de la qualité d'extraction.",
        },
      },
      required: ["fournisseur_nom", "devise", "montant_devise", "confiance"],
      additionalProperties: false,
    },
  },
};

const FX_TOOL = {
  type: "function",
  function: {
    name: "extract_fx_coverage",
    description: "Extrait un contrat de couverture de change (Ebury ou autre).",
    parameters: {
      type: "object",
      properties: {
        reference: { type: "string", description: "Référence du contrat." },
        banque: { type: "string", description: "Ebury, SG, CIC..." },
        devise: { type: "string", description: "Code ISO 4217 acheté." },
        montant_devise: { type: "number" },
        taux_change: { type: "number" },
        montant_eur: { type: "number" },
        date_ouverture: { type: "string", description: "YYYY-MM-DD" },
        date_echeance: { type: "string", description: "YYYY-MM-DD" },
        notes: { type: "string" },
        confiance: {
          type: "string",
          enum: ["faible", "moyenne", "elevee"],
        },
      },
      required: ["devise", "montant_devise", "taux_change", "confiance"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, text } = await req.json();
    if (!type || !text) {
      return new Response(
        JSON.stringify({ error: "type et text requis" }),
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

    const tool = type === "couverture_fx" ? FX_TOOL : SUPPLIER_TOOL;
    const systemPrompt =
      type === "couverture_fx"
        ? "Tu es un assistant comptable spécialisé en couvertures de change Ebury. Extrais les informations du contrat fourni. Si une information est absente, ne l'invente pas. Évalue ta confiance honnêtement."
        : "Tu es un assistant comptable spécialisé en factures fournisseurs d'agences de voyage. Extrais les informations du contrat fourni. Si une information est absente, ne l'invente pas. Évalue ta confiance honnêtement.";

    // Tronquer le texte pour rester dans la fenêtre de contexte
    const truncated = text.slice(0, 30000);

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
            { role: "system", content: systemPrompt },
            { role: "user", content: truncated },
          ],
          tools: [tool],
          tool_choice: {
            type: "function",
            function: { name: tool.function.name },
          },
        }),
      },
    );

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Trop de requêtes, réessayez plus tard." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({
            error:
              "Crédits IA épuisés. Ajoutez des crédits dans Settings > Workspace > Usage.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: "Erreur passerelle IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(
        JSON.stringify({
          error: "Aucune donnée extraite",
          confiance: "faible",
          data: {},
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("JSON parse error", e);
    }

    const confiance =
      (parsed.confiance as string) === "elevee" ||
      (parsed.confiance as string) === "moyenne" ||
      (parsed.confiance as string) === "faible"
        ? (parsed.confiance as string)
        : "moyenne";

    return new Response(
      JSON.stringify({ data: parsed, confiance }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("extract-pdf error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

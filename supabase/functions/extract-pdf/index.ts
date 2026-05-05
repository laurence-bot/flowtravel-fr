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

const PROGRAM_TOOL = {
  type: "function",
  function: {
    name: "extract_supplier_program",
    description:
      "Extrait un programme de voyage / itinéraire fournisseur (DMC, réceptif, hôtel) : la liste des jours et la liste des prestations chiffrées. Réécris les textes des jours dans un ton premium, sensoriel et fluide, MAIS sans inventer ni retirer aucune information factuelle, sans modifier le sens, sans changer les noms d'hébergements, lieux, durées, services, transferts, repas. Corrige uniquement orthographe et grammaire.",
    parameters: {
      type: "object",
      properties: {
        fournisseur_nom: {
          type: "string",
          description: "Nom du fournisseur / DMC / hôtel émetteur du programme.",
        },
        destination: {
          type: "string",
          description: "Destination principale du programme.",
        },
        nombre_pax: {
          type: "number",
          description: "Nombre de voyageurs si mentionné.",
        },
        date_depart: {
          type: "string",
          description: "Date de début au format YYYY-MM-DD si mentionnée.",
        },
        jours: {
          type: "array",
          description:
            "Liste ordonnée des jours du programme. Un jour = un objet. Conserve absolument tous les jours présents dans le document.",
          items: {
            type: "object",
            properties: {
              ordre: {
                type: "number",
                description: "Numéro du jour (1, 2, 3...).",
              },
              titre: {
                type: "string",
                description:
                  "Titre court du jour, ex : 'Arrivée à Marrakech', 'Désert d'Agafay'. Reste fidèle au document.",
              },
              lieu: {
                type: "string",
                description: "Lieu principal du jour si identifiable.",
              },
              date_jour: {
                type: "string",
                description: "Date YYYY-MM-DD si présente.",
              },
              description: {
                type: "string",
                description:
                  "Description du jour reformulée dans un ton premium, sensoriel, fluide et naturel (français impeccable). INTERDIT : inventer une activité, un hébergement, un horaire, un service, un transfert, un repas qui n'est pas dans le document. INTERDIT : retirer une information factuelle. Conserve les noms propres exacts (hôtels, lieux, restaurants, prestataires). Pas d'émojis, pas de superlatifs creux ('inoubliable', 'magique').",
              },
              hotel_nom: {
                type: "string",
                description:
                  "Nom exact de l'hôtel / hébergement de la nuit pour ce jour, tel qu'écrit dans le document. Ne pas inventer. Null si non mentionné.",
              },
            },
            required: ["ordre", "titre"],
            additionalProperties: false,
          },
        },
        lignes: {
          type: "array",
          description:
            "Liste des prestations chiffrées trouvées dans le document (hébergements, transferts, excursions, vols internes, repas facturés...). Une ligne par prestation distincte avec un prix.",
          items: {
            type: "object",
            properties: {
              prestation: {
                type: "string",
                description:
                  "Libellé court de la prestation tel qu'écrit dans le document (ex : '3 nuits Riad Yasmine', 'Transfert aéroport-hôtel', 'Excursion Atlas').",
              },
              nom_fournisseur: {
                type: "string",
                description:
                  "Nom du fournisseur / prestataire si différent du fournisseur principal, sinon réutilise le nom principal.",
              },
              quantite: {
                type: "number",
                description: "Quantité (nuits, personnes, unités). Défaut 1.",
              },
              mode_tarifaire: {
                type: "string",
                enum: ["global", "par_personne"],
                description:
                  "Choisis 'par_personne' si le prix est explicitement par personne (per pax / pp), sinon 'global'.",
              },
              devise: {
                type: "string",
                description: "Code ISO 4217 de la prestation.",
              },
              montant_devise: {
                type: "number",
                description: "Prix unitaire dans la devise.",
              },
              jour_ordre: {
                type: "number",
                description:
                  "Numéro du jour auquel la prestation est rattachée si identifiable.",
              },
              date_prestation: {
                type: "string",
                description: "Date YYYY-MM-DD si présente.",
              },
            },
            required: ["prestation", "devise", "montant_devise"],
            additionalProperties: false,
          },
        },
        confiance: {
          type: "string",
          enum: ["faible", "moyenne", "elevee"],
        },
      },
      required: ["jours", "lignes", "confiance"],
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
    // Accepte :
    // - { type, text }                    : texte déjà extrait
    // - { type, images: [dataUrl,...] }   : images (vision)
    // - { type, pdfBase64 }               : PDF brut base64 → extraction texte côté serveur via unpdf
    const { type, text: textIn, images, pdfBase64 } = await req.json();
    let text: string | undefined = typeof textIn === "string" ? textIn : undefined;

    if (!type) {
      return new Response(
        JSON.stringify({ error: "type requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!text && pdfBase64 && typeof pdfBase64 === "string") {
      try {
        const bin = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
        if (bin.byteLength > 20 * 1024 * 1024) {
          return new Response(
            JSON.stringify({ error: "PDF trop volumineux (max 20 Mo)." }),
            { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const { extractText, getDocumentProxy } = await import("https://esm.sh/unpdf@0.12.1");
        const pdf = await getDocumentProxy(bin);
        const { text: extracted } = await extractText(pdf, { mergePages: true });
        text = (Array.isArray(extracted) ? extracted.join("\n") : String(extracted || "")).slice(0, 60000);
        console.log("[extract-pdf] unpdf extracted", { chars: text.length, pages: pdf.numPages });
      } catch (e) {
        console.error("[extract-pdf] unpdf failed", e);
        return new Response(
          JSON.stringify({ error: "Lecture PDF impossible côté serveur. Essayez un PDF non protégé / non scanné, ou envoyez une image." }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    console.log("[extract-pdf] received", {
      type,
      textLen: text ? text.length : 0,
      imagesCount: Array.isArray(images) ? images.length : 0,
    });

    if (!text && (!images || images.length === 0)) {
      return new Response(
        JSON.stringify({ error: "text, images ou pdfBase64 requis" }),
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

    const tool =
      type === "couverture_fx"
        ? FX_TOOL
        : type === "programme_fournisseur"
        ? PROGRAM_TOOL
        : SUPPLIER_TOOL;
    const systemPrompt =
      type === "couverture_fx"
        ? "Tu es un assistant comptable spécialisé en couvertures de change Ebury. Extrais les informations du contrat fourni. Si une information est absente, ne l'invente pas. Évalue ta confiance honnêtement."
        : type === "programme_fournisseur"
        ? `Tu es un assistant pour une agence de voyages haut de gamme. Tu analyses des programmes / propositions de fournisseurs (DMC, réceptifs, hôtels).

Tu extrais :
(1) Tous les jours du programme dans l'ordre exact
(2) Toutes les prestations chiffrées avec prix et devise
(3) Pour chaque jour : le nom EXACT de l'hôtel ou hébergement de la nuit (champ hotel_nom) — cherche les mentions d'hôtel, lodge, resort, riad, villa, camp dans la description du jour ou dans le tableau des hébergements. Si un hébergement est listé pour plusieurs nuits, attribue-le à chaque jour concerné. Ne jamais inventer un nom — null si absent.

Pour chaque jour, RÉÉCRIS la description dans un ton premium, sensoriel, fluide — MAIS sans changer le sens, sans inventer, sans retirer aucune information factuelle (hôtels, transferts, horaires, services, repas, durées). Conserve les noms propres exacts. Pas d'émojis, pas de superlatifs creux ('inoubliable', 'magique'). Si une donnée manque, ne l'invente pas.

Pour les jours comportant un vol domestique (vol intérieur entre deux villes du pays), inclure dans le titre du jour la mention du trajet aérien, ex : "Yogyakarta - Denpasar (vol domestique) - Menjangan" ou "Yogyakarta - Denpasar (vol IU 123) - Menjangan". Le numéro de vol doit être inclus s'il est mentionné dans le document.`
        : "Tu es un assistant comptable spécialisé en factures fournisseurs d'agences de voyage. Extrais les informations du contrat fourni. Si une information est absente, ne l'invente pas. Évalue ta confiance honnêtement.";

    // Construit le message user : texte ou images (vision)
    let userContent: unknown;
    if (images && Array.isArray(images) && images.length > 0) {
      userContent = [
        { type: "text", text: "Voici le document fournisseur (images). Extrais les informations demandées." },
        ...images.slice(0, 8).map((url: string) => ({
          type: "image_url",
          image_url: { url },
        })),
      ];
    } else {
      userContent = String(text).slice(0, 60000);
    }

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
            { role: "user", content: userContent },
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

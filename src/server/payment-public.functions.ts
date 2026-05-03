import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Récupère les infos paiement publiques liées à un token de devis :
 * — montant acompte calculé,
 * — moyens de paiement configurés par l'agence,
 * — coordonnées agence.
 */
export const getPublicPaymentInfo = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) =>
    z.object({ token: z.string().min(20).max(100) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: link } = await supabaseAdmin
      .from("quote_public_links")
      .select("*")
      .eq("token", data.token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!link) return { ok: false as const, error: "Lien invalide ou expiré." };

    const { data: cotation } = await supabaseAdmin
      .from("cotations")
      .select("*")
      .eq("id", link.cotation_id)
      .maybeSingle();
    if (!cotation) return { ok: false as const, error: "Devis introuvable." };

    const { data: agency } = await supabaseAdmin
      .from("agency_settings")
      .select("*")
      .eq("user_id", cotation.user_id)
      .maybeSingle();

    const contact = cotation.client_id
      ? (await supabaseAdmin
          .from("contacts")
          .select("nom, email, contact_principal")
          .eq("id", cotation.client_id)
          .maybeSingle()).data
      : null;

    return {
      ok: true as const,
      link,
      cotation,
      agency,
      contact,
    };
  });

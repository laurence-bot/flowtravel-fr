import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Récupère un devis public par son token. Marque viewed_at à la 1re vue.
 * Lecture publique (pas de middleware auth) — RLS gère l'accès.
 */
export const getPublicQuote = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().min(20).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const { token } = data;

    // 1. Récupérer le lien
    const { data: link, error: errLink } = await supabaseAdmin
      .from("quote_public_links")
      .select("*")
      .eq("token", token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (errLink || !link) {
      return { ok: false as const, error: "Lien invalide ou expiré." };
    }

    // 2. Récupérer cotation + lignes + jours + vols en parallèle
    const [cotRes, lignesRes, joursRes, volsRes] = await Promise.all([
      supabaseAdmin.from("cotations").select("*").eq("id", link.cotation_id).maybeSingle(),
      supabaseAdmin
        .from("cotation_lignes_fournisseurs")
        .select("*")
        .eq("cotation_id", link.cotation_id)
        .order("ordre", { ascending: true }),
      supabaseAdmin
        .from("cotation_jours")
        .select("*")
        .eq("cotation_id", link.cotation_id)
        .order("ordre", { ascending: true }),
      supabaseAdmin
        .from("flight_options")
        .select("*")
        .eq("cotation_id", link.cotation_id)
        .order("created_at", { ascending: true }),
    ]);

    if (cotRes.error || !cotRes.data) {
      return { ok: false as const, error: "Devis introuvable." };
    }

    const cotation = cotRes.data;
    const [agencyRes, contactRes] = await Promise.all([
      supabaseAdmin.from("agency_settings").select("*").eq("user_id", cotation.user_id).maybeSingle(),
      cotation.client_id
        ? supabaseAdmin.from("contacts").select("nom, email").eq("id", cotation.client_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    // 3. Marquer viewed_at à la 1re vue
    if (!link.viewed_at) {
      await supabaseAdmin
        .from("quote_public_links")
        .update({ viewed_at: new Date().toISOString() })
        .eq("id", link.id);
    }

    return {
      ok: true as const,
      link,
      cotation,
      lignes: lignesRes.data ?? [],
      jours: joursRes.data ?? [],
      agency: agencyRes.data,
      contact: contactRes.data,
    };
  });

/** Le client accepte le devis. */
export const acceptPublicQuote = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().min(20).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("quote_public_links")
      .update({ accepted_at: new Date().toISOString() })
      .eq("token", data.token)
      .gt("expires_at", new Date().toISOString());
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/** Le client demande un rappel. */
export const requestCallback = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().min(20).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("quote_public_links")
      .update({ callback_requested_at: new Date().toISOString() })
      .eq("token", data.token)
      .gt("expires_at", new Date().toISOString());
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/** Le client demande une modification (avec message libre). */
export const requestModification = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; message: string }) =>
    z.object({
      token: z.string().min(20).max(100),
      message: z.string().min(1).max(2000),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("quote_public_links")
      .update({
        modification_requested_at: new Date().toISOString(),
        modification_request_text: data.message,
      })
      .eq("token", data.token)
      .gt("expires_at", new Date().toISOString());
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

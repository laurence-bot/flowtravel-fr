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

    // Récupère les segments de tous les vols en une requête (RLS via token autorise la lecture).
    const flightIds = (volsRes.data ?? []).map((v) => v.id);
    type FlightSegmentRow = {
      id: string;
      flight_option_id: string;
      ordre: number;
      compagnie: string | null;
      numero_vol: string | null;
      aeroport_depart: string;
      date_depart: string | null;
      heure_depart: string | null;
      aeroport_arrivee: string;
      date_arrivee: string | null;
      heure_arrivee: string | null;
      duree_escale_minutes: number | null;
      notes: string | null;
    };
    let segments: FlightSegmentRow[] = [];
    if (flightIds.length > 0) {
      const { data: segs } = await supabaseAdmin
        .from("flight_segments")
        .select("*")
        .in("flight_option_id", flightIds)
        .order("ordre", { ascending: true });
      segments = (segs ?? []) as FlightSegmentRow[];
    }

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
      vols: volsRes.data ?? [],
      segments,
      agency: agencyRes.data,
      contact: contactRes.data,
    };
  });

/** Le client choisit une option de vol. */
export const chooseFlightOption = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; flightOptionId: string }) =>
    z.object({
      token: z.string().min(20).max(100),
      flightOptionId: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    // Vérifier que le lien est valide et récupérer la cotation
    const { data: link } = await supabaseAdmin
      .from("quote_public_links")
      .select("id, cotation_id")
      .eq("token", data.token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!link) return { ok: false as const, error: "Lien invalide ou expiré." };

    // Vérifier que l'option de vol appartient bien à cette cotation
    const { data: vol } = await supabaseAdmin
      .from("flight_options")
      .select("id")
      .eq("id", data.flightOptionId)
      .eq("cotation_id", link.cotation_id)
      .maybeSingle();
    if (!vol) return { ok: false as const, error: "Option de vol invalide." };

    const { error } = await supabaseAdmin
      .from("quote_public_links")
      .update({
        chosen_flight_option_id: data.flightOptionId,
        flight_chosen_at: new Date().toISOString(),
      })
      .eq("id", link.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/** Le client accepte le devis. */
/** Le client valide le devis (acceptation), sans déclaration de paiement. */
export const acceptPublicQuote = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().min(20).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const { data: link } = await supabaseAdmin
      .from("quote_public_links")
      .select("cotation_id, accepted_at")
      .eq("token", data.token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!link) return { ok: false as const, error: "Lien invalide" };

    // Idempotent : on ne re-notifie pas si déjà accepté
    if (link.accepted_at) return { ok: true as const, alreadyAccepted: true };

    const { error } = await supabaseAdmin
      .from("quote_public_links")
      .update({ accepted_at: new Date().toISOString() })
      .eq("token", data.token);
    if (error) return { ok: false as const, error: error.message };

    // Notification agent : "devis validé par le client"
    try {
      const { data: cot } = await supabaseAdmin
        .from("cotations")
        .select("id, user_id, agent_id, titre, dossier_id, client_id")
        .eq("id", link.cotation_id)
        .maybeSingle();
      if (cot) {
        const { data: client } = cot.client_id
          ? await supabaseAdmin.from("contacts").select("nom").eq("id", cot.client_id).maybeSingle()
          : { data: null as any };
        const { notifyAgent } = await import("./agent-notifications.server");
        await notifyAgent({
          ownerUserId: cot.user_id,
          agentId: cot.agent_id,
          type: "devis_valide",
          titre: `Devis validé par le client — ${cot.titre}`,
          message: client?.nom ? `${client.nom} a validé le devis et va procéder au paiement de l'acompte.` : "Le client a validé le devis.",
          link: `/cotations/${cot.id}`,
          dossierId: cot.dossier_id,
          cotationId: cot.id,
          emailEvent: {
            eventLabel: "Devis validé par le client",
            clientNom: client?.nom,
            titreDossier: cot.titre,
            details: "Le client va procéder au paiement de l'acompte. Vous serez notifié dès qu'il l'aura déclaré.",
            ctaLabel: "Ouvrir la cotation",
          },
        });
      }
    } catch (e) {
      console.warn("notify devis_valide failed", e);
    }

    return { ok: true as const };
  });

/** Le client déclare avoir effectué le paiement de l'acompte. */
export const declarePaymentDone = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; method?: string }) =>
    z.object({
      token: z.string().min(20).max(100),
      method: z.string().max(50).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: link } = await supabaseAdmin
      .from("quote_public_links")
      .select("cotation_id, payment_declared_at")
      .eq("token", data.token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!link) return { ok: false as const, error: "Lien invalide" };
    if (link.payment_declared_at) return { ok: true as const, alreadyDone: true };

    const { error } = await supabaseAdmin
      .from("quote_public_links")
      .update({ payment_declared_at: new Date().toISOString() })
      .eq("token", data.token);
    if (error) return { ok: false as const, error: error.message };

    try {
      const { data: cot } = await supabaseAdmin
        .from("cotations")
        .select("id, user_id, agent_id, titre, dossier_id, client_id, statut")
        .eq("id", link.cotation_id)
        .maybeSingle();

      if (cot) {
        // Auto-transformation : si la cotation est validée et pas encore transformée,
        // on crée le dossier + on enchaîne avec l'envoi du bulletin.
        let dossierId = cot.dossier_id;
        let bulletinSent = false;

        if (!dossierId && cot.statut === "validee") {
          const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc(
            "transformer_cotation_en_dossier",
            { _cotation_id: cot.id },
          );
          if (!rpcErr && rpcRes) {
            dossierId = rpcRes as unknown as string;
            // Déclencher le bulletin automatiquement
            try {
              const { triggerBulletinAfterAcompte } = await import("./bulletin-trigger.functions");
              const trig = await triggerBulletinAfterAcompte({
                data: { cotationId: cot.id, sendEmail: true },
              });
              bulletinSent = !!(trig as any)?.emailSent;
            } catch (e) {
              console.warn("auto-trigger bulletin after acompte failed", e);
            }
          } else if (rpcErr) {
            console.warn("auto-transform cotation failed", rpcErr.message);
          }
        }

        const { data: client } = cot.client_id
          ? await supabaseAdmin.from("contacts").select("nom").eq("id", cot.client_id).maybeSingle()
          : { data: null as any };
        const { notifyAgent } = await import("./agent-notifications.server");
        await notifyAgent({
          ownerUserId: cot.user_id,
          agentId: cot.agent_id,
          type: "acompte_paye",
          titre: `Acompte déclaré payé — ${cot.titre}`,
          message: client?.nom
            ? `${client.nom} a confirmé le paiement${data.method ? ` (${data.method})` : ""}.${dossierId && dossierId !== cot.dossier_id ? " Dossier créé automatiquement." : ""}${bulletinSent ? " Bulletin envoyé au client." : ""}`
            : "Le client a confirmé le paiement de l'acompte.",
          link: dossierId ? `/dossiers/${dossierId}` : `/cotations/${cot.id}`,
          dossierId,
          cotationId: cot.id,
          emailEvent: {
            eventLabel: "Acompte déclaré payé",
            clientNom: client?.nom,
            titreDossier: cot.titre,
            details: `Le client a déclaré avoir payé${data.method ? ` (${data.method})` : ""}.${dossierId && dossierId !== cot.dossier_id ? " Le dossier a été créé automatiquement." : ""}${bulletinSent ? " Le bulletin d'inscription a été envoyé au client pour signature." : " Vérifiez la réception puis envoyez le bulletin d'inscription."}`,
            ctaLabel: dossierId ? "Ouvrir le dossier" : "Ouvrir la cotation",
          },
        });
      }
    } catch (e) {
      console.warn("notify acompte_paye failed", e);
    }

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

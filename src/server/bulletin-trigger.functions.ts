import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { render } from "@react-email/render";
import React from "react";

/**
 * Déclenche le bulletin d'inscription pour un dossier/cotation après réception
 * du 1er acompte client. Crée le bulletin (s'il n'existe pas) et envoie un
 * email au client avec le lien de signature.
 *
 * Idempotent : si un bulletin "a_signer" ou "signe" existe déjà pour cette
 * cotation, on n'en crée pas de nouveau et on renvoie le lien existant.
 */
export const triggerBulletinAfterAcompte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      cotationId: z.string().uuid(),
      sendEmail: z.boolean().optional().default(true),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: cotation } = await supabaseAdmin
      .from("cotations")
      .select("id, user_id, titre, client_id, dossier_id, agent_id")
      .eq("id", data.cotationId)
      .maybeSingle();
    if (!cotation) return { ok: false as const, error: "Cotation introuvable" };

    // Sécurité : l'utilisateur doit appartenir à l'agence propriétaire.
    // (RLS empêche déjà la lecture transverse, on garde un check supplémentaire.)
    if (cotation.user_id !== userId) {
      const { data: prof } = await supabaseAdmin
        .from("user_profiles")
        .select("agence_id")
        .eq("user_id", userId)
        .maybeSingle();
      const { data: ownerProf } = await supabaseAdmin
        .from("user_profiles")
        .select("agence_id")
        .eq("user_id", cotation.user_id)
        .maybeSingle();
      if (!prof?.agence_id || prof.agence_id !== ownerProf?.agence_id) {
        return { ok: false as const, error: "Accès refusé" };
      }
    }

    // Bulletin existant ?
    const { data: existing } = await supabaseAdmin
      .from("bulletins")
      .select("id, token, statut")
      .eq("cotation_id", cotation.id)
      .in("statut", ["a_signer", "signe"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let bulletinId: string;
    let token: string;

    if (existing) {
      bulletinId = existing.id;
      token = existing.token;
    } else {
      const { data: agency } = await supabaseAdmin
        .from("agency_settings")
        .select("cgv_text")
        .eq("user_id", cotation.user_id)
        .maybeSingle();

      const { data: created, error: insErr } = await supabaseAdmin
        .from("bulletins")
        .insert({
          user_id: cotation.user_id,
          agent_id: cotation.agent_id,
          cotation_id: cotation.id,
          dossier_id: cotation.dossier_id,
          client_id: cotation.client_id,
          conditions_text: agency?.cgv_text ?? null,
        })
        .select("id, token")
        .single();
      if (insErr || !created) {
        return { ok: false as const, error: insErr?.message ?? "Création bulletin échouée" };
      }
      bulletinId = created.id;
      token = created.token;
    }

    let emailSent = false;
    if (data.sendEmail && cotation.client_id) {
      const { data: client } = await supabaseAdmin
        .from("contacts")
        .select("nom, email, contact_principal")
        .eq("id", cotation.client_id)
        .maybeSingle();

      if (client?.email) {
        const { data: agency } = await supabaseAdmin
          .from("agency_settings")
          .select("agency_name")
          .eq("user_id", cotation.user_id)
          .maybeSingle();

        const origin =
          process.env.PUBLIC_SITE_URL ||
          process.env.SITE_URL ||
          "https://flowtravel.fr";
        const signUrl = `${origin.replace(/\/$/, "")}/bulletin/${token}`;

        // Pré-rendu du template puis enqueue via send-transactional-email
        const entry = TEMPLATES["bulletin-to-sign"];
        const props = {
          prenom: client.contact_principal ?? client.nom,
          titre: cotation.titre,
          agence: agency?.agency_name ?? "Votre agence",
          sign_url: signUrl,
        };
        const html = await render(React.createElement(entry.component, props));
        const subject = typeof entry.subject === "function" ? entry.subject(props) : entry.subject;

        try {
          // Insertion dans la queue email (suit la convention du projet).
          await supabaseAdmin.rpc("enqueue_email", {
            queue_name: "transactional_emails",
            payload: {
              template_name: "bulletin-to-sign",
              recipient_email: client.email,
              subject,
              html,
              idempotency_key: `bulletin-${bulletinId}`,
              metadata: { bulletin_id: bulletinId, cotation_id: cotation.id },
            } as any,
          });
          emailSent = true;
        } catch (e) {
          // On ne casse pas le flux si l'email échoue : le bulletin existe.
          console.warn("enqueue bulletin email failed", e);
        }
      }
    }

    return { ok: true as const, bulletinId, token, emailSent };
  });

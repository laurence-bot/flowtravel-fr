import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { render } from "@react-email/render";
import React from "react";

export interface NotifyAgentInput {
  ownerUserId: string; // user_id propriétaire (cotation/dossier)
  agentId?: string | null; // agent assigné (sinon owner)
  type: string; // ex "acompte_paye", "bulletin_signe"
  titre: string;
  message?: string;
  link?: string;
  dossierId?: string | null;
  cotationId?: string | null;
  bulletinId?: string | null;
  emailEvent?: {
    eventLabel: string;
    clientNom?: string;
    titreDossier: string;
    details?: string;
    ctaLabel?: string;
  } | null;
}

/**
 * Crée une notification in-app pour l'agent et envoie un email récapitulatif
 * (deux canaux). Idempotent best-effort : pas de doublons côté email grâce à
 * idempotency_key, et la notif in-app est libre par design (peut être lue plusieurs fois).
 */
export async function notifyAgent(input: NotifyAgentInput) {
  const recipientUserId = input.agentId || input.ownerUserId;

  // 1) In-app notification
  const { error: notifErr } = await supabaseAdmin.from("agent_notifications").insert({
    user_id: recipientUserId,
    type: input.type,
    titre: input.titre,
    message: input.message ?? null,
    link: input.link ?? null,
    dossier_id: input.dossierId ?? null,
    cotation_id: input.cotationId ?? null,
    bulletin_id: input.bulletinId ?? null,
  });
  if (notifErr) console.warn("agent_notifications insert failed", notifErr);

  // 2) Email
  if (input.emailEvent) {
    try {
      const { data: profile } = await supabaseAdmin
        .from("user_profiles")
        .select("email,full_name")
        .eq("user_id", recipientUserId)
        .maybeSingle();

      if (profile?.email) {
        const entry = TEMPLATES["agent-event"];
        const props = {
          agent_prenom: (profile.full_name ?? "").split(" ")[0] || profile.full_name || "",
          event_label: input.emailEvent.eventLabel,
          client_nom: input.emailEvent.clientNom,
          titre: input.emailEvent.titreDossier,
          details: input.emailEvent.details,
          link_url: input.link,
          cta_label: input.emailEvent.ctaLabel ?? "Ouvrir",
        };
        const html = await render(React.createElement(entry.component, props));
        const subject = typeof entry.subject === "function" ? entry.subject(props) : entry.subject;

        await supabaseAdmin.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            template_name: "agent-event",
            recipient_email: profile.email,
            subject,
            html,
            idempotency_key: `agent-${input.type}-${input.bulletinId ?? input.cotationId ?? input.dossierId ?? Date.now()}`,
            metadata: {
              type: input.type,
              dossier_id: input.dossierId,
              cotation_id: input.cotationId,
              bulletin_id: input.bulletinId,
            },
          } as any,
        });
      }
    } catch (e) {
      console.warn("notifyAgent email failed", e);
    }
  }
}

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { render } from "@react-email/render";
import React from "react";

const RELANCE_DELAY_DAYS = 5;

async function processRelances() {
  const now = new Date();
  const thresholdCreated = new Date(now.getTime() - RELANCE_DELAY_DAYS * 24 * 3600 * 1000).toISOString();
  const thresholdLastRelance = new Date(now.getTime() - RELANCE_DELAY_DAYS * 24 * 3600 * 1000).toISOString();

  // Bulletins à signer, créés il y a >= 5j, jamais relancés OU dernière relance >= 5j
  const { data: bulletins, error } = await supabaseAdmin
    .from("bulletins")
    .select("id, token, user_id, cotation_id, client_id, last_relance_at, created_at, expires_at")
    .eq("statut", "a_signer")
    .lte("created_at", thresholdCreated)
    .gt("expires_at", now.toISOString())
    .or(`last_relance_at.is.null,last_relance_at.lte.${thresholdLastRelance}`)
    .limit(100);

  if (error) return { ok: false, error: error.message };
  if (!bulletins || bulletins.length === 0) return { ok: true, processed: 0 };

  let sent = 0;
  for (const b of bulletins) {
    if (!b.client_id) continue;
    const [{ data: client }, { data: cot }, { data: agency }] = await Promise.all([
      supabaseAdmin.from("contacts").select("nom,email,contact_principal").eq("id", b.client_id).maybeSingle(),
      b.cotation_id
        ? supabaseAdmin.from("cotations").select("titre").eq("id", b.cotation_id).maybeSingle()
        : Promise.resolve({ data: null as any }),
      supabaseAdmin.from("agency_settings").select("agency_name").eq("user_id", b.user_id).maybeSingle(),
    ]);
    if (!client?.email) continue;

    const origin = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || "https://flowtravel.fr";
    const signUrl = `${origin.replace(/\/$/, "")}/bulletin/${b.token}`;

    const props = {
      prenom: client.contact_principal ?? client.nom,
      titre: cot?.titre ?? "Voyage",
      agence: agency?.agency_name ?? "Votre agence",
      sign_url: signUrl,
    };
    const entry = TEMPLATES["bulletin-relance"];
    const html = await render(React.createElement(entry.component, props));
    const subject = typeof entry.subject === "function" ? entry.subject(props) : entry.subject;

    try {
      await supabaseAdmin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          template_name: "bulletin-relance",
          recipient_email: client.email,
          subject,
          html,
          idempotency_key: `bulletin-relance-${b.id}-${now.toISOString().slice(0, 10)}`,
          metadata: { bulletin_id: b.id },
        } as any,
      });
      await supabaseAdmin
        .from("bulletins")
        .update({ last_relance_at: now.toISOString() })
        .eq("id", b.id);
      sent++;
    } catch (e) {
      console.warn("relance enqueue failed", b.id, e);
    }
  }

  return { ok: true, processed: sent, total: bulletins.length };
}

export const Route = createFileRoute("/api/public/hooks/relance-bulletins")({
  server: {
    handlers: {
      POST: async () => {
        const result = await processRelances();
        return new Response(JSON.stringify(result), {
          status: result.ok ? 200 : 500,
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () => {
        const result = await processRelances();
        return new Response(JSON.stringify(result), {
          status: result.ok ? 200 : 500,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

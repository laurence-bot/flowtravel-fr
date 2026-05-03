import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { render } from "@react-email/render";
import React from "react";

const RELANCE_DELAY_DAYS = 5;

async function processRelancesAcompte() {
  const now = new Date();
  const threshold = new Date(now.getTime() - RELANCE_DELAY_DAYS * 24 * 3600 * 1000).toISOString();

  // Liens publics de devis : acceptés (devis validé) mais paiement jamais déclaré
  // ET acceptation > 5j ET (jamais relancé OU dernière relance > 5j)
  const { data: links, error } = await supabaseAdmin
    .from("quote_public_links")
    .select("id, token, cotation_id, accepted_at, last_relance_acompte_at, expires_at, payment_declared_at")
    .not("accepted_at", "is", null)
    .is("payment_declared_at", null)
    .lte("accepted_at", threshold)
    .gt("expires_at", now.toISOString())
    .or(`last_relance_acompte_at.is.null,last_relance_acompte_at.lte.${threshold}`)
    .limit(100);

  if (error) return { ok: false, error: error.message };
  if (!links || links.length === 0) return { ok: true, processed: 0 };

  let sent = 0;
  for (const l of links) {
    const { data: cot } = await supabaseAdmin
      .from("cotations")
      .select("id, user_id, titre, client_id, prix_vente_ttc")
      .eq("id", l.cotation_id)
      .maybeSingle();
    if (!cot?.client_id) continue;

    const [{ data: client }, { data: agency }] = await Promise.all([
      supabaseAdmin.from("contacts").select("nom,email,contact_principal").eq("id", cot.client_id).maybeSingle(),
      supabaseAdmin.from("agency_settings").select("agency_name").eq("user_id", cot.user_id).maybeSingle(),
    ]);
    if (!client?.email) continue;

    const origin = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || "https://flowtravel.fr";
    const paymentUrl = `${origin.replace(/\/$/, "")}/paiement/${l.token}`;
    const acompte = Math.round(Number(cot.prix_vente_ttc ?? 0) * 0.30);

    const props = {
      prenom: client.contact_principal ?? client.nom,
      titre: cot.titre,
      agence: agency?.agency_name ?? "Votre agence",
      payment_url: paymentUrl,
      montant_acompte: acompte > 0 ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(acompte) : undefined,
    };
    const entry = TEMPLATES["acompte-relance"];
    const html = await render(React.createElement(entry.component, props));
    const subject = typeof entry.subject === "function" ? entry.subject(props) : entry.subject;

    try {
      await supabaseAdmin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          template_name: "acompte-relance",
          recipient_email: client.email,
          subject,
          html,
          idempotency_key: `acompte-relance-${l.id}-${now.toISOString().slice(0, 10)}`,
          metadata: { quote_link_id: l.id, cotation_id: cot.id },
        } as any,
      });
      await supabaseAdmin
        .from("quote_public_links")
        .update({ last_relance_acompte_at: now.toISOString() })
        .eq("id", l.id);
      sent++;
    } catch (e) {
      console.warn("relance acompte enqueue failed", l.id, e);
    }
  }

  return { ok: true, processed: sent, total: links.length };
}

export const Route = createFileRoute("/api/public/hooks/relance-acomptes")({
  server: {
    handlers: {
      POST: async () => {
        const result = await processRelancesAcompte();
        return new Response(JSON.stringify(result), {
          status: result.ok ? 200 : 500,
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () => {
        const result = await processRelancesAcompte();
        return new Response(JSON.stringify(result), {
          status: result.ok ? 200 : 500,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

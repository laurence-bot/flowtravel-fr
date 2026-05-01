import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const adminClient = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export const getMariagePublic = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: z.string().min(8) }).parse(d))
  .handler(async ({ data }) => {
    const sb = adminClient();
    const { data: link } = await sb
      .from("quote_public_links")
      .select("cotation_id,user_id,expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!link || new Date(link.expires_at) < new Date()) return { ok: false as const };

    const { data: cotation } = await sb
      .from("cotations")
      .select("id,titre,destination,date_depart,date_retour,prix_vente_ttc,est_liste_mariage,mariage_titre,mariage_message,mariage_objectif,hero_image_url,user_id")
      .eq("id", link.cotation_id)
      .maybeSingle();
    if (!cotation || !cotation.est_liste_mariage) return { ok: false as const };

    const { data: contributions } = await sb
      .from("mariage_contributions")
      .select("invite_prenom,invite_nom,montant,message,date_paiement,statut,created_at")
      .eq("cotation_id", cotation.id)
      .eq("statut", "paye")
      .order("created_at", { ascending: false });

    const { data: agency } = await sb
      .from("agency_settings")
      .select("agency_name,logo_url,color_primary,color_signature,color_ornament")
      .eq("user_id", cotation.user_id)
      .maybeSingle();

    const total = (contributions ?? []).reduce((s, c) => s + Number(c.montant), 0);

    return { ok: true as const, cotation, contributions: contributions ?? [], total, agency };
  });

export const submitMariageContribution = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: z.string().min(8),
        invite_prenom: z.string().min(1),
        invite_nom: z.string().min(1),
        invite_email: z.string().email().optional().or(z.literal("")),
        invite_telephone: z.string().optional(),
        montant: z.number().positive(),
        message: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = adminClient();
    const { data: link } = await sb
      .from("quote_public_links")
      .select("cotation_id,user_id,expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!link || new Date(link.expires_at) < new Date()) return { ok: false as const, error: "Lien invalide" };

    const { data: cotation } = await sb
      .from("cotations")
      .select("id,user_id,titre,client_id,est_liste_mariage")
      .eq("id", link.cotation_id)
      .maybeSingle();
    if (!cotation?.est_liste_mariage) return { ok: false as const, error: "Pas une liste de mariage" };

    const { data: inserted, error } = await sb
      .from("mariage_contributions")
      .insert({
        user_id: cotation.user_id,
        cotation_id: cotation.id,
        invite_prenom: data.invite_prenom,
        invite_nom: data.invite_nom,
        invite_email: data.invite_email || null,
        invite_telephone: data.invite_telephone || null,
        montant: data.montant,
        message: data.message || null,
        statut: "paye", // MVP : on considère payé immédiatement (Stripe à brancher ensuite)
        date_paiement: new Date().toISOString(),
      })
      .select()
      .single();
    if (error || !inserted) return { ok: false as const, error: error?.message ?? "Erreur" };

    // Notification email au couple (client) + reçu à l'invité
    try {
      const { data: client } = await sb
        .from("contacts")
        .select("email,nom")
        .eq("id", cotation.client_id ?? "")
        .maybeSingle();
      const apiKey = process.env.LOVABLE_API_KEY;
      const resendKey = process.env.RESEND_API_KEY;
      if (apiKey && resendKey) {
        const sendEmail = async (to: string, subject: string, html: string) => {
          await fetch("https://connector-gateway.lovable.dev/resend/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
              "X-Connection-Api-Key": resendKey,
            },
            body: JSON.stringify({
              from: "FlowTravel <onboarding@resend.dev>",
              to: [to],
              subject,
              html,
            }),
          });
        };

        if (client?.email) {
          await sendEmail(
            client.email,
            `Nouvelle contribution de ${data.invite_prenom} ${data.invite_nom} 🎉`,
            `<p>Bonjour,</p>
             <p><strong>${data.invite_prenom} ${data.invite_nom}</strong> vient de contribuer à votre voyage de noces "<strong>${cotation.titre}</strong>" :</p>
             <ul>
               <li>Montant : <strong>${data.montant.toFixed(2)} €</strong></li>
               ${data.message ? `<li>Message : « ${data.message} »</li>` : ""}
             </ul>
             <p>Total à ce jour visible dans votre espace.</p>`,
          );
          await sb
            .from("mariage_contributions")
            .update({ email_couple_envoye_at: new Date().toISOString() })
            .eq("id", inserted.id);
        }
        if (data.invite_email) {
          await sendEmail(
            data.invite_email,
            `Merci pour votre contribution au voyage de noces`,
            `<p>Bonjour ${data.invite_prenom},</p>
             <p>Nous confirmons votre contribution de <strong>${data.montant.toFixed(2)} €</strong> au voyage de noces "<strong>${cotation.titre}</strong>".</p>
             <p>Les futurs mariés ont été informés. Merci pour ce merveilleux cadeau !</p>`,
          );
          await sb
            .from("mariage_contributions")
            .update({ email_invite_envoye_at: new Date().toISOString() })
            .eq("id", inserted.id);
        }
      }
    } catch (e) {
      // on ne bloque pas le retour si l'email échoue
      console.error("[mariage email]", e);
    }

    return { ok: true as const };
  });

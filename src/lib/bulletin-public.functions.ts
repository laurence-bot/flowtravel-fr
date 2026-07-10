import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { render } from "@react-email/render";
import React from "react";

const adminClient = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export const getPublicBulletin = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: z.string().min(8) }).parse(d))
  .handler(async ({ data }) => {
    const sb = adminClient();
    const { data: bulletin, error } = await sb
      .from("bulletins")
      .select("*")
      .eq("token", data.token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error || !bulletin) return { ok: false as const };

    const [{ data: cotation }, { data: client }, { data: agency }] = await Promise.all([
      bulletin.cotation_id
        ? sb.from("cotations").select("titre,destination,date_depart,date_retour,prix_vente_ttc,nombre_pax").eq("id", bulletin.cotation_id).maybeSingle()
        : Promise.resolve({ data: null }),
      bulletin.client_id
        ? sb.from("contacts").select("nom,email,telephone,adresse,ville,code_postal,pays").eq("id", bulletin.client_id).maybeSingle()
        : Promise.resolve({ data: null }),
      sb.from("agency_settings").select("agency_name,logo_url,color_primary,color_signature,color_ornament,cgv_text,legal_name,siret,vat_number,address,city,country,phone,email").eq("user_id", bulletin.user_id).maybeSingle(),
    ]);

    return { ok: true as const, bulletin, cotation, client, agency };
  });

export const signBulletin = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: z.string().min(8),
        signature_data: z.string().min(20),
        signataire_nom: z.string().min(2),
        signataire_email: z.string().email().optional(),
        conditions_acceptees: z.literal(true),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = adminClient();
    const { data: bulletin } = await sb
      .from("bulletins")
      .select("id,statut,user_id,cotation_id,dossier_id,client_id,expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!bulletin) return { ok: false as const, error: "Bulletin introuvable" };
    if (bulletin.statut !== "a_signer") return { ok: false as const, error: "Déjà signé ou annulé" };
    if (new Date(bulletin.expires_at) < new Date()) return { ok: false as const, error: "Lien expiré" };

    const { error: updErr } = await sb
      .from("bulletins")
      .update({
        statut: "signe",
        signature_data: data.signature_data,
        signataire_nom: data.signataire_nom,
        signataire_email: data.signataire_email ?? null,
        conditions_acceptees: true,
        signed_at: new Date().toISOString(),
      })
      .eq("id", bulletin.id);
    if (updErr) return { ok: false as const, error: updErr.message };

    // Génération automatique des factures clients (acompte 1, acompte 2, solde)
    if (bulletin.cotation_id) {
      const { data: cotation } = await sb
        .from("cotations")
        .select("prix_vente_ht,prix_vente_ttc,taux_tva_marge,regime_tva,date_depart")
        .eq("id", bulletin.cotation_id)
        .maybeSingle();

      const { data: agency } = await sb
        .from("agency_settings")
        .select("pct_acompte_client_1,pct_acompte_client_2,pct_solde_client,delai_acompte_2_jours,delai_solde_jours")
        .eq("user_id", bulletin.user_id)
        .maybeSingle();

      if (cotation) {
        // Évite les doublons en cas de re-signature
        const { count: alreadyCount } = await sb
          .from("factures_clients")
          .select("id", { count: "exact", head: true })
          .eq("bulletin_id", bulletin.id);

        if (!alreadyCount || alreadyCount === 0) {
          const ht = Number(cotation.prix_vente_ht ?? 0);
          const ttc = Number(cotation.prix_vente_ttc ?? 0);
          const tauxTva = Number(cotation.taux_tva_marge ?? 20);
          const dateDepart = cotation.date_depart ? new Date(cotation.date_depart) : null;

          const pct1 = Number(agency?.pct_acompte_client_1 ?? 30);
          const pct2 = Number(agency?.pct_acompte_client_2 ?? 0);
          const pctSolde = Number(agency?.pct_solde_client ?? 70);
          const delai2 = agency?.delai_acompte_2_jours ?? null;
          const delaiSolde = agency?.delai_solde_jours ?? 30;

          const addDays = (base: Date, days: number) => {
            const d = new Date(base);
            d.setDate(d.getDate() + days);
            return d.toISOString().slice(0, 10);
          };

          type Tranche = { type: "acompte_1" | "acompte_2" | "solde"; pct: number; date_echeance: string | null };
          const tranches: Tranche[] = [];
          if (pct1 > 0) tranches.push({ type: "acompte_1", pct: pct1, date_echeance: new Date().toISOString().slice(0, 10) });
          if (pct2 > 0) tranches.push({
            type: "acompte_2",
            pct: pct2,
            date_echeance: delai2 != null ? addDays(new Date(), delai2) : null,
          });
          if (pctSolde > 0) tranches.push({
            type: "solde",
            pct: pctSolde,
            date_echeance: dateDepart ? addDays(dateDepart, -Math.abs(delaiSolde)) : null,
          });

          const year = new Date().getFullYear();
          const { count: existing } = await sb
            .from("factures_clients")
            .select("id", { count: "exact", head: true })
            .eq("user_id", bulletin.user_id)
            .like("numero", `FA-${year}-%`);
          let nextNum = (existing ?? 0) + 1;

          for (let i = 0; i < tranches.length; i++) {
            const t = tranches[i];
            const factHt = Math.round(((ht * t.pct) / 100) * 100) / 100;
            const factTtc = Math.round(((ttc * t.pct) / 100) * 100) / 100;
            const factTva = Math.max(0, Math.round((factTtc - factHt) * 100) / 100);
            const numero = `FA-${year}-${String(nextNum++).padStart(4, "0")}`;
            await sb.from("factures_clients").insert({
              user_id: bulletin.user_id,
              numero,
              client_id: bulletin.client_id,
              cotation_id: bulletin.cotation_id,
              dossier_id: bulletin.dossier_id,
              bulletin_id: bulletin.id,
              montant_ht: factHt,
              montant_ttc: factTtc,
              montant_tva: factTva,
              taux_tva: tauxTva,
              regime_tva: cotation.regime_tva,
              statut: "emise",
              type_facture: t.type,
              pct_applique: t.pct,
              ordre: i + 1,
              date_echeance: t.date_echeance,
            });
          }
        }
      }
    }

    // Envoi de l'email "bulletin signé + factures" au client
    try {
      const [{ data: client }, { data: agency }, { data: factures }] = await Promise.all([
        bulletin.client_id
          ? sb.from("contacts").select("nom,email,contact_principal").eq("id", bulletin.client_id).maybeSingle()
          : Promise.resolve({ data: null }),
        sb.from("agency_settings").select("agency_name").eq("user_id", bulletin.user_id).maybeSingle(),
        sb.from("factures_clients")
          .select("numero,type_facture,montant_ttc")
          .eq("bulletin_id", bulletin.id)
          .order("ordre", { ascending: true }),
      ]);

      const { data: cot } = bulletin.cotation_id
        ? await sb.from("cotations").select("titre").eq("id", bulletin.cotation_id).maybeSingle()
        : { data: null };

      if (client?.email) {
        const origin =
          process.env.PUBLIC_SITE_URL || process.env.SITE_URL || "https://flowtravel.fr";
        const baseUrl = origin.replace(/\/$/, "");
        const props = {
          prenom: client.contact_principal ?? client.nom,
          titre: cot?.titre ?? "Voyage",
          agence: agency?.agency_name ?? "Votre agence",
          bulletin_url: `${baseUrl}/bulletin/${data.token}`,
          factures_url: `${baseUrl}/mes-documents/${data.token}`,
          factures: (factures ?? []).map((f: any) => ({
            numero: f.numero,
            type: f.type_facture,
            montant_ttc: Number(f.montant_ttc),
          })),
        };
        const entry = TEMPLATES["bulletin-signed"];
        const html = await render(React.createElement(entry.component, props));
        const subject = typeof entry.subject === "function" ? entry.subject(props) : entry.subject;

        await sb.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            template_name: "bulletin-signed",
            recipient_email: client.email,
            subject,
            html,
            idempotency_key: `bulletin-signed-${bulletin.id}`,
            metadata: { bulletin_id: bulletin.id },
          } as any,
        });
      }
    } catch (e) {
      console.warn("send bulletin-signed email failed", e);
    }

    // Notification agent : bulletin signé
    try {
      const { data: cot } = bulletin.cotation_id
        ? await sb.from("cotations").select("titre, agent_id, dossier_id").eq("id", bulletin.cotation_id).maybeSingle()
        : { data: null as any };
      const { data: client } = bulletin.client_id
        ? await sb.from("contacts").select("nom").eq("id", bulletin.client_id).maybeSingle()
        : { data: null as any };
      const { notifyAgent } = await import("./agent-notifications.server");
      await notifyAgent({
        ownerUserId: bulletin.user_id,
        agentId: cot?.agent_id ?? null,
        type: "bulletin_signe",
        titre: `Bulletin signé — ${cot?.titre ?? "Voyage"}`,
        message: client?.nom ? `${client.nom} a signé le bulletin d'inscription.` : "Le bulletin a été signé.",
        link: (cot?.dossier_id ?? bulletin.dossier_id) ? `/dossiers/${cot?.dossier_id ?? bulletin.dossier_id}` : "/bulletins",
        dossierId: cot?.dossier_id ?? bulletin.dossier_id,
        cotationId: bulletin.cotation_id,
        bulletinId: bulletin.id,
        emailEvent: {
          eventLabel: "Bulletin signé",
          clientNom: client?.nom,
          titreDossier: cot?.titre ?? "Voyage",
          details: "Les factures clients ont été générées automatiquement.",
          ctaLabel: "Ouvrir le dossier",
        },
      });
    } catch (e) {
      console.warn("notify bulletin_signe failed", e);
    }

    return { ok: true as const };
  });

/** Récupère le bulletin signé + factures associées pour la page publique /mes-documents/$token */
export const getPublicBulletinDocuments = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: z.string().min(8) }).parse(d))
  .handler(async ({ data }) => {
    const sb = adminClient();
    const { data: bulletin } = await sb
      .from("bulletins")
      .select("id, statut, signed_at, expires_at, user_id, cotation_id, token")
      .eq("token", data.token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!bulletin) return { ok: false as const };

    const [{ data: factures }, { data: agency }, { data: cotation }] = await Promise.all([
      sb.from("factures_clients")
        .select("id,numero,type_facture,date_emission,date_echeance,montant_ht,montant_tva,montant_ttc,statut,pct_applique,ordre")
        .eq("bulletin_id", bulletin.id)
        .order("ordre", { ascending: true }),
      sb.from("agency_settings")
        .select("agency_name,logo_url,color_primary,color_signature")
        .eq("user_id", bulletin.user_id)
        .maybeSingle(),
      bulletin.cotation_id
        ? sb.from("cotations").select("titre,destination,date_depart,date_retour").eq("id", bulletin.cotation_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return { ok: true as const, bulletin, factures: factures ?? [], agency, cotation };
  });

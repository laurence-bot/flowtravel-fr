import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

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

    // Génération automatique de la facture client si cotation présente
    if (bulletin.cotation_id) {
      const { data: cotation } = await sb
        .from("cotations")
        .select("prix_vente_ht,prix_vente_ttc,taux_tva_marge,regime_tva")
        .eq("id", bulletin.cotation_id)
        .maybeSingle();
      if (cotation) {
        const year = new Date().getFullYear();
        const { count } = await sb
          .from("factures_clients")
          .select("id", { count: "exact", head: true })
          .eq("user_id", bulletin.user_id)
          .like("numero", `FA-${year}-%`);
        const numero = `FA-${year}-${String((count ?? 0) + 1).padStart(4, "0")}`;
        const ht = Number(cotation.prix_vente_ht ?? 0);
        const ttc = Number(cotation.prix_vente_ttc ?? 0);
        await sb.from("factures_clients").insert({
          user_id: bulletin.user_id,
          numero,
          client_id: bulletin.client_id,
          cotation_id: bulletin.cotation_id,
          dossier_id: bulletin.dossier_id,
          bulletin_id: bulletin.id,
          montant_ht: ht,
          montant_ttc: ttc,
          montant_tva: Math.max(0, ttc - ht),
          taux_tva: Number(cotation.taux_tva_marge ?? 20),
          regime_tva: cotation.regime_tva,
          statut: "emise",
        });
      }
    }

    return { ok: true as const };
  });

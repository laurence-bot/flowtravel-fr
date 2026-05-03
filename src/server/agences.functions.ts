import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SiretSchema = z.object({
  siret: z.string().regex(/^\d{14}$/, "Le SIRET doit contenir 14 chiffres"),
});

export type SiretVerifResult = {
  found: boolean;
  nom?: string;
  enseigne?: string | null;
  siret?: string;
  siren?: string;
  etat?: string;
  estActif?: boolean;
  adresse?: string;
  activitePrincipale?: string;
  dirigeants?: Array<{ nom?: string; prenoms?: string; qualite?: string }>;
  dateCreation?: string;
  source: "recherche-entreprises.api.gouv.fr";
};

export const verifySiret = createServerFn({ method: "POST" })
  .inputValidator((data) => SiretSchema.parse(data))
  .handler(async ({ data }): Promise<SiretVerifResult> => {
    const url = `https://recherche-entreprises.api.gouv.fr/search?q=${data.siret}&page=1&per_page=1`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return { found: false, source: "recherche-entreprises.api.gouv.fr" };

    const json = (await res.json()) as {
      results?: Array<{
        nom_complet?: string;
        nom_raison_sociale?: string;
        siren?: string;
        siege?: {
          siret?: string;
          etat_administratif?: string;
          adresse?: string;
          enseigne_1?: string | null;
          activite_principale?: string;
          date_creation?: string;
        };
        dirigeants?: Array<{ nom?: string; prenoms?: string; qualite?: string }>;
      }>;
    };

    const first = json.results?.[0];
    if (!first || !first.siege) {
      return { found: false, source: "recherche-entreprises.api.gouv.fr" };
    }

    const etat = first.siege.etat_administratif ?? "?";
    return {
      found: true,
      nom: first.nom_complet ?? first.nom_raison_sociale ?? "—",
      enseigne: first.siege.enseigne_1 ?? null,
      siret: first.siege.siret ?? "",
      siren: first.siren,
      etat,
      estActif: etat === "A",
      adresse: first.siege.adresse,
      activitePrincipale: first.siege.activite_principale,
      dirigeants: first.dirigeants ?? [],
      dateCreation: first.siege.date_creation,
      source: "recherche-entreprises.api.gouv.fr",
    };
  });

/**
 * Inscription publique d'une agence : crée immédiatement le compte auth (avec
 * le mot de passe choisi par l'utilisateur, email_confirm=true) et l'agence
 * en statut "en_attente". Le profil est marqué actif=false jusqu'à validation.
 */
const RegisterSchema = z.object({
  nom_commercial: z.string().trim().min(2).max(150),
  raison_sociale: z.string().trim().max(150).optional().nullable(),
  immat_atout_france: z.string().trim().toUpperCase().regex(/^IM\d{9}$/),
  siret: z.string().trim().regex(/^\d{14}$/),
  est_etablissement_secondaire: z.boolean(),
  siren_siege: z.string().trim().optional().nullable(),
  email_contact: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  telephone: z.string().trim().max(30).optional().nullable(),
  adresse: z.string().trim().max(255).optional().nullable(),
  ville: z.string().trim().max(100).optional().nullable(),
  code_postal: z.string().trim().max(15).optional().nullable(),
  admin_full_name: z.string().trim().min(2).max(150),
  doc_atout_france_url: z.string(),
  doc_kbis_url: z.string(),
  doc_piece_identite_url: z.string(),
});

export const registerAgence = createServerFn({ method: "POST" })
  .inputValidator((d) => RegisterSchema.parse(d))
  .handler(async ({ data }) => {
    const email = data.email_contact.toLowerCase().trim();

    // 1. Créer (ou retrouver) le compte auth
    const { data: existingList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    let existing = existingList?.users.find((u) => u.email?.toLowerCase() === email);
    let userId: string;

    if (existing) {
      userId = existing.id;
      // Mettre à jour le mot de passe pour celui qu'il vient de saisir
      await supabaseAdmin.auth.admin.updateUserById(userId, { password: data.password });
    } else {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.admin_full_name },
      });
      if (createErr || !created?.user) {
        return { ok: false as const, error: createErr?.message ?? "Création du compte échouée" };
      }
      userId = created.user.id;
    }

    // 2. Insérer l'agence (statut en_attente, admin_user_id déjà connu)
    const { data: agence, error: agErr } = await supabaseAdmin
      .from("agences")
      .insert({
        nom_commercial: data.nom_commercial,
        raison_sociale: data.raison_sociale || data.nom_commercial,
        immat_atout_france: data.immat_atout_france,
        siret: data.siret,
        est_etablissement_secondaire: data.est_etablissement_secondaire,
        siren_siege: data.est_etablissement_secondaire ? (data.siren_siege || null) : null,
        email_contact: email,
        telephone: data.telephone || null,
        adresse: data.adresse || null,
        ville: data.ville || null,
        code_postal: data.code_postal || null,
        admin_full_name: data.admin_full_name,
        statut: "en_attente",
        forfait: "solo",
        max_agents: 1,
        admin_user_id: userId,
        doc_atout_france_url: data.doc_atout_france_url,
        doc_kbis_url: data.doc_kbis_url,
        doc_piece_identite_url: data.doc_piece_identite_url,
      })
      .select("id")
      .single();

    if (agErr || !agence) {
      const msg = agErr?.message?.includes("duplicate") || agErr?.code === "23505"
        ? "Ce numéro d'immatriculation ATOUT FRANCE est déjà enregistré."
        : (agErr?.message ?? "Erreur création agence");
      return { ok: false as const, error: msg };
    }

    // 3. Profil utilisateur : marqué actif=false + lié à l'agence en attente
    await supabaseAdmin
      .from("user_profiles")
      .upsert(
        {
          user_id: userId,
          email,
          full_name: data.admin_full_name,
          actif: false,
          is_super_admin: false,
          pending_agence_id: agence.id,
        },
        { onConflict: "user_id" },
      );

    // 4. Rôle agent provisoire (sera confirmé à la validation)
    await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "agent" },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );

    return { ok: true as const, agenceId: agence.id };
  });

/**
 * Validation par le super-admin : active le compte (actif=true), lie agence_id,
 * et envoie l'email de bienvenue. Le mot de passe a déjà été fixé à l'inscription.
 */
export const approveAgence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ agenceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: callerProfile } = await supabase
      .from("user_profiles")
      .select("is_super_admin")
      .eq("user_id", userId)
      .maybeSingle();
    if (!callerProfile?.is_super_admin) {
      throw new Error("Action réservée à un super administrateur");
    }

    const { data: agence, error: agErr } = await supabaseAdmin
      .from("agences")
      .select("*")
      .eq("id", data.agenceId)
      .single();
    if (agErr || !agence) throw new Error(agErr?.message ?? "Agence introuvable");
    if (agence.statut === "validee") throw new Error("Cette agence est déjà validée");

    const email = agence.email_contact.toLowerCase().trim();
    let adminUserId: string | null = agence.admin_user_id;

    // Cas legacy : l'agence a été créée avant le refactor sans compte auth
    if (!adminUserId) {
      const { data: existingList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = existingList?.users.find((u) => u.email?.toLowerCase() === email);
      if (existing) {
        adminUserId = existing.id;
      } else {
        const tempPassword = crypto.randomUUID().replace(/-/g, "") + "Aa1!";
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: agence.admin_full_name },
        });
        if (createErr || !created?.user) {
          throw new Error(`Création échouée : ${createErr?.message ?? "erreur inconnue"}`);
        }
        adminUserId = created.user.id;
      }
    }

    // Activer le profil + lier à l'agence (et nettoyer pending_agence_id)
    const { error: upProfErr } = await supabaseAdmin
      .from("user_profiles")
      .update({
        agence_id: agence.id,
        pending_agence_id: null,
        actif: true,
        full_name: agence.admin_full_name,
      })
      .eq("user_id", adminUserId);

    if (upProfErr) {
      // Profil pas encore créé → on l'insère
      await supabaseAdmin.from("user_profiles").insert({
        user_id: adminUserId,
        email,
        full_name: agence.admin_full_name,
        agence_id: agence.id,
        actif: true,
        is_super_admin: false,
      });
    }

    await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: adminUserId, role: "agent" },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );

    await supabaseAdmin
      .from("agences")
      .update({
        statut: "validee",
        validee_at: new Date().toISOString(),
        validee_par: userId,
        admin_user_id: adminUserId,
        motif_refus: null,
      })
      .eq("id", agence.id);

    // Envoi email de bienvenue (non bloquant)
    try {
      const React = await import("react");
      const { render } = await import("@react-email/render");
      const { TEMPLATES } = await import("@/lib/email-templates/registry");
      const entry = TEMPLATES["agence-validee"];
      const origin = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || "https://flowtravel.fr";
      const props = {
        agenceName: agence.nom_commercial,
        loginUrl: `${origin.replace(/\/$/, "")}/auth`,
        email,
      };
      const html = await render(React.createElement(entry.component as any, props));
      const subject = typeof entry.subject === "function" ? entry.subject(props) : entry.subject;
      await supabaseAdmin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          template_name: "agence-validee",
          recipient_email: email,
          subject,
          html,
          idempotency_key: `agence-validee-${agence.id}`,
          metadata: { agence_id: agence.id },
        } as any,
      });
    } catch (e) {
      console.warn("agence-validee email enqueue failed", e);
    }

    return { success: true, adminUserId, email };
  });

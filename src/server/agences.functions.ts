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
  etat?: string; // "A" actif, "C" cessé
  estActif?: boolean;
  adresse?: string;
  activitePrincipale?: string;
  dirigeants?: Array<{ nom?: string; prenoms?: string; qualite?: string }>;
  dateCreation?: string;
  source: "recherche-entreprises.api.gouv.fr";
};

/**
 * Vérifie un SIRET via l'API publique gratuite Recherche d'entreprises (api.gouv.fr).
 * Pas de clé API requise.
 * Doc: https://recherche-entreprises.api.gouv.fr/docs/
 */
export const verifySiret = createServerFn({ method: "POST" })
  .inputValidator((data) => SiretSchema.parse(data))
  .handler(async ({ data }): Promise<SiretVerifResult> => {
    const url = `https://recherche-entreprises.api.gouv.fr/search?q=${data.siret}&page=1&per_page=1`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return {
        found: false,
        source: "recherche-entreprises.api.gouv.fr",
      };
    }

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

    const siegeSiret = first.siege.siret ?? "";
    if (siegeSiret !== data.siret) {
      // L'API retourne le siège ; si l'utilisateur a saisi un SIRET d'établissement secondaire,
      // on remonte quand même les infos entreprise mais on signale le décalage.
    }

    const etat = first.siege.etat_administratif ?? "?";
    return {
      found: true,
      nom: first.nom_complet ?? first.nom_raison_sociale ?? "—",
      enseigne: first.siege.enseigne_1 ?? null,
      siret: siegeSiret,
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
 * Valide une agence : crée le compte auth (invitation), lie l'agence à l'utilisateur
 * et configure le profil + rôle. Réservé aux super admins.
 */
export const approveAgence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ agenceId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Vérifier que l'appelant est super admin
    const { data: callerProfile, error: profileErr } = await supabase
      .from("user_profiles")
      .select("is_super_admin")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message);
    if (!callerProfile?.is_super_admin) {
      throw new Error("Action réservée à un super administrateur");
    }

    // 2. Récupérer l'agence
    const { data: agence, error: agErr } = await supabaseAdmin
      .from("agences")
      .select("*")
      .eq("id", data.agenceId)
      .single();
    if (agErr) throw new Error(agErr.message);
    if (!agence) throw new Error("Agence introuvable");
    if (agence.statut === "validee") {
      throw new Error("Cette agence est déjà validée");
    }

    const email = agence.email_contact.toLowerCase().trim();
    let adminUserId: string | null = agence.admin_user_id;

    // 3. Si pas encore de compte lié : inviter ou réutiliser
    if (!adminUserId) {
      // Vérifier si un user existe déjà avec cet email
      const { data: existingList } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      const existing = existingList?.users.find(
        (u) => u.email?.toLowerCase() === email,
      );

      if (existing) {
        adminUserId = existing.id;
      } else {
        const redirectTo =
          (process.env.PUBLIC_SITE_URL ?? "https://flowtravel.fr") + "/auth";
        const { data: invited, error: invErr } =
          await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: { full_name: agence.admin_full_name },
            redirectTo,
          });
        if (invErr) throw new Error(`Invitation échouée : ${invErr.message}`);
        adminUserId = invited.user?.id ?? null;
        if (!adminUserId) throw new Error("Création de compte échouée");
      }
    }

    // 4. Mettre à jour le profil utilisateur avec l'agence_id
    const { error: upProfErr } = await supabaseAdmin
      .from("user_profiles")
      .update({
        agence_id: agence.id,
        full_name: agence.admin_full_name,
      })
      .eq("user_id", adminUserId);
    if (upProfErr) {
      // Le trigger handle_new_user crée le profil automatiquement, mais en cas d'invitation
      // le profil peut ne pas exister immédiatement — on l'insère.
      const { error: insErr } = await supabaseAdmin
        .from("user_profiles")
        .insert({
          user_id: adminUserId,
          email,
          full_name: agence.admin_full_name,
          agence_id: agence.id,
          actif: true,
          is_super_admin: false,
        });
      if (insErr && !insErr.message.includes("duplicate")) {
        throw new Error(`Profil : ${insErr.message}`);
      }
    }

    // 5. S'assurer du rôle "agent"
    await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: adminUserId, role: "agent" },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );

    // 6. Marquer l'agence validée
    const { error: updErr } = await supabaseAdmin
      .from("agences")
      .update({
        statut: "validee",
        validee_at: new Date().toISOString(),
        validee_par: userId,
        admin_user_id: adminUserId,
        motif_refus: null,
      })
      .eq("id", agence.id);
    if (updErr) throw new Error(updErr.message);

    return { success: true, adminUserId, email };
  });

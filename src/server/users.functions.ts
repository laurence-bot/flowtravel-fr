import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InviteSchema = z.object({
  email: z.string().email("Email invalide"),
  full_name: z.string().trim().min(1, "Nom requis").max(120),
  role: z.enum(["administrateur", "agent"]),
});

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => InviteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase: userClient, userId } = context;

    // Verify caller is administrateur
    const { data: roleRow } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "administrateur")
      .maybeSingle();
    if (!roleRow) {
      throw new Response("Forbidden: administrateur required", { status: 403 });
    }

    // Get caller's agence
    const { data: callerProfile } = await userClient
      .from("user_profiles")
      .select("agence_id")
      .eq("user_id", userId)
      .maybeSingle();

    const email = data.email.trim().toLowerCase();

    // Création directe sans envoi d'email (le super-admin gère l'onboarding manuellement).
    // Mot de passe temporaire aléatoire — l'utilisateur passera par "mot de passe oublié" si besoin.
    const tempPassword = crypto.randomUUID().replace(/-/g, "") + "Aa1!";

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (createErr || !created?.user) {
      throw new Response(createErr?.message ?? "Échec de la création", { status: 400 });
    }

    const newUserId = created.user.id;

    // Update profile (handle_new_user trigger created it)
    await supabaseAdmin
      .from("user_profiles")
      .update({
        full_name: data.full_name,
        agence_id: callerProfile?.agence_id ?? null,
      })
      .eq("user_id", newUserId);

    // Set role (override default 'agent' if needed)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    await supabaseAdmin.from("user_roles").insert({ user_id: newUserId, role: data.role });

    return { ok: true, user_id: newUserId, email };
  });

const DeleteSchema = z.object({ user_id: z.string().uuid() });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => DeleteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase: userClient, userId } = context;

    if (data.user_id === userId) {
      throw new Response("Impossible de supprimer votre propre compte", { status: 400 });
    }

    const { data: roleRow } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "administrateur")
      .maybeSingle();
    if (!roleRow) {
      throw new Response("Forbidden: administrateur required", { status: 403 });
    }

    const { data: caller } = await userClient
      .from("user_profiles")
      .select("agence_id, is_super_admin")
      .eq("user_id", userId)
      .maybeSingle();
    const { data: target } = await supabaseAdmin
      .from("user_profiles")
      .select("agence_id, email")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (!target) throw new Response("Utilisateur introuvable", { status: 404 });

    if (!caller?.is_super_admin && caller?.agence_id !== target.agence_id) {
      throw new Response("Forbidden: agence différente", { status: 403 });
    }

    if ((target.email ?? "").toLowerCase() === "bonjour@flowtravel.fr") {
      throw new Response("Ce compte est protégé.", { status: 400 });
    }

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("user_profiles").delete().eq("user_id", data.user_id);
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (delErr) {
      throw new Response(delErr.message, { status: 400 });
    }

    return { ok: true };
  });

const SetPasswordSchema = z.object({
  user_id: z.string().uuid(),
  password: z.string().min(8).max(72).optional(),
});

function generatePassword() {
  // 12 chars, lettres/chiffres + symbole
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const buf = new Uint32Array(10);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 10; i++) out += chars[buf[i] % chars.length];
  return out + "Aa1!";
}

export const setUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => SetPasswordSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase: userClient, userId } = context;

    const { data: roleRow } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "administrateur")
      .maybeSingle();
    if (!roleRow) {
      throw new Response("Forbidden: administrateur required", { status: 403 });
    }

    const { data: caller } = await userClient
      .from("user_profiles")
      .select("agence_id, is_super_admin")
      .eq("user_id", userId)
      .maybeSingle();
    const { data: target } = await supabaseAdmin
      .from("user_profiles")
      .select("agence_id, email")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (!target) throw new Response("Utilisateur introuvable", { status: 404 });

    if (!caller?.is_super_admin && caller?.agence_id !== target.agence_id) {
      throw new Response("Forbidden: agence différente", { status: 403 });
    }

    const newPassword = data.password ?? generatePassword();

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: newPassword,
      email_confirm: true,
    });
    if (error) throw new Response(error.message, { status: 400 });

    return { ok: true, email: target.email, password: newPassword };
  });

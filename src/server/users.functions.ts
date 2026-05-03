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

    // Invite via admin API
    const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      { data: { full_name: data.full_name } }
    );
    if (inviteErr || !invited?.user) {
      throw new Response(inviteErr?.message ?? "Échec de l'invitation", { status: 400 });
    }

    const newUserId = invited.user.id;

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

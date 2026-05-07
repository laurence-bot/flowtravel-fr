import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";

/**
 * Layout parent de la zone OPS — réservée au super_admin (Laurence).
 * Toutes les routes /ops/* en héritent et sont protégées.
 */
export const Route = createFileRoute("/ops")({
  beforeLoad: async () => {
    // getUser() attend la restauration de la session (vs getSession qui peut renvoyer null
    // au premier render après navigation directe), évitant un redirect /app erroné.
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_profiles")
      .select("is_super_admin")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!data?.is_super_admin) throw redirect({ to: "/app" });
  },
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
});

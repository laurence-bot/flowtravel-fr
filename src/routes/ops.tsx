import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";

/**
 * Layout parent de la zone OPS — réservée au super_admin (Laurence).
 * Toutes les routes /ops/* en héritent et sont protégées.
 */
export const Route = createFileRoute("/ops")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_profiles")
      .select("is_super_admin")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (!data?.is_super_admin) throw redirect({ to: "/app" });
  },
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
});

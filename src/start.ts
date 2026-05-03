import { createStart, createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let token: string | undefined;
    if (typeof window !== "undefined") {
      try {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token;
      } catch {
        // ignore
      }
    }
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
}));

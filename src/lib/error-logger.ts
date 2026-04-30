import { supabase } from "@/integrations/supabase/client";

/** Log une erreur côté client dans la table error_logs (visible par le super-admin). */
export async function logError(params: {
  level?: "error" | "warning" | "info";
  source: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    let agence_id: string | null = null;
    if (user) {
      const { data } = await supabase.from("user_profiles").select("agence_id").eq("user_id", user.id).maybeSingle();
      agence_id = data?.agence_id || null;
    }
    await supabase.from("error_logs").insert({
      user_id: user?.id || null,
      agence_id,
      level: params.level || "error",
      source: params.source,
      message: params.message.slice(0, 2000),
      stack: params.stack?.slice(0, 4000) || null,
      context: params.context || null,
      url: typeof window !== "undefined" ? window.location.href : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch {
    // silencieux : on ne veut pas créer de boucle d'erreurs
  }
}

/** Installe les listeners globaux window.onerror + unhandledrejection. À appeler une seule fois. */
export function installGlobalErrorLogger() {
  if (typeof window === "undefined") return;
  if ((window as any).__flowtravel_error_logger_installed) return;
  (window as any).__flowtravel_error_logger_installed = true;

  window.addEventListener("error", (ev) => {
    logError({
      source: "frontend",
      message: ev.message || "Unknown error",
      stack: ev.error?.stack,
      context: { filename: ev.filename, lineno: ev.lineno, colno: ev.colno },
    });
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason;
    logError({
      source: "frontend",
      message: typeof reason === "string" ? reason : reason?.message || "Unhandled promise rejection",
      stack: reason?.stack,
    });
  });
}

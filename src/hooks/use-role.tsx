import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import type { AppRole } from "@/lib/permissions";

type RoleCtx = {
  role: AppRole | null;
  agenceId: string | null;
  isSuperAdmin: boolean;
  actif: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

const Ctx = createContext<RoleCtx | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [agenceId, setAgenceId] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [actif, setActif] = useState(true);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) {
      setRole(null);
      setAgenceId(null);
      setIsSuperAdmin(false);
      setActif(true);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Un seul appel groupé — source unique de vérité
    const [{ data: roleRows }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("user_profiles").select("actif, agence_id, is_super_admin").eq("user_id", user.id).maybeSingle(),
    ]);

    const roles = (roleRows ?? []).map((r) => r.role as string);

    // Priorité : is_super_admin (champ dédié) prime sur user_roles
    // pour éviter toute désynchronisation entre les deux tables
    const superAdmin = !!profile?.is_super_admin || roles.includes("super_admin");

    const resolvedRole: AppRole | null = superAdmin
      ? "super_admin"
      : roles.includes("administrateur")
        ? "administrateur"
        : roles.includes("agent")
          ? "agent"
          : roles.includes("gestion")
            ? "gestion"
            : roles.includes("comptable")
              ? "comptable"
              : roles.includes("lecture_seule")
                ? "lecture_seule"
                : null;

    setRole(resolvedRole);
    setIsSuperAdmin(superAdmin);
    setAgenceId(profile?.agence_id ?? null);
    setActif(profile?.actif ?? true);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <Ctx.Provider value={{ role, agenceId, isSuperAdmin, actif, loading, refresh: load }}>{children}</Ctx.Provider>
  );
}

export function useRole() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useRole must be used within RoleProvider");
  return c;
}

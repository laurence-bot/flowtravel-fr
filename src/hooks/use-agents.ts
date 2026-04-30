import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Agent = {
  user_id: string;
  full_name: string | null;
  email: string;
  actif: boolean;
};

/** Tous les utilisateurs (actifs en priorité) — pour assigner un dossier à un agent. */
export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("user_id, full_name, email, actif")
        .order("full_name", { ascending: true });
      if (!cancelled) {
        setAgents((data ?? []) as Agent[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { agents, loading };
}

/** Helper pour afficher un nom lisible. */
export function agentLabel(agent: Agent | undefined | null): string {
  if (!agent) return "—";
  return agent.full_name?.trim() || agent.email.split("@")[0];
}

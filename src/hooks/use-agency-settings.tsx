import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import type { AgencySettings } from "@/lib/agency-settings";

type Ctx = {
  settings: AgencySettings | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AgencyCtx = createContext<Ctx | null>(null);

export function AgencySettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AgencySettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("agency_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setSettings((data as unknown as AgencySettings) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <AgencyCtx.Provider value={{ settings, loading, refresh: load }}>
      {children}
    </AgencyCtx.Provider>
  );
}

export function useAgencySettings() {
  const c = useContext(AgencyCtx);
  if (!c) throw new Error("useAgencySettings must be used within AgencySettingsProvider");
  return c;
}

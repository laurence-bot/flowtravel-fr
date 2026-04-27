import logoSrc from "@/assets/logo.png";
import { cn } from "@/lib/utils";
import { useAgencySettings } from "@/hooks/use-agency-settings";

export function Logo({
  variant = "light",
  showText = true,
  className,
}: {
  variant?: "light" | "dark";
  showText?: boolean;
  className?: string;
}) {
  const textColor = variant === "light" ? "text-sidebar-foreground" : "text-foreground";
  const accentColor = "text-[color:var(--gold)]";

  // Agency settings may be unavailable (e.g. on the auth page when not logged in)
  let agencyLogo: string | null = null;
  let agencyName: string | null = null;
  try {
    const ctx = useAgencySettings();
    agencyLogo = ctx.settings?.logo_url ?? null;
    agencyName = ctx.settings?.agency_name ?? null;
  } catch {
    // no provider, fall back to defaults
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src={agencyLogo || logoSrc}
        alt={agencyName || "FlowTravel"}
        width={36}
        height={36}
        className="h-9 w-9 object-contain"
        loading="lazy"
      />
      {showText && (
        <div className="leading-tight">
          <div className={cn("font-display text-lg tracking-wide", textColor)}>
            {agencyName || "FlowTravel"}
          </div>
          <div className={cn("text-[10px] uppercase tracking-[0.25em]", accentColor)}>
            {agencyName ? "Powered by Flow Travel" : "Travel Operating System"}
          </div>
        </div>
      )}
    </div>
  );
}

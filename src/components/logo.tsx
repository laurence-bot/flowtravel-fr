import { cn } from "@/lib/utils";
import { useAgencySettings } from "@/hooks/use-agency-settings";

function ArrowMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M10 34 L54 12 L40 54 L32 36 Z" />
      <path d="M10 34 L32 36" />
      <path d="M32 36 L54 12" opacity={0.55} />
    </svg>
  );
}

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
  const taglineColor = variant === "light" ? "text-sidebar-foreground/60" : "text-muted-foreground";

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
      {agencyLogo ? (
        <img
          src={agencyLogo}
          alt={agencyName || "FlowTravel"}
          className="h-12 w-12 object-contain"
          loading="lazy"
        />
      ) : (
        <ArrowMark className="h-10 w-10 text-[color:var(--gold)]" />
      )}
      {showText && (
        <div className="leading-tight">
          <div
            className={cn(
              "font-display text-[24px] tracking-[0.01em] leading-none",
              textColor,
            )}
          >
            {agencyName || "FlowTravel"}
          </div>
          <div
            className={cn(
              "text-[10px] uppercase tracking-[0.32em] mt-1.5",
              taglineColor,
            )}
          >
            {agencyName ? "Powered by FlowTravel" : "Travel Operating System"}
          </div>
        </div>
      )}
    </div>
  );
}

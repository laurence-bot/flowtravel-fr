import logoSrc from "@/assets/logo.png";
import { cn } from "@/lib/utils";

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
  const accentColor = variant === "light" ? "text-[color:var(--gold)]" : "text-[color:var(--gold)]";
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src={logoSrc}
        alt="FlowTravel"
        width={36}
        height={36}
        className="h-9 w-9 object-contain"
        loading="lazy"
      />
      {showText && (
        <div className="leading-tight">
          <div className={cn("font-display text-lg tracking-wide", textColor)}>
            FlowTravel
          </div>
          <div className={cn("text-[10px] uppercase tracking-[0.25em]", accentColor)}>
            Travel Operating System
          </div>
        </div>
      )}
    </div>
  );
}

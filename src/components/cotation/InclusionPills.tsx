import type { Inclusions, InclusionKey } from "@/lib/quote-public";
import { INCLUSION_CONFIG } from "@/lib/detect-inclusions";
import {
  Plane, Hotel, Coffee, UtensilsCrossed, User,
  Car, Map, Ticket, X, Check,
} from "lucide-react";
import type { ReactNode } from "react";

const ICONS: Record<string, ReactNode> = {
  plane:    <Plane className="h-3 w-3" />,
  hotel:    <Hotel className="h-3 w-3" />,
  coffee:   <Coffee className="h-3 w-3" />,
  utensils: <UtensilsCrossed className="h-3 w-3" />,
  user:     <User className="h-3 w-3" />,
  car:      <Car className="h-3 w-3" />,
  map:      <Map className="h-3 w-3" />,
  ticket:   <Ticket className="h-3 w-3" />,
};

type Props = {
  inclusions: Inclusions | null;
  /** Mode compact = back-office, mode full = page client */
  variant?: "compact" | "full";
};

export function InclusionPills({ inclusions, variant = "compact" }: Props) {
  if (!inclusions || Object.keys(inclusions).length === 0) return null;

  const entries = Object.entries(inclusions) as Array<[InclusionKey, boolean]>;
  const included = entries.filter(([, v]) => v === true);
  const excluded = entries.filter(([, v]) => v === false);

  if (included.length === 0 && excluded.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {included.map(([key]) => {
        const cfg = INCLUSION_CONFIG[key];
        const isVol = key.startsWith("vol_");
        const tone = isVol
          ? "bg-blue-500/10 text-blue-700 border-blue-500/30"
          : "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
        return (
          <span
            key={key}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${tone}`}
          >
            {ICONS[cfg.icon]}
            <span>{cfg.label}</span>
            {variant === "full" && <Check className="h-3 w-3" />}
          </span>
        );
      })}
      {excluded.map(([key]) => {
        const cfg = INCLUSION_CONFIG[key];
        return (
          <span
            key={key}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border bg-muted text-muted-foreground border-border line-through"
            title="Non inclus"
          >
            {ICONS[cfg.icon]}
            <span>{cfg.label}</span>
            {variant === "full" && <X className="h-3 w-3" />}
          </span>
        );
      })}
    </div>
  );
}

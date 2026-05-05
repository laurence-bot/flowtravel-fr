import { Switch } from "@/components/ui/switch";
import type { Inclusions, InclusionKey } from "@/lib/quote-public";
import { INCLUSION_CONFIG } from "@/lib/detect-inclusions";
import {
  Plane, Hotel, Coffee, UtensilsCrossed,
  User, Car, Map, Ticket,
} from "lucide-react";
import type { ReactNode } from "react";

const ICONS: Record<string, ReactNode> = {
  plane:    <Plane className="h-4 w-4" />,
  hotel:    <Hotel className="h-4 w-4" />,
  coffee:   <Coffee className="h-4 w-4" />,
  utensils: <UtensilsCrossed className="h-4 w-4" />,
  user:     <User className="h-4 w-4" />,
  car:      <Car className="h-4 w-4" />,
  map:      <Map className="h-4 w-4" />,
  ticket:   <Ticket className="h-4 w-4" />,
};

const ORDERED_KEYS: InclusionKey[] = [
  "vol_international", "vol_domestique", "hebergement",
  "petit_dejeuner", "dejeuner", "diner",
  "guide", "transfert", "location_voiture",
  "excursion", "entrees",
];

type Props = {
  inclusions: Inclusions | null;
  onChange: (updated: Inclusions) => void;
};

export function InclusionToggles({ inclusions, onChange }: Props) {
  const current = inclusions ?? {};

  const toggle = (key: InclusionKey) => {
    const val = current[key];
    // Cycle : undefined → true → false → undefined
    const next: boolean | undefined =
      val === undefined ? true :
      val === true ? false : undefined;
    const updated: Inclusions = { ...current };
    if (next === undefined) delete updated[key];
    else updated[key] = next;
    onChange(updated);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
      {ORDERED_KEYS.map((key) => {
        const cfg = INCLUSION_CONFIG[key];
        const val = current[key];
        return (
          <div
            key={key}
            className="flex items-center justify-between gap-2 px-2 py-1.5 rounded border bg-card/50"
          >
            <button
              type="button"
              onClick={() => toggle(key)}
              className="flex items-center gap-2 text-sm flex-1 text-left min-w-0"
            >
              <span className="text-muted-foreground shrink-0">{ICONS[cfg.icon]}</span>
              <span className={`truncate ${val === false ? "line-through text-muted-foreground" : ""}`}>
                {cfg.label}
              </span>
              {val === undefined && (
                <span className="text-[9px] uppercase tracking-wide text-muted-foreground/60 shrink-0">
                  auto
                </span>
              )}
            </button>
            <Switch
              checked={val === true}
              onCheckedChange={() => toggle(key)}
              className={val === undefined ? "opacity-30" : ""}
            />
          </div>
        );
      })}
    </div>
  );
}

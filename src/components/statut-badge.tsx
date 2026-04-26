import { Badge } from "@/components/ui/badge";
import type { Dossier } from "@/hooks/use-data";

const config: Record<Dossier["statut"], { label: string; className: string }> = {
  brouillon: {
    label: "Brouillon",
    className: "bg-muted text-muted-foreground border-transparent",
  },
  confirme: {
    label: "Confirmé",
    className: "bg-[color:var(--margin)]/12 text-[color:var(--margin)] border-[color:var(--margin)]/20",
  },
  cloture: {
    label: "Clôturé",
    className: "bg-primary/10 text-primary border-primary/15",
  },
};

export function StatutBadge({ statut }: { statut: Dossier["statut"] }) {
  const c = config[statut];
  return (
    <Badge variant="outline" className={`font-medium ${c.className}`}>
      {c.label}
    </Badge>
  );
}

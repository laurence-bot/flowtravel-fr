import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import {
  Sparkles, ShieldCheck, MessageSquare, AlertTriangle, Video,
  Wrench, ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/ops/")({
  head: () => ({
    meta: [{ title: "FlowTravel OPS — Espace pilotage" }],
  }),
  component: OpsDashboard,
});

const sections = [
  {
    to: "/ops/dashboard",
    label: "Tableau de bord",
    desc: "Vue d'ensemble plateforme : agences, agents, alertes",
    icon: Sparkles,
  },
  {
    to: "/ops/agences",
    label: "Validation agences",
    desc: "Approuver ou refuser les nouvelles inscriptions d'agences",
    icon: ShieldCheck,
  },
  {
    to: "/ops/messages",
    label: "Messagerie support",
    desc: "Échanges avec les agences clientes",
    icon: MessageSquare,
  },
  {
    to: "/ops/errors",
    label: "Journal d'erreurs",
    desc: "Erreurs runtime remontées par les utilisateurs",
    icon: AlertTriangle,
  },
  {
    to: "/ops/demos",
    label: "Démos prospects",
    desc: "Liens de démo personnalisés et rendez-vous visio",
    icon: Video,
  },
];

function OpsDashboard() {
  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[color:var(--gold)]/10 border border-[color:var(--gold)]/30 text-[10px] uppercase tracking-[0.2em] text-[color:var(--gold)] font-semibold">
          <Wrench className="h-3 w-3" />
          FlowTravel OPS
        </div>
        <h1 className="font-display text-3xl text-foreground">
          Votre espace de pilotage personnel
        </h1>
        <p className="text-muted-foreground text-sm max-w-2xl">
          Cette zone est réservée à votre usage. Elle regroupe tous les outils de pilotage de
          la plateforme FlowTravel — invisible pour les agences clientes.
        </p>
      </header>

      <section>
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-4">
          Outils disponibles
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <Link key={s.to} to={s.to} className="group">
                <Card className="p-5 h-full transition-all hover:border-[color:var(--gold)] hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="p-2 rounded-md bg-[color:var(--gold)]/10">
                      <Icon className="h-5 w-5 text-[color:var(--gold)]" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-[color:var(--gold)] group-hover:translate-x-1 transition-all" />
                  </div>
                  <div className="mt-4 space-y-1">
                    <div className="font-display text-base text-foreground">{s.label}</div>
                    <div className="text-xs text-muted-foreground leading-relaxed">{s.desc}</div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-4">
          Vos prochains outils
        </h2>
        <Card className="p-8 border-dashed text-center">
          <Wrench className="h-6 w-6 mx-auto text-muted-foreground/40 mb-3" />
          <div className="text-sm text-muted-foreground">
            Cet espace est prêt à accueillir vos futurs outils personnels :
            pilotage MRR, vue clients SaaS, statistiques d'usage, intégrations…
          </div>
          <div className="mt-3 text-xs text-muted-foreground/60 italic">
            Dites-moi simplement « OPS : ... » pour ajouter une fonctionnalité ici.
          </div>
        </Card>
      </section>
    </div>
  );
}

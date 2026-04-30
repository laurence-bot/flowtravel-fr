import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Logo } from "@/components/logo";
import { Check } from "lucide-react";

export const Route = createFileRoute("/tarifs")({
  component: TarifsPage,
  head: () => ({
    meta: [
      { title: "Tarifs FlowTravel — La solution tout-en-un pour agences de voyages" },
      {
        name: "description",
        content:
          "À partir de 9€ HT/mois. Cotations, dossiers, marges, FX, rapprochement bancaire. Toutes les fonctionnalités essentielles pour piloter votre agence de voyages.",
      },
    ],
  }),
});

type Plan = {
  id: string;
  nom: string;
  baseline: string;
  prix_mensuel: number;
  prix_annuel_mensuel: number;
  cible: string;
  features: string[];
  highlight?: boolean;
  cta: string;
};

const PLANS: Plan[] = [
  {
    id: "carnet",
    nom: "Le Carnet",
    baseline: "Pour l'agent qui démarre seul",
    prix_mensuel: 9,
    prix_annuel_mensuel: 7,
    cible: "1 utilisateur",
    cta: "Voir la démo",
    features: [
      "Gestion CRM (clients, fournisseurs)",
      "Cotations multi-jours illimitées",
      "Calculateur de marge automatique",
      "Lien public client (validation devis)",
      "Tableau de bord pilotage",
      "Support email",
    ],
  },
  {
    id: "atelier",
    nom: "L'Atelier",
    baseline: "Pour l'agence qui structure son métier",
    prix_mensuel: 49,
    prix_annuel_mensuel: 39,
    cible: "Jusqu'à 3 utilisateurs · +15€/user supplémentaire",
    cta: "Voir la démo",
    highlight: true,
    features: [
      "Tout du Carnet, plus :",
      "Gestion FX & couvertures de change",
      "TVA sur marge (UE) / Hors UE automatique",
      "Import PDF intelligent (factures, vols)",
      "Gestion des dossiers & tâches",
      "Échéances & paiements fournisseurs",
      "Support prioritaire",
    ],
  },
  {
    id: "maison",
    nom: "La Maison",
    baseline: "Pour l'agence qui veut tout piloter",
    prix_mensuel: 79,
    prix_annuel_mensuel: 63,
    cible: "Utilisateurs illimités",
    cta: "Voir la démo",
    features: [
      "Tout de l'Atelier, plus :",
      "Rapprochement bancaire automatique",
      "Prévisions de trésorerie",
      "Export comptable",
      "Gestion fine des rôles & permissions",
      "Personnalisation marque (logo, couleurs)",
      "Sous-domaine personnalisé",
      "Support dédié & onboarding",
    ],
  },
];

function TarifsPage() {
  const [annuel, setAnnuel] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      {/* Header public */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/">
            <Logo variant="dark" />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/auth"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Connexion
            </Link>
            <Button asChild size="sm">
              <Link to="/demo">Voir la démo</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="inline-flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[color:var(--ocre)]">
          <span className="inline-block h-px w-6 bg-[color:var(--ocre)]/60" />
          Travel Operating System
          <span className="inline-block h-px w-6 bg-[color:var(--ocre)]/60" />
        </div>
        <h1 className="font-display text-5xl md:text-6xl mt-6 text-foreground">
          Des tarifs pensés pour les agences,
          <br />
          <span className="text-[color:var(--gold)]">pas pour les éditeurs.</span>
        </h1>
        <p className="text-lg text-muted-foreground mt-6 max-w-2xl mx-auto">
          Plus de fonctionnalités que la concurrence, à un prix plus juste. Sans engagement, sans
          surprise.
        </p>

        {/* Toggle facturation */}
        <div className="mt-10 inline-flex items-center gap-4 rounded-full border border-border bg-card px-6 py-3">
          <span
            className={`text-sm font-medium transition-colors ${
              !annuel ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Mensuel
          </span>
          <Switch checked={annuel} onCheckedChange={setAnnuel} />
          <span
            className={`text-sm font-medium transition-colors ${
              annuel ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Annuel
          </span>
          <span className="rounded-full bg-[color:var(--gold)]/15 px-2.5 py-0.5 text-xs font-semibold text-[color:var(--gold)]">
            -20%
          </span>
        </div>
      </section>

      {/* Manifeste — pourquoi FlowTravel existe */}
      <section className="container mx-auto px-4 pb-16">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[color:var(--ocre)]">
            <span className="inline-block h-px w-6 bg-[color:var(--ocre)]/60" />
            Notre histoire
            <span className="inline-block h-px w-6 bg-[color:var(--ocre)]/60" />
          </div>
          <h2 className="font-display text-3xl md:text-4xl mt-6 text-foreground">
            Pensé par un agent de voyages sur mesure,
            <br />
            <span className="text-[color:var(--gold)]">pas par un éditeur de logiciel.</span>
          </h2>
          <div className="mt-8 space-y-5 text-left text-foreground/80 leading-relaxed">
            <p>
              FlowTravel est né dans une vraie agence. Après <strong>plus de 20 ans</strong> à
              concevoir des voyages sur mesure, son fondateur en avait assez de jongler entre un
              CRM, un tableur de marges, un autre pour les changes, un dossier partagé pour les
              factures fournisseurs, un module bancaire qui ne parle à personne, et trois outils
              qui se contredisent en fin de mois.
            </p>
            <p>
              Aucun logiciel du marché ne pensait <em>vraiment</em> métier&nbsp;: la TVA sur marge,
              les couvertures de change, les acomptes fournisseurs en USD, les paiements partiels,
              le rapprochement bancaire, la cotation multi-jours qui devient un dossier qui devient
              une facture… tout était toujours à rebricoler à la main.
            </p>
            <p>
              C'est pour ça que FlowTravel existe&nbsp;: <strong>une seule plateforme</strong>,
              pensée du devis au rapprochement bancaire, par quelqu'un qui a vécu chaque problème
              de l'intérieur. Pas un outil de plus. L'outil qui les remplace tous.
            </p>
          </div>
        </div>
      </section>

      {/* Cards tarifs */}
      <section className="container mx-auto px-4 pb-20">
        <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
          {PLANS.map((plan) => {
            const prix = annuel ? plan.prix_annuel_mensuel : plan.prix_mensuel;
            return (
              <Card
                key={plan.id}
                className={`relative p-8 flex flex-col ${
                  plan.highlight
                    ? "border-[color:var(--gold)] shadow-xl shadow-[color:var(--gold)]/10 scale-[1.02]"
                    : "border-border"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[color:var(--gold)] px-4 py-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--primary)]">
                    Le plus choisi
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="font-display text-2xl text-foreground">{plan.nom}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{plan.baseline}</p>
                </div>

                <div className="mb-2">
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-5xl text-[color:var(--gold)]">
                      {prix}€
                    </span>
                    <span className="text-sm text-muted-foreground">HT/mois</span>
                  </div>
                  {annuel && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Soit {prix * 12}€ HT facturé annuellement
                    </p>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mb-6">{plan.cible}</p>

                <Button
                  asChild
                  className="w-full mb-6"
                  variant={plan.highlight ? "default" : "outline"}
                >
                  <Link to="/demo">{plan.cta}</Link>
                </Button>

                <ul className="space-y-3 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-[color:var(--gold)] mt-0.5 flex-shrink-0" />
                      <span className="text-foreground/80">{f}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>

        {/* Section différenciation */}
        <div className="max-w-4xl mx-auto mt-20 text-center">
          <h2 className="font-display text-3xl text-foreground">
            Ce que vous ne trouverez nulle part ailleurs
          </h2>
          <p className="text-muted-foreground mt-3">
            FlowTravel intègre des fonctionnalités exclusives, pensées pour les vraies
            problématiques des agences de voyages.
          </p>
          <div className="grid md:grid-cols-2 gap-4 mt-10 text-left">
            {[
              {
                t: "Gestion FX & couvertures de change",
                d: "Pilotez vos achats en USD, GBP, ZAR avec des couvertures dédiées.",
              },
              {
                t: "TVA sur marge automatique",
                d: "Calcul automatique selon la destination (UE / Hors UE).",
              },
              {
                t: "Rapprochement bancaire",
                d: "Import CSV banque et matching automatique des paiements.",
              },
              {
                t: "Import PDF intelligent",
                d: "Extraction automatique des factures fournisseurs et confirmations vols.",
              },
            ].map((item, i) => (
              <div key={i} className="p-5 rounded-lg border border-border bg-card">
                <div className="font-semibold text-foreground">{item.t}</div>
                <div className="text-sm text-muted-foreground mt-1">{item.d}</div>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <Button asChild size="lg">
              <Link to="/demo">Demander la démo gratuite</Link>
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              Démo confidentielle · Sans engagement · Sans CB demandée
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} FlowTravel · Travel Operating System
        </div>
      </footer>
    </div>
  );
}

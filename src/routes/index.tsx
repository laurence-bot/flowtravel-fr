import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { useAuth } from "@/hooks/use-auth";
import {
  Check,
  Wallet,
  PiggyBank,
  Globe,
  Shield,
  LineChart,
  FileText,
  Plane,
  Receipt,
  Landmark,
  Users,
  ArrowRight,
  Star,
  Zap,
  Lock,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import heroImg from "@/assets/hero-dashboard.jpg";

const SITE_URL = "https://flowtravel.fr";
const OG_IMAGE = `${SITE_URL}/og-flowtravel.jpg`;

const PAGE_TITLE =
  "FlowTravel — Logiciel de gestion pour agences de voyages | Cotations, marges, FX, trésorerie";
const PAGE_DESC =
  "FlowTravel est le logiciel tout-en-un des agences de voyages : cotations multi-jours, calcul de marges, TVA sur marge, gestion FX, rapprochement bancaire et trésorerie. À partir de 9€/mois.";

const KEYWORDS = [
  "logiciel agence de voyages",
  "logiciel tour-opérateur",
  "logiciel TO",
  "CRM agence de voyages",
  "gestion agence de voyages",
  "cotation voyage sur mesure",
  "TVA sur marge agence de voyages",
  "marge agence de voyages",
  "rapprochement bancaire voyages",
  "couverture de change agence",
  "FX agence de voyages",
  "FlowTravel",
  "Travel Operating System",
  "logiciel devis voyage",
  "ERP agence de voyages",
  "back office tour-opérateur",
];

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: PAGE_TITLE },
      { name: "description", content: PAGE_DESC },
      { name: "keywords", content: KEYWORDS.join(", ") },
      { name: "author", content: "FlowTravel" },
      { name: "robots", content: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" },
      { name: "googlebot", content: "index, follow" },
      { name: "language", content: "French" },
      { name: "geo.region", content: "FR" },
      { name: "geo.placename", content: "France" },
      { property: "og:locale", content: "fr_FR" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
      { property: "og:site_name", content: "FlowTravel" },
      { property: "og:title", content: PAGE_TITLE },
      { property: "og:description", content: PAGE_DESC },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "FlowTravel — Travel Operating System" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: PAGE_TITLE },
      { name: "twitter:description", content: PAGE_DESC },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": `${SITE_URL}/#organization`,
              name: "FlowTravel",
              url: SITE_URL,
              logo: `${SITE_URL}/favicon.svg`,
              description: PAGE_DESC,
              areaServed: "FR",
              sameAs: [],
            },
            {
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              url: SITE_URL,
              name: "FlowTravel",
              inLanguage: "fr-FR",
              publisher: { "@id": `${SITE_URL}/#organization` },
            },
            {
              "@type": "SoftwareApplication",
              name: "FlowTravel",
              applicationCategory: "BusinessApplication",
              applicationSubCategory: "Travel Agency Software",
              operatingSystem: "Web",
              description: PAGE_DESC,
              url: SITE_URL,
              offers: [
                {
                  "@type": "Offer",
                  name: "Starter",
                  price: "9",
                  priceCurrency: "EUR",
                  priceSpecification: {
                    "@type": "UnitPriceSpecification",
                    price: "9",
                    priceCurrency: "EUR",
                    unitText: "MONTH",
                  },
                },
                {
                  "@type": "Offer",
                  name: "Studio",
                  price: "49",
                  priceCurrency: "EUR",
                },
                {
                  "@type": "Offer",
                  name: "Synergy",
                  price: "79",
                  priceCurrency: "EUR",
                },
              ],
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: "4.9",
                reviewCount: "27",
              },
            },
            {
              "@type": "FAQPage",
              mainEntity: [
                {
                  "@type": "Question",
                  name: "Qu'est-ce que FlowTravel ?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "FlowTravel est un logiciel SaaS de gestion tout-en-un pour les agences de voyages et tour-opérateurs : cotations sur mesure, calcul de marges, TVA sur marge, gestion FX, trésorerie et rapprochement bancaire.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Combien coûte FlowTravel ?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "FlowTravel démarre à 9€ HT/mois pour le plan Starter (1 utilisateur). Le plan Studio est à 49€/mois (jusqu'à 3 utilisateurs) et Synergy à 79€/mois (utilisateurs illimités).",
                  },
                },
                {
                  "@type": "Question",
                  name: "FlowTravel gère-t-il la TVA sur marge ?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Oui. FlowTravel calcule automatiquement la TVA sur marge selon le régime des agences de voyages (UE / Hors UE), avec ventilation par destination.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Puis-je gérer mes achats en devises (USD, GBP, ZAR) ?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Oui, FlowTravel propose un module FX complet : couvertures de change, réservations, calcul de P&L FX et optimisation par dossier.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Y a-t-il un engagement ?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Non. Tous les abonnements FlowTravel sont sans engagement, résiliables à tout moment.",
                  },
                },
              ],
            },
          ],
        }),
      },
    ],
  }),
});

function HomePage() {
  const { session, loading } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Si déjà connecté, on l'envoie sur son dashboard
  if (!loading && session) return <Navigate to="/app" />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* HEADER */}
      <header
        className={`sticky top-0 z-50 border-b transition-all ${
          scrolled
            ? "border-border/60 bg-background/85 backdrop-blur-md"
            : "border-transparent bg-background/0"
        }`}
      >
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/" aria-label="Accueil FlowTravel">
            <Logo variant="dark" />
          </Link>
          <nav aria-label="Navigation principale" className="hidden md:flex items-center gap-7 text-sm">
            <a href="#fonctionnalites" className="text-muted-foreground hover:text-foreground transition-colors">
              Fonctionnalités
            </a>
            <a href="#pourquoi" className="text-muted-foreground hover:text-foreground transition-colors">
              Pourquoi FlowTravel
            </a>
            <Link to="/tarifs" className="text-muted-foreground hover:text-foreground transition-colors">
              Tarifs
            </Link>
            <a href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              to="/auth"
              className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Connexion
            </Link>
            <Button asChild size="sm">
              <Link to="/demo">Voir la démo</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-40"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 0%, color-mix(in oklab, var(--gold) 18%, transparent), transparent 70%)",
          }}
        />
        <div className="container mx-auto px-4 pt-16 pb-12 md:pt-24 md:pb-16">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-[color:var(--ocre)]">
              <span className="inline-block h-px w-6 bg-[color:var(--ocre)]/60" />
              Travel Operating System
              <span className="inline-block h-px w-6 bg-[color:var(--ocre)]/60" />
            </div>
            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl mt-7 leading-[1.05] text-foreground">
              Le logiciel des
              <br />
              <em className="not-italic text-[color:var(--ocre)]">agences de voyages</em>
              <br />
              <span className="text-foreground/80">qui aiment leur métier.</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground mt-7 max-w-2xl mx-auto leading-relaxed">
              Cotations sur-mesure, marges, TVA sur marge, gestion des devises, rapprochement
              bancaire et trésorerie. Une seule plateforme, pensée pour le métier — sans
              dispersion d'outils.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="px-7">
                <Link to="/demo">
                  Demander la démo <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/tarifs">Voir les tarifs</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-5">
              À partir de <strong className="text-foreground">9€ HT/mois</strong> · Sans engagement
              · Sans CB demandée
            </p>
          </div>

          {/* Hero image — carte signature ivoire */}
          <div className="mt-16 mx-auto max-w-5xl">
            <div className="relative rounded-sm overflow-hidden border border-border bg-card">
              <img
                src={heroImg}
                alt="FlowTravel — logiciel de gestion pour agences de voyages"
                width={1600}
                height={1024}
                className="w-full h-auto"
                fetchPriority="high"
              />
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF / TRUST BAR */}
      <section aria-label="Preuves sociales" className="border-y border-border/40 bg-secondary/20">
        <div className="container mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { v: "9€", l: "à partir de / mois" },
            { v: "100%", l: "TVA sur marge auto" },
            { v: "0€", l: "frais d'installation" },
            { v: "4.9/5", l: "satisfaction client" },
          ].map((s) => (
            <div key={s.l}>
              <div className="font-display text-2xl md:text-3xl text-[color:var(--gold)]">{s.v}</div>
              <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FONCTIONNALITÉS */}
      <section id="fonctionnalites" className="container mx-auto px-4 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <div className="text-[10px] uppercase tracking-[0.32em] text-[color:var(--ocre)]">
            Fonctionnalités
          </div>
          <h2 className="font-display text-3xl md:text-5xl mt-4">
            Une plateforme. Toute votre agence.
          </h2>
          <p className="text-muted-foreground mt-4">
            FlowTravel couvre l'ensemble du cycle commercial et financier d'une agence de voyages,
            de la première demande client jusqu'à la clôture comptable.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
          {[
            {
              i: FileText,
              t: "Cotations multi-jours sur mesure",
              d: "Construisez des devis riches : itinéraire jour par jour, photos, hébergements, fournisseurs, options. Lien public client pour validation en un clic.",
            },
            {
              i: PiggyBank,
              t: "Calcul de marge automatique",
              d: "Marge brute, marge nette, % de marge en temps réel. Plus jamais de mauvaise surprise sur un dossier.",
            },
            {
              i: Receipt,
              t: "TVA sur marge UE / Hors UE",
              d: "Calcul automatique selon le régime des agences de voyages, avec ventilation par destination.",
            },
            {
              i: Globe,
              t: "Gestion FX & couvertures",
              d: "Pilotez vos achats en USD, GBP, ZAR et autres devises. Couvertures, réservations, P&L FX par dossier.",
            },
            {
              i: Wallet,
              t: "Trésorerie consolidée",
              d: "Vision multi-comptes en temps réel, prévisions à 30 jours, alertes de point bas et engagements à venir.",
            },
            {
              i: Landmark,
              t: "Rapprochement bancaire",
              d: "Importez vos relevés CSV, FlowTravel suggère les rapprochements. Vous validez en quelques minutes.",
            },
            {
              i: Plane,
              t: "Import PDF intelligent",
              d: "Extraction automatique des factures fournisseurs, des confirmations vols et des segments aériens.",
            },
            {
              i: Users,
              t: "CRM clients & fournisseurs",
              d: "Centralisez vos contacts, conditions fournisseurs, historiques et communications. Une mémoire d'agence.",
            },
            {
              i: LineChart,
              t: "Pilotage & reporting",
              d: "Tableau de bord exécutif, exports comptables, journal d'audit. Décidez sur la donnée, pas l'intuition.",
            },
          ].map((f) => (
            <Card key={f.t} className="p-6 border-border/60 hover:border-[color:var(--gold)]/40 transition-colors">
              <div className="h-10 w-10 rounded-md flex items-center justify-center bg-[color:var(--gold)]/10 text-[color:var(--gold)] mb-4">
                <f.i className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg">{f.t}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.d}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* POURQUOI FLOWTRAVEL */}
      <section id="pourquoi" className="bg-secondary/20 border-y border-border/40">
        <div className="container mx-auto px-4 py-20">
          <div className="text-center max-w-2xl mx-auto">
            <div className="text-[10px] uppercase tracking-[0.32em] text-[color:var(--ocre)]">
              Pourquoi FlowTravel
            </div>
            <h2 className="font-display text-3xl md:text-5xl mt-4">
              Conçu par et pour des professionnels du voyage.
            </h2>
            <p className="text-muted-foreground mt-4">
              Là où les ERP généralistes vous font plier votre métier, FlowTravel parle votre
              langue : devis sur mesure, marge fournisseur, change, déadlines d'options.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-12 max-w-5xl mx-auto">
            {[
              {
                i: Zap,
                t: "5× plus rapide qu'un tableur",
                d: "Vos cotations passent de l'heure au quart d'heure. Réutilisation des blocs, automatisations partout.",
              },
              {
                i: Shield,
                t: "Vos données sont à vous",
                d: "Hébergement européen, RGPD, sauvegardes quotidiennes. Export à tout moment.",
              },
              {
                i: Star,
                t: "Pensé agences indépendantes",
                d: "Pas un mastodonte fait pour les groupes. Un outil rapide, élégant, qui respecte votre marge.",
              },
              {
                i: Lock,
                t: "Sécurité bancaire",
                d: "Authentification forte, rôles & permissions granulaires, journal d'audit complet.",
              },
            ].map((f) => (
              <div key={f.t} className="flex gap-4">
                <div className="h-11 w-11 rounded-md flex items-center justify-center bg-[color:var(--gold)]/10 text-[color:var(--gold)] shrink-0">
                  <f.i className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{f.t}</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <div className="text-[10px] uppercase tracking-[0.32em] text-[color:var(--ocre)]">
            En 4 étapes
          </div>
          <h2 className="font-display text-3xl md:text-5xl mt-4">
            De la demande client à la facture finale.
          </h2>
        </div>

        <div className="grid md:grid-cols-4 gap-6 mt-12">
          {[
            { n: "01", t: "Recevez la demande", d: "Centralisez vos demandes clients dans une boîte de réception unique." },
            { n: "02", t: "Construisez le devis", d: "Cotation jour par jour, fournisseurs, options de change, marge en temps réel." },
            { n: "03", t: "Le client valide", d: "Lien web sécurisé, validation en un clic, suivi des ouvertures." },
            { n: "04", t: "Pilotez le dossier", d: "Tâches, paiements, rapprochement, clôture comptable. Tout au même endroit." },
          ].map((s) => (
            <div key={s.n} className="relative">
              <div className="font-display text-5xl text-[color:var(--gold)]/40">{s.n}</div>
              <h3 className="font-semibold text-lg mt-2">{s.t}</h3>
              <p className="text-sm text-muted-foreground mt-2">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TARIFS RÉSUMÉ */}
      <section className="bg-secondary/20 border-y border-border/40">
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="text-[10px] uppercase tracking-[0.32em] text-[color:var(--ocre)]">Tarifs</div>
          <h2 className="font-display text-3xl md:text-5xl mt-4">À partir de 9€ HT/mois.</h2>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
            Trois plans pensés pour suivre votre croissance — de l'agent indépendant à l'agence
            établie. Sans engagement.
          </p>

          <div className="grid sm:grid-cols-3 gap-4 mt-12 max-w-3xl mx-auto">
            {[
              { n: "Starter", p: "9€", d: "L'agent indépendant" },
              { n: "Studio", p: "49€", d: "La petite agence ambitieuse", h: true },
              { n: "Synergy", p: "79€", d: "L'agence établie" },
            ].map((p) => (
              <Card
                key={p.n}
                className={`p-6 ${p.h ? "border-[color:var(--gold)]" : "border-border/60"}`}
              >
                <div className="font-display text-xl">{p.n}</div>
                <div className="font-display text-4xl text-[color:var(--gold)] mt-2">{p.p}</div>
                <div className="text-xs text-muted-foreground mt-1">HT / mois</div>
                <div className="text-sm text-muted-foreground mt-3">{p.d}</div>
              </Card>
            ))}
          </div>

          <div className="mt-10">
            <Button asChild size="lg">
              <Link to="/tarifs">
                Comparer les plans <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* DÉMO */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto rounded-sm border border-border bg-card p-10 md:p-14 text-center">
          <div className="inline-flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[color:var(--ocre)]">
            <span className="inline-block h-px w-6 bg-[color:var(--ocre)]/60" />
            Démo confidentielle
            <span className="inline-block h-px w-6 bg-[color:var(--ocre)]/60" />
          </div>
          <h2 className="font-display text-3xl md:text-5xl mt-6">
            Voyez FlowTravel en action.
          </h2>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
            Une démo vidéo de 8 minutes, réservée aux professionnels du voyage. Aucun appel
            commercial imposé.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="px-7">
              <Link to="/demo">
                Accéder à la démo <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Déjà client ? Se connecter</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-secondary/20 border-y border-border/40">
        <div className="container mx-auto px-4 py-20 max-w-3xl">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.32em] text-[color:var(--ocre)]">FAQ</div>
            <h2 className="font-display text-3xl md:text-5xl mt-4">Vos questions, nos réponses.</h2>
          </div>

          <div className="mt-12 space-y-4">
            {[
              {
                q: "Qu'est-ce que FlowTravel exactement ?",
                a: "FlowTravel est un logiciel SaaS de gestion tout-en-un pour les agences de voyages et tour-opérateurs. Il couvre les cotations sur mesure, les marges, la TVA sur marge, la gestion des devises (FX), la trésorerie et le rapprochement bancaire.",
              },
              {
                q: "Combien coûte FlowTravel ?",
                a: "À partir de 9€ HT/mois pour le plan Starter (1 utilisateur). Plan Studio à 49€/mois (jusqu'à 3 utilisateurs) et Synergy à 79€/mois (utilisateurs illimités). 20% de réduction en facturation annuelle.",
              },
              {
                q: "Y a-t-il un engagement ?",
                a: "Non. Tous nos abonnements sont sans engagement, résiliables à tout moment depuis votre espace.",
              },
              {
                q: "FlowTravel gère-t-il la TVA sur marge ?",
                a: "Oui, automatiquement. Le régime des agences de voyages est intégré nativement, avec ventilation UE / Hors UE.",
              },
              {
                q: "Mes données sont-elles en sécurité ?",
                a: "Oui. Hébergement européen, RGPD, chiffrement, sauvegardes quotidiennes, journal d'audit. Vous restez propriétaire de vos données et pouvez les exporter à tout moment.",
              },
              {
                q: "Pouvez-vous m'aider à migrer depuis mon ancien outil ?",
                a: "Oui, le plan Synergy inclut un onboarding personnalisé. Nous vous accompagnons dans la migration de vos clients, fournisseurs et dossiers en cours.",
              },
            ].map((f) => (
              <details
                key={f.q}
                className="group rounded-lg border border-border/60 bg-card p-5 [&[open]]:border-[color:var(--gold)]/40"
              >
                <summary className="cursor-pointer list-none flex items-center justify-between gap-3 font-medium">
                  <span>{f.q}</span>
                  <span className="text-[color:var(--gold)] transition-transform group-open:rotate-45 text-xl leading-none">
                    +
                  </span>
                </summary>
                <p className="text-sm text-muted-foreground mt-4 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="container mx-auto px-4 py-24 text-center">
        <h2 className="font-display text-4xl md:text-6xl">
          Prêt à <span className="text-[color:var(--gold)]">piloter</span> votre agence ?
        </h2>
        <p className="text-muted-foreground mt-5 max-w-xl mx-auto">
          Rejoignez les agences de voyages qui ont fait le choix de l'élégance et de la rigueur.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="px-8">
            <Link to="/demo">Demander la démo gratuite</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/tarifs">Voir les tarifs</Link>
          </Button>
        </div>
        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          {["Sans engagement", "Sans CB demandée", "Données européennes", "Support en français"].map(
            (i) => (
              <li key={i} className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-[color:var(--gold)]" /> {i}
              </li>
            ),
          )}
        </ul>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/50 bg-secondary/30">
        <div className="container mx-auto px-4 py-12 grid md:grid-cols-4 gap-8 text-sm">
          <div>
            <Logo variant="dark" />
            <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
              Le système d'exploitation des agences de voyages. Cotations, marges, FX, trésorerie.
            </p>
          </div>
          <div>
            <div className="font-semibold text-foreground mb-3">Produit</div>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <a href="#fonctionnalites" className="hover:text-foreground">Fonctionnalités</a>
              </li>
              <li>
                <Link to="/tarifs" className="hover:text-foreground">Tarifs</Link>
              </li>
              <li>
                <Link to="/demo" className="hover:text-foreground">Démo</Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-foreground mb-3">Compte</div>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <Link to="/auth" className="hover:text-foreground">Connexion</Link>
              </li>
              <li>
                <Link to="/auth" className="hover:text-foreground">Créer un compte</Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-foreground mb-3">Contact</div>
            <ul className="space-y-2 text-muted-foreground text-xs">
              <li className="inline-flex items-center gap-2">
                <Mail className="h-3.5 w-3.5" /> contact@flowtravel.fr
              </li>
              <li className="inline-flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" /> Sur demande
              </li>
              <li className="inline-flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" /> France
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} FlowTravel · Travel Operating System · Tous droits réservés
        </div>
      </footer>
    </div>
  );
}

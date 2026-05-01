import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

const SITE_URL = "https://flowtravel.fr";
const PAGE_TITLE = "FlowTravel — Bientôt disponible";
const PAGE_DESC =
  "FlowTravel, le Travel Operating System dédié aux agences de voyages sur mesure, arrive très bientôt.";

export const Route = createFileRoute("/")({
  component: ComingSoonPage,
  head: () => ({
    meta: [
      { title: PAGE_TITLE },
      { name: "description", content: PAGE_DESC },
      // Désindexation tant que le site n'est pas finalisé
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: PAGE_TITLE },
      { property: "og:description", content: PAGE_DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
  }),
});

function ComingSoonPage() {
  const { session, loading } = useAuth();

  // Si déjà connecté, on l'envoie sur son dashboard
  if (!loading && session) return <Navigate to="/app" />;

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Halo décoratif */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-50"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, color-mix(in oklab, var(--gold) 22%, transparent), transparent 70%)",
        }}
      />

      <div className="container mx-auto flex min-h-screen flex-col px-6 py-10">
        {/* Header minimal */}
        <header className="flex items-center justify-between">
          <Logo variant="dark" />
          <Link
            to="/auth"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Connexion
          </Link>
        </header>

        {/* Contenu central */}
        <section className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="inline-flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[color:var(--ocre)]">
            <span className="inline-block h-px w-8 bg-[color:var(--ocre)]/60" />
            Travel Operating System
            <span className="inline-block h-px w-8 bg-[color:var(--ocre)]/60" />
          </div>

          <h1 className="font-display mt-8 text-5xl leading-[1.05] text-foreground md:text-7xl">
            Bientôt disponible.
          </h1>

          <p className="mt-7 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            FlowTravel, le logiciel dédié aux agences de voyages sur mesure,
            est en cours de finalisation. Une nouvelle façon de piloter votre
            agence arrive très prochainement.
          </p>

          {/* Vidéo de présentation */}
          <div className="mt-12 w-full max-w-4xl">
            <div className="relative overflow-hidden rounded-2xl border border-[color:var(--gold)]/20 bg-black shadow-2xl">
              <div className="aspect-video">
                <video
                  className="h-full w-full"
                  src="https://hgvcvbfdbkbakqxluiys.supabase.co/storage/v1/object/public/demo-videos/flowtravel-16x9-v4.mp4"
                  controls
                  playsInline
                  preload="metadata"
                  aria-label="Présentation FlowTravel"
                />
              </div>
            </div>
            <p className="mt-3 text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Découvrez FlowTravel en 90 secondes
            </p>
          </div>

          {/* Filet décoratif */}
          <div className="mt-10 flex items-center gap-4">
            <span className="block h-px w-16 bg-[color:var(--gold)]/50" />
            <span className="text-[color:var(--gold)]">✦</span>
            <span className="block h-px w-16 bg-[color:var(--gold)]/50" />
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" variant="outline">
              <a href="mailto:contact@flowtravel.fr">Nous contacter</a>
            </Button>
          </div>
        </section>

        {/* Footer minimal */}
        <footer className="pt-10 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} FlowTravel · Travel Operating System
        </footer>
      </div>
    </main>
  );
}

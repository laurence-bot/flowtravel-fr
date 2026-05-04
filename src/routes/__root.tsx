import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider } from "@/hooks/use-auth";
import { RoleProvider } from "@/hooks/use-role";
import { AgencySettingsProvider } from "@/hooks/use-agency-settings";
import { Toaster } from "@/components/ui/sonner";
import { DuplicateConfirmDialog } from "@/lib/duplicate-confirm";
import { installGlobalErrorLogger } from "@/lib/error-logger";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#0b0d12" },
      { name: "format-detection", content: "telephone=no" },
      { title: "FlowTravel — Logiciel de gestion pour agences de voyages" },
      {
        name: "description",
        content:
          "Le logiciel tout-en-un des agences de voyages : cotations, marges, TVA sur marge, FX, trésorerie. À partir de 9€/mois, sans engagement.",
      },
      { name: "author", content: "FlowTravel" },
      { name: "publisher", content: "FlowTravel" },
      { property: "og:site_name", content: "FlowTravel" },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "fr_FR" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "alternate icon", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => { installGlobalErrorLogger(); }, []);
  return (
    <AuthProvider>
      <RoleProvider>
        <AgencySettingsProvider>
          <Outlet />
          <DuplicateConfirmDialog />
          <Toaster richColors position="top-right" />
        </AgencySettingsProvider>
      </RoleProvider>
    </AuthProvider>
  );
}

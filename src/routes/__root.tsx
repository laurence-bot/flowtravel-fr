import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/hooks/use-auth";
import { RoleProvider } from "@/hooks/use-role";
import { Toaster } from "@/components/ui/sonner";

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
      { title: "Cashflow Travel – Pilotage financier agence de voyages" },
      { name: "description", content: "Pilotez la rentabilité, les flux financiers et la trésorerie de votre agence de voyages." },
      { name: "author", content: "Cashflow Travel" },
      { property: "og:title", content: "Cashflow Travel – Pilotage financier agence de voyages" },
      { property: "og:description", content: "Pilotez la rentabilité, les flux financiers et la trésorerie de votre agence de voyages." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Cashflow Travel – Pilotage financier agence de voyages" },
      { name: "twitter:description", content: "Pilotez la rentabilité, les flux financiers et la trésorerie de votre agence de voyages." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0d5a8a53-e3b1-4e47-b7a5-e67feae1b2d0/id-preview-d57a6369--af9a414d-dfc5-4720-8a22-45828934bfaa.lovable.app-1777274864530.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0d5a8a53-e3b1-4e47-b7a5-e67feae1b2d0/id-preview-d57a6369--af9a414d-dfc5-4720-8a22-45828934bfaa.lovable.app-1777274864530.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "alternate icon", href: "/favicon.svg" },
      { rel: "apple-touch-icon", href: "/favicon.svg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
  return (
    <AuthProvider>
      <RoleProvider>
        <Outlet />
        <Toaster richColors position="top-right" />
      </RoleProvider>
    </AuthProvider>
  );
}

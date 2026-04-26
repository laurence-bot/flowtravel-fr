import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, FolderOpen, Wallet, LogOut, Menu, X, Landmark, Upload, Link2, FileDown, LineChart, Compass, ScrollText, UserCog } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { canAccessRoute, ROLE_LABELS } from "@/lib/permissions";
import { ReadOnlyShield } from "@/components/read-only-shield";

const nav = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/pilotage", label: "Pilotage", icon: Compass },
  { to: "/contacts", label: "Clients & Fournisseurs", icon: Users },
  { to: "/dossiers", label: "Dossiers", icon: FolderOpen },
  { to: "/paiements", label: "Paiements", icon: Wallet },
  { to: "/comptes", label: "Comptes & Trésorerie", icon: Landmark },
  { to: "/previsions", label: "Prévisions", icon: LineChart },
  { to: "/import-bancaire", label: "Import bancaire", icon: Upload },
  { to: "/rapprochement", label: "Rapprochement", icon: Link2 },
  { to: "/export", label: "Export comptable", icon: FileDown },
  { to: "/audit", label: "Journal d'audit", icon: ScrollText },
  { to: "/utilisateurs", label: "Utilisateurs", icon: UserCog },
] as const;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { role } = useRole();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const visibleNav = nav.filter((item) => canAccessRoute(role, item.to));

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  const NavList = ({ onClick }: { onClick?: () => void }) => (
    <nav className="flex-1 px-4 py-6 space-y-1">
      {visibleNav.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onClick}
            className={cn(
              "group flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] transition-all relative",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] bg-[color:var(--gold)] rounded-r" />
            )}
            <Icon className={cn("h-4 w-4", active && "text-[color:var(--gold)]")} />
            <span className="font-medium tracking-wide">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-6 py-7 border-b border-sidebar-border">
          <Logo variant="light" />
        </div>
        <NavList />
        <div className="px-4 py-5 border-t border-sidebar-border space-y-2">
          <div className="px-3 text-[11px] uppercase tracking-[0.18em] text-sidebar-foreground/40">
            Connecté
          </div>
          <div className="px-3 text-xs text-sidebar-foreground/80 truncate" title={user?.email ?? ""}>
            {user?.email}
          </div>
          {role && (
            <div className="px-3 text-[11px] text-[color:var(--gold)] uppercase tracking-[0.15em]">
              {ROLE_LABELS[role]}
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-72 bg-sidebar text-sidebar-foreground flex flex-col">
            <div className="px-6 py-6 border-b border-sidebar-border flex items-center justify-between">
              <Logo variant="light" />
              <button onClick={() => setMobileOpen(false)} className="text-sidebar-foreground/70">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavList onClick={() => setMobileOpen(false)} />
            <div className="px-4 py-5 border-t border-sidebar-border">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card">
          <button onClick={() => setMobileOpen(true)} className="text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <Logo variant="dark" />
          <div className="w-5" />
        </div>
        <div className="flex-1 px-5 py-8 md:px-10 md:py-10 max-w-[1400px] w-full mx-auto">
          <ReadOnlyShield>{children}</ReadOnlyShield>
        </div>
      </main>
    </div>
  );
}

import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, FolderOpen, Wallet, LogOut, Plane } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/contacts", label: "Clients & Fournisseurs", icon: Users },
  { to: "/dossiers", label: "Dossiers", icon: FolderOpen },
  { to: "/paiements", label: "Paiements", icon: Wallet },
] as const;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-6 py-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-md bg-sidebar-primary flex items-center justify-center">
              <Plane className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <div className="font-display font-semibold text-base leading-tight">Cashflow</div>
              <div className="text-xs text-sidebar-foreground/60 leading-tight">Travel</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-sidebar-border">
          <div className="px-3 py-2 text-xs text-sidebar-foreground/60 truncate">
            {user?.email}
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card">
          <div className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-primary" />
            <span className="font-display font-semibold">Cashflow Travel</span>
          </div>
          <button onClick={handleSignOut} className="text-sm text-muted-foreground">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6 md:p-8 max-w-[1400px] mx-auto">{children}</div>
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t flex justify-around py-2">
          {nav.map((item) => {
            const Icon = item.icon;
            const active =
              item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1 text-[10px]",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate max-w-[64px]">{item.label.split(" ")[0]}</span>
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}

import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, FolderOpen, Wallet, LogOut, Menu, X, Landmark, Upload, Link2, FileDown, LineChart, Compass, ScrollText, UserCog, Shield, FileScan, FileText, Inbox, Building2, Video, ShieldCheck, MessageSquare, AlertTriangle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { canAccessRoute, ROLE_LABELS } from "@/lib/permissions";
import { ReadOnlyShield } from "@/components/read-only-shield";
import { supabase } from "@/integrations/supabase/client";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  superAdminOnly?: boolean;
};

// Section 1 : Pilotage de la plateforme FlowTravel (super admin uniquement)
const navFlowTravel: NavItem[] = [
  { to: "/admin-dashboard", label: "Tableau de bord", icon: Sparkles, superAdminOnly: true },
  { to: "/admin-agences", label: "Validation agences", icon: ShieldCheck, superAdminOnly: true },
  { to: "/admin-messages", label: "Messagerie support", icon: MessageSquare, superAdminOnly: true },
  { to: "/admin-errors", label: "Journal d'erreurs", icon: AlertTriangle, superAdminOnly: true },
  { to: "/admin-demos", label: "Démos prospects", icon: Video, superAdminOnly: true },
];

// Section 2 : Gestion de l'agence (LA VOYAGERIE pour Laurence, l'agence de chacun pour les autres)
const navAgence: NavItem[] = [
  { to: "/app", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/pilotage", label: "Pilotage", icon: Compass },
  { to: "/contacts", label: "Clients & Fournisseurs", icon: Users },
  { to: "/demandes", label: "Demandes", icon: Inbox },
  { to: "/cotations", label: "Cotations", icon: FileText },
  { to: "/dossiers", label: "Dossiers", icon: FolderOpen },
  { to: "/paiements", label: "Paiements", icon: Wallet },
  { to: "/comptes", label: "Comptes & Trésorerie", icon: Landmark },
  { to: "/couvertures-fx", label: "Couvertures FX", icon: Shield },
  { to: "/previsions", label: "Prévisions", icon: LineChart },
  { to: "/import-bancaire", label: "Import bancaire", icon: Upload },
  { to: "/import-pdf", label: "Import PDF", icon: FileScan },
  { to: "/rapprochement", label: "Rapprochement", icon: Link2 },
  { to: "/export", label: "Export comptable", icon: FileDown },
  { to: "/audit", label: "Journal d'audit", icon: ScrollText },
  { to: "/utilisateurs", label: "Utilisateurs", icon: UserCog },
  { to: "/parametres-agence", label: "Paramètres agence", icon: Building2 },
  { to: "/support", label: "Support FlowTravel", icon: MessageSquare },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { role } = useRole();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [agencyName, setAgencyName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsSuperAdmin(false);
      setAgencyName(null);
      return;
    }
    supabase
      .from("user_profiles")
      .select("is_super_admin, agence_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        setIsSuperAdmin(!!data?.is_super_admin);
        if (data?.agence_id) {
          const { data: ag } = await supabase
            .from("agences")
            .select("nom_commercial")
            .eq("id", data.agence_id)
            .maybeSingle();
          setAgencyName(ag?.nom_commercial ?? null);
        } else {
          const { data: settings } = await supabase
            .from("agency_settings")
            .select("agency_name")
            .eq("user_id", user.id)
            .maybeSingle();
          setAgencyName(settings?.agency_name ?? null);
        }
      });
  }, [user]);

  const visibleFlowTravelNav = navFlowTravel.filter((item) => {
    if (item.superAdminOnly && !isSuperAdmin) return false;
    return canAccessRoute(role, item.to);
  });

  const visibleAgenceNav = navAgence.filter((item) => canAccessRoute(role, item.to));

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  const isActive = (to: string) =>
    to === "/app" ? location.pathname === "/app" : location.pathname.startsWith(to);

  const NavLinkItem = ({ item, onClick }: { item: NavItem; onClick?: () => void }) => {
    const Icon = item.icon;
    const active = isActive(item.to);
    return (
      <Link
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
  };

  const SectionHeader = ({ label, sublabel }: { label: string; sublabel?: string }) => (
    <div className="px-3 pt-2 pb-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--gold)] font-semibold">
        {label}
      </div>
      {sublabel && (
        <div className="text-[11px] text-sidebar-foreground/50 mt-0.5 truncate" title={sublabel}>
          {sublabel}
        </div>
      )}
    </div>
  );

  const NavList = ({ onClick }: { onClick?: () => void }) => (
    <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
      {visibleFlowTravelNav.length > 0 && (
        <>
          <SectionHeader label="FlowTravel" sublabel="Pilotage de la plateforme" />
          <div className="space-y-1">
            {visibleFlowTravelNav.map((item) => (
              <NavLinkItem key={item.to} item={item} onClick={onClick} />
            ))}
          </div>
          <div className="my-4 border-t border-sidebar-border/60" />
        </>
      )}
      {visibleAgenceNav.length > 0 && (
        <>
          <SectionHeader
            label="Mon agence"
            sublabel={agencyName ?? "Espace de travail"}
          />
          <div className="space-y-1">
            {visibleAgenceNav.map((item) => (
              <NavLinkItem key={item.to} item={item} onClick={onClick} />
            ))}
          </div>
        </>
      )}
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
          <div className="px-3 pt-3 text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/30 text-center">
            Powered by Flow Travel
          </div>
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

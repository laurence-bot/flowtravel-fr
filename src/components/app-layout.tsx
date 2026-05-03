import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, FolderOpen, Wallet, LogOut, Menu, X, Landmark, Upload, Link2, FileDown, LineChart, Compass, ScrollText, UserCog, Shield, FileScan, FileText, Inbox, Building2, Video, ShieldCheck, MessageSquare, AlertTriangle, Sparkles, FileSignature, Receipt, Heart, BookOpen, GraduationCap, Wrench, Clock, CalendarDays, Briefcase, Award, Settings, UserCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { useAgencySettings } from "@/hooks/use-agency-settings";
import { canAccessRoute, ROLE_LABELS } from "@/lib/permissions";
import { ReadOnlyShield } from "@/components/read-only-shield";
import { NotificationsBell } from "@/components/notifications-bell";
import { supabase } from "@/integrations/supabase/client";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  superAdminOnly?: boolean;
};

type NavGroup = {
  key: string;
  label: string;
  icon: typeof LayoutDashboard;
  items: NavItem[];
  superAdminOnly?: boolean;
};

// Section 1 : FlowTravel OPS — pilotage de la plateforme (super admin uniquement)
const navFlowTravelTop: NavItem[] = [
  { to: "/admin-dashboard", label: "Tableau de bord", icon: LayoutDashboard, superAdminOnly: true },
  { to: "/ops", label: "Espace OPS", icon: Wrench, superAdminOnly: true },
];

const navFlowTravelGroups: NavGroup[] = [
  {
    key: "ops-rh",
    label: "Équipe RH",
    icon: Users,
    superAdminOnly: true,
    items: [
      { to: "/ops/equipe", label: "Vue d'ensemble", icon: Users, superAdminOnly: true },
      { to: "/ops/equipe/absences", label: "Absences & congés", icon: CalendarDays, superAdminOnly: true },
      { to: "/ops/equipe/planning", label: "Planning", icon: CalendarDays, superAdminOnly: true },
      { to: "/ops/equipe/pointage", label: "Pointage", icon: Clock, superAdminOnly: true },
      { to: "/ops/equipe/contrats", label: "Contrats", icon: FileSignature, superAdminOnly: true },
      { to: "/ops/equipe/fiches-poste", label: "Fiches de poste", icon: Briefcase, superAdminOnly: true },
      { to: "/ops/equipe/evaluations", label: "Évaluations", icon: Award, superAdminOnly: true },
      { to: "/ops/equipe/parametres", label: "Paramètres RH", icon: Settings, superAdminOnly: true },
    ],
  },
  {
    key: "ops-plateforme",
    label: "Plateforme",
    icon: ShieldCheck,
    superAdminOnly: true,
    items: [
      { to: "/admin-agences", label: "Validation agences", icon: ShieldCheck, superAdminOnly: true },
      { to: "/admin-messages", label: "Messagerie support", icon: MessageSquare, superAdminOnly: true },
      { to: "/admin-errors", label: "Journal d'erreurs", icon: AlertTriangle, superAdminOnly: true },
      { to: "/admin-demos", label: "Démos prospects", icon: Video, superAdminOnly: true },
    ],
  },
];

// Section "Mon espace" — accessible à tous les utilisateurs (employés)
const navMonEspace: NavItem[] = [
  { to: "/mon-espace/pointage", label: "Pointage", icon: Clock },
  { to: "/mon-espace/conges", label: "Mes congés", icon: CalendarDays },
  { to: "/mon-espace/contrats", label: "Mes contrats", icon: FileSignature },
  { to: "/mon-espace/evaluation", label: "Mon évaluation", icon: Award },
];

// Section 2 : Gestion de l'agence
const navAgenceTop: NavItem[] = [
  { to: "/pilotage", label: "Pilotage", icon: Compass },
];

const navAgenceGroups: NavGroup[] = [
  {
    key: "ag-commercial",
    label: "Commercial",
    icon: Inbox,
    items: [
      { to: "/contacts", label: "Clients & Fournisseurs", icon: Users },
      { to: "/demandes", label: "Demandes", icon: Inbox },
      { to: "/cotations", label: "Cotations", icon: FileText },
      { to: "/dossiers", label: "Dossiers", icon: FolderOpen },
      { to: "/suivi-dossiers", label: "Suivi parcours client", icon: LineChart },
      { to: "/bulletins", label: "Bulletins signature", icon: FileSignature },
      { to: "/mariages", label: "Voyages de noces", icon: Heart },
      { to: "/carnets", label: "Carnets de voyage", icon: BookOpen },
    ],
  },
  {
    key: "ag-finance",
    label: "Finance",
    icon: Wallet,
    items: [
      { to: "/factures-clients", label: "Factures clients", icon: Receipt },
      { to: "/paiements", label: "Paiements", icon: Wallet },
      { to: "/comptes", label: "Comptes & Trésorerie", icon: Landmark },
      { to: "/couvertures-fx", label: "Couvertures FX", icon: Shield },
      { to: "/previsions", label: "Prévisions", icon: LineChart },
    ],
  },
  {
    key: "ag-imports",
    label: "Imports & Compta",
    icon: Upload,
    items: [
      { to: "/import-bancaire", label: "Import bancaire", icon: Upload },
      { to: "/import-pdf", label: "Import PDF", icon: FileScan },
      { to: "/rapprochement", label: "Rapprochement", icon: Link2 },
      { to: "/export", label: "Export comptable", icon: FileDown },
      { to: "/audit", label: "Journal d'audit", icon: ScrollText },
    ],
  },
  {
    key: "ag-admin",
    label: "Administration",
    icon: Settings,
    items: [
      { to: "/utilisateurs", label: "Utilisateurs", icon: UserCog },
      { to: "/parametres-agence", label: "Paramètres agence", icon: Building2 },
      { to: "/coaching", label: "Coaching", icon: GraduationCap },
      { to: "/support", label: "Support FlowTravel", icon: MessageSquare },
    ],
  },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { role } = useRole();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [agencyName, setAgencyName] = useState<string | null>(null);
  const { settings: agencySettings } = useAgencySettings();
  const hasAgencyLogo = !!agencySettings?.logo_url;

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

  const fxEnabled = !!agencySettings?.utilise_couvertures_fx;

  const filterItems = (items: NavItem[]) =>
    items.filter((item) => {
      if (item.superAdminOnly && !isSuperAdmin) return false;
      if (item.to === "/couvertures-fx" && !fxEnabled) return false;
      return canAccessRoute(role, item.to);
    });

  const visibleFlowTopRaw = isSuperAdmin ? filterItems(navFlowTravelTop) : [];
  const visibleFlowGroups = navFlowTravelGroups
    .filter((g) => !g.superAdminOnly || isSuperAdmin)
    .map((g) => ({ ...g, items: filterItems(g.items) }))
    .filter((g) => g.items.length > 0);

  const visibleAgenceTop = filterItems(navAgenceTop);
  const visibleAgenceGroups = navAgenceGroups
    .map((g) => ({ ...g, items: filterItems(g.items) }))
    .filter((g) => g.items.length > 0);

  const visibleMonEspaceNav = filterItems(navMonEspace);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  const isActive = (to: string) =>
    to === "/app" ? location.pathname === "/app" : location.pathname.startsWith(to);

  const NavLinkItem = ({ item, onClick, indent }: { item: NavItem; onClick?: () => void; indent?: boolean }) => {
    const Icon = item.icon;
    const active = isActive(item.to);
    return (
      <Link
        to={item.to}
        onClick={onClick}
        className={cn(
          "group flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-all relative",
          indent && "pl-8",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
        )}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] bg-[color:var(--gold)] rounded-r" />
        )}
        <Icon className={cn("h-4 w-4 shrink-0", active && "text-[color:var(--gold)]")} />
        <span className="font-medium tracking-wide truncate">{item.label}</span>
      </Link>
    );
  };

  const CollapsibleGroup = ({ group, onClick }: { group: NavGroup; onClick?: () => void }) => {
    const containsActive = group.items.some((i) => isActive(i.to));
    const storageKey = `nav-group:${group.key}`;
    const [open, setOpen] = useState<boolean>(() => {
      if (typeof window === "undefined") return containsActive;
      const stored = window.localStorage.getItem(storageKey);
      if (stored === null) return containsActive;
      return stored === "1";
    });
    useEffect(() => {
      if (containsActive && !open) setOpen(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [containsActive]);
    const toggle = () => {
      setOpen((v) => {
        const nv = !v;
        try { window.localStorage.setItem(storageKey, nv ? "1" : "0"); } catch {}
        return nv;
      });
    };
    const Icon = group.icon;
    return (
      <div>
        <button
          type="button"
          onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors"
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="font-medium tracking-wide flex-1 text-left truncate">{group.label}</span>
          {open ? <ChevronDown className="h-3.5 w-3.5 opacity-60" /> : <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
        </button>
        {open && (
          <div className="mt-1 space-y-0.5">
            {group.items.map((item) => (
              <NavLinkItem key={item.to} item={item} onClick={onClick} indent />
            ))}
          </div>
        )}
      </div>
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
      {(visibleFlowTopRaw.length > 0 || visibleFlowGroups.length > 0) && (
        <div className="rounded-md border border-[color:var(--gold)]/20 bg-[color:var(--gold)]/5 p-2 mb-4">
          <SectionHeader label="FlowTravel OPS" sublabel="Vous seul · pilotage plateforme" />
          <div className="space-y-1">
            {visibleFlowTopRaw.map((item) => (
              <NavLinkItem key={item.to} item={item} onClick={onClick} />
            ))}
            {visibleFlowGroups.map((g) => (
              <CollapsibleGroup key={g.key} group={g} onClick={onClick} />
            ))}
          </div>
        </div>
      )}
      {(visibleAgenceTop.length > 0 || visibleAgenceGroups.length > 0) && (
        <>
          <SectionHeader
            label="Mon agence"
            sublabel={agencyName ?? "Espace de travail"}
          />
          <div className="space-y-1">
            {visibleAgenceTop.map((item) => (
              <NavLinkItem key={item.to} item={item} onClick={onClick} />
            ))}
            {visibleAgenceGroups.map((g) => (
              <CollapsibleGroup key={g.key} group={g} onClick={onClick} />
            ))}
          </div>
        </>
      )}
      {visibleMonEspaceNav.length > 0 && (
        <>
          <SectionHeader label="Mon espace" sublabel="Espace employé" />
          <div className="space-y-1">
            {visibleMonEspaceNav.map((item) => (
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
        <div className={cn(
          "px-6 py-7 border-b border-sidebar-border",
          hasAgencyLogo && "bg-[oklch(0.97_0.012_80)] text-foreground"
        )}>
          <Logo variant={hasAgencyLogo ? "dark" : "light"} />
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
            <div className={cn(
              "px-6 py-6 border-b border-sidebar-border flex items-center justify-between",
              hasAgencyLogo && "bg-[oklch(0.97_0.012_80)] text-foreground"
            )}>
              <Logo variant={hasAgencyLogo ? "dark" : "light"} />
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
          <NotificationsBell />
        </div>
        {/* Desktop top bar */}
        <div className="hidden md:flex items-center justify-end px-10 pt-4">
          <NotificationsBell />
        </div>
        <div className="flex-1 px-5 py-8 md:px-10 md:py-6 max-w-[1400px] w-full mx-auto">
          <ReadOnlyShield>{children}</ReadOnlyShield>
        </div>
      </main>
    </div>
  );
}

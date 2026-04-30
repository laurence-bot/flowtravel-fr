import React from "react";
import { COLORS, FONT_BODY, FONT_DISPLAY } from "../theme";

// Sidebar FlowTravel — réplique fidèle de src/components/app-layout.tsx
type NavItem = { label: string; icon?: React.ReactNode; active?: boolean };

const Icon = ({ d, active }: { d: string; active?: boolean }) => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    stroke={active ? COLORS.gold : COLORS.sidebarText}
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ opacity: active ? 1 : 0.7 }}
  >
    <path d={d} />
  </svg>
);

// quelques icônes Lucide simplifiées
const ICONS: Record<string, string> = {
  dashboard: "M3 12 L12 3 L21 12 M5 10 V21 H19 V10",
  compass: "M12 2 V4 M12 20 V22 M2 12 H4 M20 12 H22 M16 8 L13 11 L12 14 L9 17 L12 14 L15 13 Z",
  users: "M17 21 V19 a4 4 0 0 0 -4-4 H7 a4 4 0 0 0 -4 4 V21 M9 11 a4 4 0 1 0 0 -8 4 4 0 0 0 0 8",
  inbox: "M22 12 H16 l-2 3 H10 l-2 -3 H2 M5.45 5.11 L2 12 V18 a2 2 0 0 0 2 2 H20 a2 2 0 0 0 2-2 V12 l-3.45-6.89 A2 2 0 0 0 16.76 4 H7.24 a2 2 0 0 0 -1.79 1.11 z",
  file: "M14 2 H6 a2 2 0 0 0 -2 2 V20 a2 2 0 0 0 2 2 H18 a2 2 0 0 0 2-2 V8 z M14 2 V8 H20 M16 13 H8 M16 17 H8",
  folder: "M22 19 a2 2 0 0 1 -2 2 H4 a2 2 0 0 1 -2-2 V5 a2 2 0 0 1 2-2 H9 l2 3 H20 a2 2 0 0 1 2 2 z",
  wallet: "M21 12 V7 H5 a2 2 0 0 1 0-4 H19 v4 M3 5 V19 a2 2 0 0 0 2 2 H21 V12 H17 a2 2 0 0 1 0-4 H21",
  bank: "M3 21 H21 M3 10 H21 M5 6 L12 3 L19 6 M4 10 V21 M20 10 V21 M8 14 V17 M12 14 V17 M16 14 V17",
  shield: "M20 13 c0 5 -3.5 7.5 -8 9 -4.5 -1.5 -8 -4 -8-9 V5 l8-3 8 3 z",
  chart: "M3 3 V21 H21 M7 14 L11 10 L15 14 L21 8",
};

const SidebarItem = ({ icon, label, active }: NavItem) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 12px",
      borderRadius: 6,
      backgroundColor: active ? COLORS.sidebarSoft : "transparent",
      color: active ? COLORS.sidebarText : "rgba(232,226,210,0.7)",
      fontSize: 13,
      fontWeight: 500,
      letterSpacing: "0.01em",
      position: "relative",
    }}
  >
    {active && (
      <div
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          height: 20,
          width: 2,
          backgroundColor: COLORS.gold,
          borderRadius: 2,
        }}
      />
    )}
    {icon}
    <span>{label}</span>
  </div>
);

const SectionHeader = ({ label, sub }: { label: string; sub?: string }) => (
  <div style={{ padding: "8px 12px 8px 12px", marginTop: 4 }}>
    <div
      style={{
        fontSize: 9,
        textTransform: "uppercase",
        letterSpacing: "0.2em",
        color: COLORS.gold,
        fontWeight: 600,
      }}
    >
      {label}
    </div>
    {sub && (
      <div
        style={{
          fontSize: 10,
          color: "rgba(232,226,210,0.5)",
          marginTop: 2,
        }}
      >
        {sub}
      </div>
    )}
  </div>
);

export const FlowTravelSidebar: React.FC<{
  active?: string; // route label active
  width?: number;
}> = ({ active = "Dossiers", width = 230 }) => {
  const items: NavItem[] = [
    { label: "Tableau de bord", icon: <Icon d={ICONS.dashboard} active={active === "Tableau de bord"} />, active: active === "Tableau de bord" },
    { label: "Pilotage", icon: <Icon d={ICONS.compass} active={active === "Pilotage"} />, active: active === "Pilotage" },
    { label: "Clients & Fournisseurs", icon: <Icon d={ICONS.users} active={active === "Clients & Fournisseurs"} />, active: active === "Clients & Fournisseurs" },
    { label: "Demandes", icon: <Icon d={ICONS.inbox} active={active === "Demandes"} />, active: active === "Demandes" },
    { label: "Cotations", icon: <Icon d={ICONS.file} active={active === "Cotations"} />, active: active === "Cotations" },
    { label: "Dossiers", icon: <Icon d={ICONS.folder} active={active === "Dossiers"} />, active: active === "Dossiers" },
    { label: "Paiements", icon: <Icon d={ICONS.wallet} active={active === "Paiements"} />, active: active === "Paiements" },
    { label: "Comptes & Trésorerie", icon: <Icon d={ICONS.bank} active={active === "Comptes & Trésorerie"} />, active: active === "Comptes & Trésorerie" },
    { label: "Couvertures FX", icon: <Icon d={ICONS.shield} active={active === "Couvertures FX"} />, active: active === "Couvertures FX" },
    { label: "Prévisions", icon: <Icon d={ICONS.chart} active={active === "Prévisions"} />, active: active === "Prévisions" },
  ];

  return (
    <aside
      style={{
        width,
        backgroundColor: COLORS.sidebar,
        color: COLORS.sidebarText,
        display: "flex",
        flexDirection: "column",
        borderRight: `1px solid rgba(255,255,255,0.06)`,
        flexShrink: 0,
      }}
    >
      {/* Logo block */}
      <div
        style={{
          padding: "22px 22px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <svg
          viewBox="0 0 64 64"
          width={32}
          height={32}
          fill="none"
          stroke={COLORS.gold}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 34 L54 12 L40 54 L32 36 Z" />
          <path d="M10 34 L32 36" />
          <path d="M32 36 L54 12" opacity={0.55} />
        </svg>
        <div style={{ lineHeight: 1 }}>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 19,
              color: COLORS.sidebarText,
              fontWeight: 500,
            }}
          >
            FlowTravel
          </div>
          <div
            style={{
              fontSize: 8,
              color: "rgba(232,226,210,0.5)",
              textTransform: "uppercase",
              letterSpacing: "0.32em",
              marginTop: 5,
              fontFamily: FONT_BODY,
            }}
          >
            Travel Operating System
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: "12px 14px", flex: 1, fontFamily: FONT_BODY }}>
        <SectionHeader label="Mon agence" sub="LA VOYAGERIE" />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {items.map((it) => (
            <SidebarItem key={it.label} {...it} />
          ))}
        </div>
      </nav>

      {/* User block */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "16px 18px",
          fontFamily: FONT_BODY,
        }}
      >
        <div
          style={{
            fontSize: 9,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            color: "rgba(232,226,210,0.4)",
          }}
        >
          Connecté
        </div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(232,226,210,0.8)",
            marginTop: 4,
          }}
        >
          camille@lavoyagerie.fr
        </div>
        <div
          style={{
            fontSize: 9,
            color: COLORS.gold,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            marginTop: 4,
          }}
        >
          Agent senior
        </div>
      </div>
    </aside>
  );
};

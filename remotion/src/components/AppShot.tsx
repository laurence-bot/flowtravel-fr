import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS, FONT_BODY, FONT_DISPLAY } from "../theme";
import { FlowTravelSidebar } from "./FlowTravelSidebar";

// AppShot : reproduit l'app FlowTravel en plein cadre
// header avec route + sidebar à gauche + contenu à droite
export const AppShot: React.FC<{
  route: string; // ex: /dossiers/voyage-japon
  active: string; // sidebar active
  scale?: number;
  children: React.ReactNode;
  moduleLabel?: string; // ex: "DEMANDES"
}> = ({ route, active, scale = 1, children, moduleLabel }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrée
  const enter = spring({ frame, fps, config: { damping: 25, stiffness: 140 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const tY = interpolate(enter, [0, 1], [20, 0]);
  // Léger Ken Burns
  const kb = interpolate(frame, [0, 200], [1, 1.018], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${tY}px) scale(${scale * kb})`,
        transformOrigin: "center center",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "92%",
          height: "82%",
          backgroundColor: COLORS.bg,
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(26,24,21,0.18), 0 0 0 1px rgba(0,0,0,0.04)",
          border: `1px solid ${COLORS.border}`,
          display: "flex",
          flexDirection: "column",
          fontFamily: FONT_BODY,
        }}
      >
        {/* Browser bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 16px",
            backgroundColor: "#EDE7D8",
            borderBottom: `1px solid ${COLORS.border}`,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            <Dot color="#E8665E" />
            <Dot color="#E8B547" />
            <Dot color="#7AAB57" />
          </div>
          <div
            style={{
              flex: 1,
              backgroundColor: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 6,
              padding: "5px 12px",
              fontSize: 12,
              color: COLORS.textSubtle,
              fontFamily: '"JetBrains Mono", monospace',
              maxWidth: 600,
              margin: "0 auto",
            }}
          >
            🔒 app.flowtravel.fr{route}
          </div>
          <div style={{ width: 60 }} />
        </div>

        {/* App layout */}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <FlowTravelSidebar active={active} />
          <main style={{ flex: 1, padding: "28px 36px", overflow: "hidden", position: "relative" }}>
            {moduleLabel && (
              <div
                style={{
                  position: "absolute",
                  top: 16,
                  right: 24,
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: "0.28em",
                  color: COLORS.gold,
                  fontWeight: 600,
                }}
              >
                {moduleLabel}
              </div>
            )}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

const Dot = ({ color }: { color: string }) => (
  <div style={{ width: 11, height: 11, borderRadius: "50%", backgroundColor: color, opacity: 0.85 }} />
);

// Card — réplique de @/components/ui/card
export const FTCard: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      backgroundColor: COLORS.card,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 10,
      padding: 18,
      ...style,
    }}
  >
    {children}
  </div>
);

// Badge statut
export const FTBadge: React.FC<{
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "ocre" | "gold";
}> = ({ children, variant = "default" }) => {
  const styles: Record<string, React.CSSProperties> = {
    default: { backgroundColor: COLORS.bgSoft, color: COLORS.text, border: `1px solid ${COLORS.border}` },
    success: { backgroundColor: "rgba(106,111,76,0.12)", color: COLORS.olive, border: `1px solid ${COLORS.olive}40` },
    warning: { backgroundColor: "rgba(201,169,110,0.15)", color: "#8C7344", border: `1px solid ${COLORS.gold}50` },
    ocre: { backgroundColor: "rgba(161,78,44,0.1)", color: COLORS.ocre, border: `1px solid ${COLORS.ocre}40` },
    gold: { backgroundColor: COLORS.gold, color: COLORS.text, border: "none" },
  };
  return (
    <span
      style={{
        ...styles[variant],
        padding: "3px 10px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.02em",
        display: "inline-block",
      }}
    >
      {children}
    </span>
  );
};

// PageHeader
export const FTPageHeader: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
    <div>
      <h1
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 30,
          fontWeight: 500,
          color: COLORS.text,
          margin: 0,
          letterSpacing: "-0.01em",
          lineHeight: 1.1,
        }}
      >
        {title}
      </h1>
      {description && (
        <div style={{ marginTop: 6, fontSize: 13, color: COLORS.textMuted }}>
          {description}
        </div>
      )}
    </div>
    {action}
  </div>
);

// Highlight ring qui apparaît sur un élément
export const Highlight: React.FC<{
  delay?: number;
  duration?: number;
  style?: React.CSSProperties;
}> = ({ delay = 0, duration = 60, style }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + 12, delay + duration, delay + duration + 12], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [delay, delay + 18], [1.15, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        border: `2px solid ${COLORS.ocre}`,
        borderRadius: 10,
        opacity,
        transform: `scale(${scale})`,
        boxShadow: `0 0 0 4px ${COLORS.ocre}25`,
        pointerEvents: "none",
        ...style,
      }}
    />
  );
};

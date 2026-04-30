import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS } from "../theme";
import { Subtitle } from "../components/Subtitle";
import type { Format } from "../MainVideo";

// Mockup of FlowTravel dashboard
const Dashboard: React.FC<{ format: Format; progress: number }> = ({ format, progress }) => {
  const isLandscape = format === "landscape";
  const w = isLandscape ? 1280 : 920;
  const h = isLandscape ? 760 : 720;

  return (
    <div
      style={{
        width: w,
        height: h,
        background: COLORS.surface,
        borderRadius: 20,
        boxShadow: `0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px ${COLORS.border}`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Title bar */}
      <div style={{ height: 40, background: COLORS.bgSoft, display: "flex", alignItems: "center", padding: "0 16px", gap: 8 }}>
        <div style={{ width: 12, height: 12, borderRadius: 6, background: "#FF5F57" }} />
        <div style={{ width: 12, height: 12, borderRadius: 6, background: "#FEBC2E" }} />
        <div style={{ width: 12, height: 12, borderRadius: 6, background: "#28C840" }} />
        <div style={{ marginLeft: 16, color: COLORS.textMuted, fontSize: 14, fontFamily: "Inter" }}>app.flowtravel.fr</div>
      </div>

      <div style={{ display: "flex", flex: 1 }}>
        {/* Sidebar */}
        <div style={{ width: 220, background: COLORS.bgSoft, padding: 24, borderRight: `1px solid ${COLORS.border}` }}>
          <div style={{ fontFamily: "DM Sans", fontWeight: 900, fontSize: 22, color: COLORS.text, marginBottom: 32 }}>
            Flow<span style={{ color: COLORS.primary }}>Travel</span>
          </div>
          {["Dossiers", "Clients", "Agents", "Devis", "Stats"].map((label, i) => (
            <div
              key={label}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                marginBottom: 6,
                background: i === 0 ? COLORS.primary + "22" : "transparent",
                color: i === 0 ? COLORS.primary : COLORS.textMuted,
                fontSize: 16,
                fontFamily: "Inter",
                fontWeight: 500,
                display: "flex", alignItems: "center", gap: 12,
              }}
            >
              <div style={{ width: 18, height: 18, borderRadius: 4, background: i === 0 ? COLORS.primary : COLORS.surfaceLight }} />
              {label}
            </div>
          ))}
        </div>

        {/* Main */}
        <div style={{ flex: 1, padding: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
            <div>
              <div style={{ fontFamily: "DM Sans", fontSize: 32, fontWeight: 700, color: COLORS.text, letterSpacing: "-0.02em" }}>
                Mes dossiers
              </div>
              <div style={{ color: COLORS.textMuted, fontSize: 15, marginTop: 4 }}>12 actifs · 3 en attente</div>
            </div>
            <div style={{
              padding: "12px 20px", background: COLORS.primary, color: "white", borderRadius: 10,
              fontFamily: "Inter", fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", gap: 8,
              boxShadow: `0 8px 24px ${COLORS.primary}55`,
            }}>
              <div style={{ width: 14, height: 14, background: "white", borderRadius: 2 }} />
              Nouveau dossier
            </div>
          </div>

          {/* Cards */}
          {[
            { name: "Famille Dupont", dest: "Bali · 12 jours", status: "Confirmé", color: COLORS.accent, agent: "Sophie" },
            { name: "M. Lambert", dest: "Japon · 21 jours", status: "Devis envoyé", color: COLORS.gold, agent: "Marc" },
            { name: "Couple Martin", dest: "Maldives · 7 jours", status: "En cours", color: COLORS.primary, agent: "Léa" },
          ].map((d, i) => {
            const cardEnter = Math.max(0, Math.min(1, (progress * 3) - i * 0.4));
            return (
              <div
                key={d.name}
                style={{
                  background: COLORS.surfaceLight,
                  borderRadius: 14,
                  padding: 20,
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  border: `1px solid ${COLORS.border}`,
                  opacity: cardEnter,
                  transform: `translateX(${(1 - cardEnter) * 20}px)`,
                }}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: 12,
                  background: `linear-gradient(135deg, ${d.color}, ${d.color}AA)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "white", fontWeight: 700, fontFamily: "DM Sans", fontSize: 22,
                }}>{d.name[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: COLORS.text, fontSize: 18, fontWeight: 600, fontFamily: "Inter" }}>{d.name}</div>
                  <div style={{ color: COLORS.textMuted, fontSize: 14, marginTop: 4 }}>{d.dest} · Agent: {d.agent}</div>
                </div>
                <div style={{
                  padding: "6px 14px", borderRadius: 20, background: d.color + "22", color: d.color,
                  fontSize: 13, fontWeight: 600, fontFamily: "Inter",
                }}>{d.status}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const Scene3Solution: React.FC<{ format: Format }> = ({ format }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 22, stiffness: 110 } });
  const dashOpacity = interpolate(enter, [0, 1], [0, 1]);
  const dashScale = interpolate(enter, [0, 1], [0.92, 1]);
  const dashY = interpolate(enter, [0, 1], [40, 0]);

  // Sweeping cursor click animation around frame 80
  const click = interpolate(frame, [80, 92], [0, 1], { extrapolateRight: "clamp" });

  const exitOpacity = interpolate(frame, [232, 248], [1, 0], { extrapolateRight: "clamp" });

  const progress = interpolate(frame, [10, 80], [0, 1], { extrapolateRight: "clamp" });

  // Logo pop in for first second
  const logoOpacity = interpolate(frame, [0, 12, 30, 40], [0, 1, 1, 0]);
  const logoScale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });

  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      {/* Quick logo flash */}
      <AbsoluteFill style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: logoOpacity,
        zIndex: 5,
      }}>
        <div style={{
          fontFamily: "DM Sans", fontWeight: 900,
          fontSize: format === "landscape" ? 120 : 80,
          color: COLORS.text, letterSpacing: "-0.04em",
          transform: `scale(${interpolate(logoScale, [0, 1], [0.7, 1])})`,
        }}>
          Flow<span style={{ color: COLORS.primary }}>Travel</span>
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          opacity: dashOpacity * (1 - logoOpacity * 0.7),
          transform: `scale(${dashScale}) translateY(${dashY}px)`,
        }}>
          <Dashboard format={format} progress={progress} />
        </div>
      </AbsoluteFill>

      {/* Click ripple */}
      {format === "landscape" && (
        <div style={{
          position: "absolute",
          right: 280, top: 280,
          width: 60, height: 60, borderRadius: 30,
          border: `3px solid ${COLORS.primary}`,
          opacity: (1 - click) * (frame > 75 ? 1 : 0),
          transform: `scale(${1 + click * 2})`,
        }} />
      )}

      <Subtitle text="FlowTravel. Tout centralisé. En 3 clics." />
    </AbsoluteFill>
  );
};

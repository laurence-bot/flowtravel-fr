import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS } from "../theme";
import { Subtitle } from "../components/Subtitle";
import type { Format } from "../MainVideo";

const BENEFITS = [
  { stat: "+15h", label: "économisées par semaine", color: COLORS.primary },
  { stat: "−80%", label: "d'erreurs administratives", color: COLORS.accent },
  { stat: "100%", label: "des dossiers à jour", color: COLORS.gold },
];

export const Scene4Benefits: React.FC<{ format: Format }> = ({ format }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const exitOpacity = interpolate(frame, [148, 162], [1, 0], { extrapolateRight: "clamp" });

  const isLandscape = format === "landscape";

  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      <AbsoluteFill style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: isLandscape ? "row" : "column", gap: isLandscape ? 50 : 30,
        padding: 60,
      }}>
        {BENEFITS.map((b, i) => {
          const delay = i * 14;
          const sp = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 130 } });
          const opacity = interpolate(sp, [0, 1], [0, 1]);
          const y = interpolate(sp, [0, 1], [60, 0]);
          const scale = interpolate(sp, [0, 1], [0.8, 1]);

          // Number count-up effect
          const countProg = interpolate(frame - delay - 8, [0, 30], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp"
          });

          const w = isLandscape ? 380 : 700;
          const h = isLandscape ? 440 : 200;

          return (
            <div
              key={i}
              style={{
                width: w, height: h,
                background: `linear-gradient(160deg, ${COLORS.surface}, ${COLORS.bgSoft})`,
                borderRadius: 24,
                padding: isLandscape ? "40px 36px" : "30px 36px",
                display: "flex", flexDirection: isLandscape ? "column" : "row",
                alignItems: isLandscape ? "flex-start" : "center",
                gap: isLandscape ? 16 : 30,
                justifyContent: "center",
                border: `1px solid ${COLORS.border}`,
                boxShadow: `0 30px 80px rgba(0,0,0,0.4), 0 0 80px ${b.color}15`,
                opacity,
                transform: `translateY(${y}px) scale(${scale})`,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{
                position: "absolute", top: -40, right: -40,
                width: 200, height: 200, borderRadius: 100,
                background: `radial-gradient(circle, ${b.color}25, transparent 70%)`,
                filter: "blur(20px)",
              }} />

              <div style={{
                fontFamily: "DM Sans", fontWeight: 900,
                fontSize: isLandscape ? 130 : 90,
                color: b.color, letterSpacing: "-0.05em", lineHeight: 1,
                textShadow: `0 0 40px ${b.color}55`,
                transform: `scale(${0.6 + countProg * 0.4})`,
                transformOrigin: isLandscape ? "left center" : "left center",
              }}>
                {b.stat}
              </div>
              <div style={{
                fontFamily: "Inter", fontSize: isLandscape ? 22 : 22,
                color: COLORS.text, fontWeight: 500, lineHeight: 1.3,
                opacity: countProg,
                flex: isLandscape ? 0 : 1,
              }}>
                {b.label}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>

      <Subtitle text="Gagnez des heures. Vendez plus." />
    </AbsoluteFill>
  );
};

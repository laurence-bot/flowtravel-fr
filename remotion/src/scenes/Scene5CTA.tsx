import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS } from "../theme";
import type { Format } from "../MainVideo";

export const Scene5CTA: React.FC<{ format: Format }> = ({ format }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const logoScale = interpolate(logoSpring, [0, 1], [0.6, 1]);
  const logoY = interpolate(logoSpring, [0, 1], [40, 0]);
  const logoOpacity = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });

  const urlOpacity = interpolate(frame, [22, 38], [0, 1], { extrapolateRight: "clamp" });
  const urlY = interpolate(frame, [22, 38], [20, 0], { extrapolateRight: "clamp" });

  const ctaSpring = spring({ frame: frame - 40, fps, config: { damping: 12, stiffness: 140 } });
  const ctaScale = interpolate(ctaSpring, [0, 1], [0.7, 1]);
  const ctaOpacity = interpolate(frame, [40, 54], [0, 1], { extrapolateRight: "clamp" });

  // Pulse
  const pulse = 1 + Math.sin((frame - 50) / 8) * 0.03;

  const isLandscape = format === "landscape";

  return (
    <AbsoluteFill style={{
      display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 30,
    }}>
      {/* Glow halo */}
      <div style={{
        position: "absolute",
        width: 800, height: 800, borderRadius: 400,
        background: `radial-gradient(circle, ${COLORS.primary}30, transparent 60%)`,
        filter: "blur(40px)",
        opacity: logoOpacity * 0.8,
      }} />

      <div style={{
        fontFamily: "DM Sans", fontWeight: 900,
        fontSize: isLandscape ? 180 : 120,
        color: COLORS.text, letterSpacing: "-0.05em", lineHeight: 1,
        opacity: logoOpacity,
        transform: `scale(${logoScale}) translateY(${logoY}px)`,
        textAlign: "center",
      }}>
        Flow<span style={{ color: COLORS.primary }}>Travel</span>
      </div>

      <div style={{
        fontFamily: "Inter", fontSize: isLandscape ? 32 : 24,
        color: COLORS.textMuted, letterSpacing: "0.08em",
        opacity: urlOpacity,
        transform: `translateY(${urlY}px)`,
        fontWeight: 500,
      }}>
        flowtravel.fr
      </div>

      <div style={{
        marginTop: 30,
        padding: isLandscape ? "24px 56px" : "20px 40px",
        background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryGlow})`,
        borderRadius: 999,
        color: "white",
        fontFamily: "DM Sans", fontWeight: 700,
        fontSize: isLandscape ? 32 : 24,
        boxShadow: `0 20px 60px ${COLORS.primary}66`,
        opacity: ctaOpacity,
        transform: `scale(${ctaScale * pulse})`,
        letterSpacing: "-0.01em",
      }}>
        Essayez gratuitement →
      </div>
    </AbsoluteFill>
  );
};

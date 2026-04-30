import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS } from "../theme";

export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 40;
  const drift2 = Math.cos(frame / 120) * 60;

  return (
    <AbsoluteFill>
      {/* Base gradient */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 80% 60% at 30% 20%, ${COLORS.surfaceLight} 0%, ${COLORS.bg} 60%, ${COLORS.bg} 100%)`,
        }}
      />
      {/* Coral glow */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle 600px at ${50 + drift}% ${70 + drift2 * 0.3}%, ${COLORS.primary}22 0%, transparent 70%)`,
          filter: "blur(40px)",
        }}
      />
      {/* Turquoise glow */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle 500px at ${80 - drift}% ${30 + drift2 * 0.2}%, ${COLORS.accent}1F 0%, transparent 70%)`,
          filter: "blur(60px)",
        }}
      />
      {/* Subtle grid */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${COLORS.border} 1px, transparent 1px), linear-gradient(90deg, ${COLORS.border} 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
          opacity: 0.4,
          maskImage: "radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 100%)",
        }}
      />
      {/* Vignette */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 100% 100% at 50% 50%, transparent 50%, ${COLORS.bg}CC 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

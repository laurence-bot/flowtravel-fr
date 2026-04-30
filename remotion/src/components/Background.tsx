import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS } from "../theme";

// Background ivoire FlowTravel — sobre, éditorial
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 200) * 30;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* Subtle warm glow top-right */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 60% at ${85 + drift}% 10%, ${COLORS.gold}1A 0%, transparent 60%)`,
        }}
      />
      {/* Subtle ocre glow bottom-left */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 50% at 5% ${90 - drift}%, ${COLORS.ocre}10 0%, transparent 60%)`,
        }}
      />
      {/* Vignette */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 100% 100% at 50% 50%, transparent 60%, rgba(0,0,0,0.04) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS, FONT_BODY, FONT_DISPLAY } from "../theme";
import { FlowTravelLogo } from "../components/FlowTravelLogo";
import type { Format } from "../MainVideo";

export const Scene10Outro: React.FC<{ format: Format }> = ({ format }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const logoOpacity = interpolate(logoSpring, [0, 1], [0, 1]);
  const logoY = interpolate(logoSpring, [0, 1], [16, 0]);

  const lineWidth = interpolate(frame, [20, 60], [0, 100], { extrapolateRight: "clamp" });
  const tagOp = interpolate(frame, [40, 60], [0, 1], { extrapolateRight: "clamp" });
  const urlOp = interpolate(frame, [70, 95], [0, 1], { extrapolateRight: "clamp" });

  const tagSize = format === "landscape" ? 36 : 24;

  return (
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      <div style={{ opacity: logoOpacity, transform: `translateY(${logoY}px)` }}>
        <FlowTravelLogo size={80} variant="dark" />
      </div>

      <div
        style={{
          marginTop: 40,
          height: 1,
          width: `${lineWidth * 1.8}px`,
          background: `linear-gradient(90deg, transparent, ${COLORS.gold}, transparent)`,
          maxWidth: "60%",
        }}
      />

      <div
        style={{
          marginTop: 36,
          fontFamily: FONT_DISPLAY,
          fontSize: tagSize,
          color: COLORS.text,
          fontStyle: "italic",
          fontWeight: 500,
          textAlign: "center",
          opacity: tagOp,
          padding: "0 80px",
          lineHeight: 1.3,
        }}
      >
        Le système d'exploitation
        <br />
        des agences de voyages.
      </div>

      <div
        style={{
          marginTop: 50,
          fontFamily: FONT_BODY,
          fontSize: 16,
          color: COLORS.ocre,
          textTransform: "uppercase",
          letterSpacing: "0.32em",
          fontWeight: 500,
          opacity: urlOp,
        }}
      >
        flowtravel.fr
      </div>
    </AbsoluteFill>
  );
};

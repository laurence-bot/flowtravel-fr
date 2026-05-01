import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS, FONT_DISPLAY, FONT_BODY } from "../theme";
import { FlowTravelLogo } from "../components/FlowTravelLogo";
import type { Format } from "../MainVideo";

export const Scene1Hook: React.FC<{ format: Format }> = ({ format }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const logoOpacity = interpolate(logoSpring, [0, 1], [0, 1]);
  const logoY = interpolate(logoSpring, [0, 1], [20, 0]);

  const lineWidth = interpolate(frame, [22, 60], [0, 100], { extrapolateRight: "clamp" });

  const t1Op = interpolate(frame, [40, 58], [0, 1], { extrapolateRight: "clamp" });
  const t2Op = interpolate(frame, [70, 90], [0, 1], { extrapolateRight: "clamp" });

  // Pas de fade-out interne : la transition vers la sc\u00e8ne suivante est g\u00e9r\u00e9e par MainVideo (cut net cal\u00e9 voix).
  const exit = 1;
  const exitScale = 1;

  const titleSize = format === "landscape" ? 92 : 60;
  const subSize = format === "landscape" ? 22 : 16;

  return (
    <AbsoluteFill style={{ opacity: exit, transform: `scale(${exitScale})` }}>
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
        }}
      >
        <div style={{ opacity: logoOpacity, transform: `translateY(${logoY}px)` }}>
          <FlowTravelLogo size={64} variant="dark" />
        </div>

        <div
          style={{
            marginTop: 48,
            height: 1,
            width: `${lineWidth * 1.5}px`,
            background: `linear-gradient(90deg, transparent, ${COLORS.gold}, transparent)`,
            maxWidth: "60%",
          }}
        />

        <div
          style={{
            marginTop: 48,
            fontFamily: FONT_DISPLAY,
            fontSize: titleSize,
            fontWeight: 500,
            color: COLORS.text,
            textAlign: "center",
            letterSpacing: "-0.015em",
            lineHeight: 1.05,
            padding: "0 80px",
            opacity: t1Op,
          }}
        >
          Une agence de voyages,
          <br />
          c'est <em style={{ color: COLORS.ocre, fontStyle: "italic" }}>douze outils</em>.
        </div>

        <div
          style={{
            marginTop: 18,
            fontFamily: FONT_DISPLAY,
            fontSize: titleSize,
            fontWeight: 500,
            color: COLORS.text,
            textAlign: "center",
            letterSpacing: "-0.015em",
            lineHeight: 1.05,
            padding: "0 80px",
            opacity: t2Op,
          }}
        >
          FlowTravel, c'est <em style={{ color: COLORS.gold, fontStyle: "italic" }}>un seul</em>.
        </div>

        <div
          style={{
            marginTop: 56,
            fontFamily: FONT_BODY,
            fontSize: subSize,
            color: COLORS.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.32em",
            opacity: t2Op,
            fontWeight: 500,
          }}
        >
          Travel Operating System
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

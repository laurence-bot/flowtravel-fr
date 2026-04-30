import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS } from "../theme";
import { Subtitle } from "../components/Subtitle";
import type { Format } from "../MainVideo";

export const Scene1Hook: React.FC<{ format: Format }> = ({ format }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame: frame - 4, fps, config: { damping: 18, stiffness: 140 } });
  const titleY = interpolate(titleSpring, [0, 1], [40, 0]);
  const titleOpacity = interpolate(frame, [4, 18], [0, 1], { extrapolateRight: "clamp" });

  const lineWidth = interpolate(frame, [22, 50], [0, 100], { extrapolateRight: "clamp" });
  const subOpacity = interpolate(frame, [28, 42], [0, 1], { extrapolateRight: "clamp" });

  // Exit
  const exitOpacity = interpolate(frame, [82, 96], [1, 0], { extrapolateRight: "clamp" });
  const exitScale = interpolate(frame, [82, 96], [1, 1.04], { extrapolateRight: "clamp" });

  const baseSize = format === "landscape" ? 140 : 96;

  return (
    <AbsoluteFill style={{ opacity: exitOpacity, transform: `scale(${exitScale})` }}>
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <div
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontWeight: 900,
            fontSize: baseSize,
            color: COLORS.text,
            letterSpacing: "-0.04em",
            lineHeight: 0.95,
            textAlign: "center",
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            padding: "0 60px",
          }}
        >
          Vous perdez<br />
          <span style={{ color: COLORS.primary, fontStyle: "italic" }}>du temps</span>
          <span style={{ color: COLORS.text }}>?</span>
        </div>

        <div
          style={{
            marginTop: 36,
            height: 3,
            width: `${lineWidth * 2.2}px`,
            background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.accent})`,
            borderRadius: 2,
            maxWidth: "70%",
          }}
        />

        <div
          style={{
            marginTop: 28,
            fontFamily: "Inter, sans-serif",
            fontSize: format === "landscape" ? 26 : 20,
            color: COLORS.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            opacity: subOpacity,
            fontWeight: 500,
          }}
        >
          Pour gérer votre agence de voyage
        </div>
      </AbsoluteFill>

      <Subtitle text="Vous perdez encore du temps à gérer vos dossiers ?" />
    </AbsoluteFill>
  );
};

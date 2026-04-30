import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS } from "../theme";

export const Subtitle: React.FC<{ text: string; accent?: string }> = ({ text, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 30, stiffness: 180 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const y = interpolate(enter, [0, 1], [12, 0]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 90,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        opacity,
        transform: `translateY(${y}px)`,
        padding: "0 80px",
      }}
    >
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 30,
          fontWeight: 500,
          color: COLORS.text,
          textAlign: "center",
          padding: "16px 28px",
          background: "rgba(10,14,26,0.65)",
          borderRadius: 12,
          border: `1px solid ${COLORS.border}`,
          maxWidth: "85%",
          letterSpacing: "-0.01em",
          lineHeight: 1.35,
        }}
      >
        {text}
        {accent && <span style={{ color: COLORS.primary, marginLeft: 8 }}>{accent}</span>}
      </div>
    </div>
  );
};

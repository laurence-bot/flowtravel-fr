import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS, FONT_BODY } from "../theme";

// Caption en bas — style FlowTravel (ivoire avec léger accent)
export const Caption: React.FC<{ text: string; accent?: string }> = ({ text, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 30, stiffness: 180 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const y = interpolate(enter, [0, 1], [16, 0]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 70,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        opacity,
        transform: `translateY(${y}px)`,
        padding: "0 80px",
        zIndex: 50,
      }}
    >
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 24,
          fontWeight: 500,
          color: COLORS.text,
          textAlign: "center",
          padding: "14px 28px",
          background: "rgba(251,248,240,0.94)",
          borderRadius: 10,
          border: `1px solid ${COLORS.border}`,
          maxWidth: "78%",
          letterSpacing: "-0.005em",
          lineHeight: 1.35,
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        }}
      >
        {text}
        {accent && (
          <span style={{ color: COLORS.ocre, marginLeft: 6, fontWeight: 600 }}>
            {accent}
          </span>
        )}
      </div>
    </div>
  );
};

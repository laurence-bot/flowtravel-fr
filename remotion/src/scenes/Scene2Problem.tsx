import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS } from "../theme";
import { Subtitle } from "../components/Subtitle";
import type { Format } from "../MainVideo";

const APPS = [
  { name: "Excel", color: "#1D6F42", x: 12, y: 20 },
  { name: "Gmail", color: "#EA4335", x: 70, y: 14 },
  { name: "WhatsApp", color: "#25D366", x: 8, y: 60 },
  { name: "PDF", color: "#E54B4B", x: 78, y: 62 },
  { name: "Notes", color: "#E8B547", x: 42, y: 8 },
  { name: "Téléphone", color: "#3DD9C4", x: 50, y: 70 },
];

export const Scene2Problem: React.FC<{ format: Format }> = ({ format }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const exitOpacity = interpolate(frame, [115, 130], [1, 0], { extrapolateRight: "clamp" });

  // STOP stamp at frame 75
  const stopSpring = spring({ frame: frame - 70, fps, config: { damping: 8, stiffness: 200 } });
  const stopScale = interpolate(stopSpring, [0, 1], [3, 1]);
  const stopOpacity = interpolate(frame, [70, 80], [0, 1], { extrapolateRight: "clamp" });
  const stopRotate = interpolate(stopSpring, [0, 1], [-15, -8]);

  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      <AbsoluteFill>
        {APPS.map((app, i) => {
          const delay = i * 6;
          const enter = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 120 } });
          const opacity = interpolate(enter, [0, 1], [0, 1]);
          const scale = interpolate(enter, [0, 1], [0.5, 1]);
          const wobble = Math.sin((frame + i * 10) / 12) * 6;
          const rot = Math.sin((frame + i * 7) / 18) * 4 + (i % 2 === 0 ? -3 : 3);

          // Shake more after stop
          const shake = frame > 60 && frame < 75 ? Math.sin(frame * 2) * 8 : 0;

          // fade out under STOP
          const dim = interpolate(frame, [70, 82], [1, 0.25], { extrapolateRight: "clamp" });

          const size = format === "landscape" ? 180 : 130;

          return (
            <div
              key={app.name}
              style={{
                position: "absolute",
                left: `${app.x}%`,
                top: `${app.y}%`,
                width: size,
                height: size,
                background: `linear-gradient(135deg, ${app.color}, ${app.color}AA)`,
                borderRadius: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontFamily: "DM Sans",
                fontWeight: 700,
                fontSize: size * 0.14,
                boxShadow: `0 20px 60px ${app.color}55, 0 0 0 1px rgba(255,255,255,0.12) inset`,
                opacity: opacity * dim,
                transform: `translate(-50%, ${wobble + shake}px) scale(${scale}) rotate(${rot}deg)`,
              }}
            >
              {app.name}
            </div>
          );
        })}
      </AbsoluteFill>

      {/* STOP stamp */}
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontWeight: 900,
            fontSize: format === "landscape" ? 280 : 200,
            color: COLORS.primary,
            letterSpacing: "-0.05em",
            opacity: stopOpacity,
            transform: `scale(${stopScale}) rotate(${stopRotate}deg)`,
            border: `12px solid ${COLORS.primary}`,
            padding: "10px 60px",
            borderRadius: 24,
            background: "rgba(10,14,26,0.4)",
            textShadow: `0 0 40px ${COLORS.primary}66`,
          }}
        >
          STOP.
        </div>
      </AbsoluteFill>

      <Subtitle text="Outils dispersés. Infos perdues. Clients en attente." />
    </AbsoluteFill>
  );
};

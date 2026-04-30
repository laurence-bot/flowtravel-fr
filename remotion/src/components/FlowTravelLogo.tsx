import { COLORS, FONT_BODY } from "../theme";

// Logo FlowTravel — flèche origami (paper plane) doré
export const FlowTravelLogo: React.FC<{
  size?: number;
  showText?: boolean;
  variant?: "light" | "dark";
}> = ({ size = 40, showText = true, variant = "dark" }) => {
  const textColor = variant === "light" ? COLORS.sidebarText : COLORS.text;
  const tagColor = variant === "light" ? COLORS.sidebarTextMuted : COLORS.textSubtle;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        fill="none"
        stroke={COLORS.gold}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 34 L54 12 L40 54 L32 36 Z" />
        <path d="M10 34 L32 36" />
        <path d="M32 36 L54 12" opacity={0.55} />
      </svg>
      {showText && (
        <div style={{ lineHeight: 1, fontFamily: FONT_BODY }}>
          <div
            style={{
              fontFamily: '"Cormorant Garamond", serif',
              fontSize: size * 0.62,
              color: textColor,
              letterSpacing: "0.005em",
              fontWeight: 500,
            }}
          >
            FlowTravel
          </div>
          <div
            style={{
              fontSize: size * 0.22,
              color: tagColor,
              textTransform: "uppercase",
              letterSpacing: "0.32em",
              marginTop: 6,
              fontWeight: 500,
            }}
          >
            Travel Operating System
          </div>
        </div>
      )}
    </div>
  );
};

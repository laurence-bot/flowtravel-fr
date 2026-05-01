import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS, FONT_BODY, FONT_DISPLAY } from "../theme";
import { FlowTravelLogo } from "../components/FlowTravelLogo";
import type { Format } from "../MainVideo";

// Slide finale 6s — logo + tarifs réels + CTA démo + URL
// Tarifs sourcés depuis src/routes/tarifs.tsx :
//   Le Carnet  9 € HT/mois
//   L'Atelier 49 € HT/mois
//   La Maison 79 € HT/mois
const PLANS = [
  { nom: "Le Carnet", prix: 9, baseline: "Agent solo" },
  { nom: "L'Atelier", prix: 49, baseline: "Agence qui structure", highlight: true },
  { nom: "La Maison", prix: 79, baseline: "Agence multi-utilisateurs" },
];

export const SceneFinalCTA: React.FC<{ format: Format }> = ({ format }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const logoOp = interpolate(logoSpring, [0, 1], [0, 1]);
  const logoY = interpolate(logoSpring, [0, 1], [16, 0]);

  const lineWidth = interpolate(frame, [12, 45], [0, 100], { extrapolateRight: "clamp" });
  const plansOp = interpolate(frame, [30, 55], [0, 1], { extrapolateRight: "clamp" });
  const ctaOp = interpolate(frame, [60, 85], [0, 1], { extrapolateRight: "clamp" });
  const urlOp = interpolate(frame, [85, 105], [0, 1], { extrapolateRight: "clamp" });

  const titleSize = format === "landscape" ? 36 : 24;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        padding: format === "landscape" ? "0 120px" : "0 60px",
      }}
    >
      <div style={{ opacity: logoOp, transform: `translateY(${logoY}px)` }}>
        <FlowTravelLogo size={72} variant="dark" />
      </div>

      <div
        style={{
          marginTop: 28,
          height: 1,
          width: `${lineWidth * 1.6}px`,
          background: `linear-gradient(90deg, transparent, ${COLORS.gold}, transparent)`,
          maxWidth: "55%",
        }}
      />

      <div
        style={{
          marginTop: 28,
          fontFamily: FONT_DISPLAY,
          fontSize: titleSize,
          color: COLORS.text,
          fontStyle: "italic",
          fontWeight: 500,
          textAlign: "center",
          opacity: plansOp,
          lineHeight: 1.2,
        }}
      >
        Trois formules. Un seul système.
      </div>

      {/* Tarifs */}
      <div
        style={{
          marginTop: 36,
          display: "flex",
          gap: format === "landscape" ? 40 : 18,
          opacity: plansOp,
          transform: `translateY(${interpolate(plansOp, [0, 1], [12, 0])}px)`,
        }}
      >
        {PLANS.map((p) => (
          <div
            key={p.nom}
            style={{
              padding: "20px 28px",
              borderRadius: 12,
              background: p.highlight ? COLORS.text : "transparent",
              border: `1px solid ${p.highlight ? COLORS.text : COLORS.text + "22"}`,
              minWidth: 170,
              textAlign: "center",
              fontFamily: FONT_BODY,
              color: p.highlight ? COLORS.bg : COLORS.text,
            }}
          >
            <div
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.28em",
                fontWeight: 600,
                color: p.highlight ? COLORS.gold : COLORS.ocre,
              }}
            >
              {p.nom}
            </div>
            <div
              style={{
                marginTop: 10,
                fontFamily: FONT_DISPLAY,
                fontSize: 38,
                fontWeight: 600,
                lineHeight: 1,
              }}
            >
              {p.prix}€
            </div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>HT / mois</div>
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>{p.baseline}</div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div
        style={{
          marginTop: 36,
          opacity: ctaOp,
          transform: `translateY(${interpolate(ctaOp, [0, 1], [10, 0])}px)`,
          padding: "16px 38px",
          background: COLORS.ocre,
          color: "#fff",
          borderRadius: 999,
          fontFamily: FONT_BODY,
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: "0.04em",
          boxShadow: `0 18px 40px -18px ${COLORS.ocre}`,
        }}
      >
        Réserver une démo en visio →
      </div>

      <div
        style={{
          marginTop: 22,
          fontFamily: FONT_BODY,
          fontSize: 13,
          color: COLORS.text,
          textTransform: "uppercase",
          letterSpacing: "0.42em",
          fontWeight: 500,
          opacity: urlOp,
        }}
      >
        flowtravel.fr
      </div>
    </AbsoluteFill>
  );
};

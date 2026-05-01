import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS, FONT_BODY, FONT_DISPLAY } from "../theme";
import type { Format } from "../MainVideo";

// Scene 9 (anciennement Pilotage) — TRÉSORERIE RÉELLE vs ACOMPTES
// Le pain point n°1 : montrer que les acomptes clients ne sont pas à l'agence
export const Scene9Pilotage: React.FC<{ format: Format }> = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animation des chiffres
  const compteBancaire = Math.round(interpolate(frame, [10, 60], [0, 247800], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const acomptes = Math.round(interpolate(frame, [80, 130], [0, 87400], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const fournisseurs = Math.round(interpolate(frame, [120, 170], [0, 18200], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const reelle = Math.round(interpolate(frame, [180, 230], [0, 142200], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));

  // Apparition séquentielle des blocs
  const showAcomptes = spring({ frame: frame - 75, fps, config: { damping: 22, stiffness: 130 } });
  const showFour = spring({ frame: frame - 115, fps, config: { damping: 22, stiffness: 130 } });
  const showReelle = spring({ frame: frame - 175, fps, config: { damping: 18, stiffness: 110 } });

  // Pulse final sur le chiffre vert
  const pulse = Math.sin((frame - 200) * 0.15) * 0.02 + 1;
  const reellePulse = frame > 210 ? pulse : 1;

  return (
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}>
      {/* Module label */}
      <div style={{
        position: "absolute",
        top: 50,
        left: 60,
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.32em",
        color: COLORS.gold,
        fontWeight: 600,
      }}>
        08 · Trésorerie pilotée
      </div>

      <div style={{
        width: "75%",
        maxWidth: 980,
        display: "flex",
        flexDirection: "column",
        gap: 24,
        fontFamily: FONT_BODY,
      }}>
        {/* Titre */}
        <div style={{ textAlign: "center", marginBottom: 10 }}>
          <div style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 36,
            color: COLORS.text,
            fontWeight: 500,
            letterSpacing: "-0.01em",
          }}>
            Combien d'argent avez-vous <em style={{ color: COLORS.ocre, fontStyle: "italic" }}>vraiment</em> ?
          </div>
        </div>

        {/* Bloc 1 : compte bancaire */}
        <div style={{
          backgroundColor: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: "24px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", color: COLORS.textMuted, fontWeight: 600 }}>
              Compte bancaire agence
            </div>
            <div style={{ fontSize: 12, color: COLORS.textSubtle, marginTop: 4 }}>
              Solde brut · BNP Paribas Pro
            </div>
          </div>
          <div style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 56,
            color: COLORS.text,
            fontWeight: 500,
          }}>
            {compteBancaire.toLocaleString("fr-FR")} €
          </div>
        </div>

        {/* Bloc 2 : moins acomptes */}
        <div style={{
          opacity: showAcomptes,
          transform: `translateY(${interpolate(showAcomptes, [0, 1], [20, 0])}px)`,
          backgroundColor: "#FBF1ED",
          border: `1px solid ${COLORS.ocre}40`,
          borderLeft: `4px solid ${COLORS.ocre}`,
          borderRadius: 12,
          padding: "20px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", color: COLORS.ocre, fontWeight: 600 }}>
              − Acomptes clients (24 dossiers)
            </div>
            <div style={{ fontSize: 12, color: COLORS.textSubtle, marginTop: 4 }}>
              Pas à vous · à reverser aux fournisseurs
            </div>
          </div>
          <div style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 36,
            color: COLORS.ocre,
            fontWeight: 500,
          }}>
            − {acomptes.toLocaleString("fr-FR")} €
          </div>
        </div>

        {/* Bloc 3 : moins fournisseurs */}
        <div style={{
          opacity: showFour,
          transform: `translateY(${interpolate(showFour, [0, 1], [20, 0])}px)`,
          backgroundColor: "#FBF1ED",
          border: `1px solid ${COLORS.ocre}40`,
          borderLeft: `4px solid ${COLORS.ocre}`,
          borderRadius: 12,
          padding: "20px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", color: COLORS.ocre, fontWeight: 600 }}>
              − Soldes fournisseurs à venir
            </div>
            <div style={{ fontSize: 12, color: COLORS.textSubtle, marginTop: 4 }}>
              Engagements signés · 30 jours
            </div>
          </div>
          <div style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 36,
            color: COLORS.ocre,
            fontWeight: 500,
          }}>
            − {fournisseurs.toLocaleString("fr-FR")} €
          </div>
        </div>

        {/* Bloc final : trésorerie réelle */}
        <div style={{
          opacity: showReelle,
          transform: `translateY(${interpolate(showReelle, [0, 1], [30, 0])}px) scale(${reellePulse})`,
          background: `linear-gradient(135deg, ${COLORS.olive}15 0%, ${COLORS.olive}30 100%)`,
          border: `2px solid ${COLORS.olive}`,
          borderRadius: 14,
          padding: "30px 36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: `0 20px 50px ${COLORS.olive}30`,
        }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: COLORS.olive, fontWeight: 700 }}>
              Trésorerie réelle disponible
            </div>
            <div style={{ fontSize: 13, color: COLORS.text, marginTop: 6, fontStyle: "italic" }}>
              Ce qui est <strong>vraiment</strong> à l'agence
            </div>
          </div>
          <div style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 64,
            color: COLORS.olive,
            fontWeight: 500,
          }}>
            {reelle.toLocaleString("fr-FR")} €
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

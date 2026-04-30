import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { AppShot, FTCard, FTBadge, FTPageHeader } from "../components/AppShot";
import { COLORS, FONT_BODY, FONT_DISPLAY } from "../theme";
import type { Format } from "../MainVideo";

export const Scene5Envoi: React.FC<{ format: Format }> = () => {
  const frame = useCurrentFrame();
  const linkAppear = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" });
  const emailAppear = interpolate(frame, [40, 70], [0, 1], { extrapolateRight: "clamp" });
  const sentBadge = interpolate(frame, [110, 140], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <AppShot route="/cotations/voyage-japon-marchand" active="Cotations" moduleLabel="04 · ENVOI">
        <FTPageHeader
          title="Envoyer la cotation"
          description="Lien partageable, email automatique, signature en ligne"
          action={<FTBadge variant="success">Prêt à envoyer</FTBadge>}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
          {/* Lien public */}
          <FTCard style={{ opacity: linkAppear }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: COLORS.gold, fontWeight: 600 }}>
              Lien public sécurisé
            </div>
            <div style={{ marginTop: 14, padding: "12px 14px", backgroundColor: COLORS.bgSoft, borderRadius: 6, fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: COLORS.text, border: `1px dashed ${COLORS.border}` }}>
              🔗 lavoyagerie.fr/voyage/<span style={{ color: COLORS.ocre }}>japon-marchand</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button style={btn(COLORS.text, COLORS.bg)}>📋 Copier le lien</button>
              <button style={btn(COLORS.bg, COLORS.text, true)}>👁 Aperçu</button>
            </div>

            <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 11, color: COLORS.textMuted, display: "flex", justifyContent: "space-between" }}>
                <span>Validité</span><span>30 jours</span>
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                <span>Signature électronique</span><span style={{ color: COLORS.olive }}>Activée</span>
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                <span>Tracking ouvertures</span><span style={{ color: COLORS.olive }}>Activé</span>
              </div>
            </div>
          </FTCard>

          {/* Email auto */}
          <FTCard style={{ opacity: emailAppear, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${COLORS.border}`, backgroundColor: COLORS.bgSoft }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: COLORS.gold, fontWeight: 600 }}>
                Email automatique
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 6 }}>
                À : sophie.marchand@gmail.com
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
                De : camille@lavoyagerie.fr
              </div>
            </div>
            <div style={{ padding: 16, fontSize: 12, color: COLORS.text, lineHeight: 1.55 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, marginBottom: 8 }}>
                Votre voyage au Japon ✨
              </div>
              <div>Bonjour Sophie,</div>
              <div style={{ marginTop: 6 }}>
                J'ai le plaisir de vous adresser votre <span style={{ color: COLORS.ocre, fontWeight: 600 }}>carnet de voyage personnalisé</span> pour le Japon. 14 jours, deux voyageurs, départ le 12 mai...
              </div>
              <div style={{ marginTop: 10, color: COLORS.textMuted, fontStyle: "italic", fontSize: 11 }}>
                — Généré et personnalisé automatiquement
              </div>
            </div>
            <div style={{ padding: "10px 16px", borderTop: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "flex-end" }}>
              <div style={{ opacity: sentBadge, transform: `scale(${interpolate(sentBadge, [0,1], [0.85, 1])})` }}>
                <FTBadge variant="success">✓ Envoyé · vue 2 fois</FTBadge>
              </div>
            </div>
          </FTCard>
        </div>
      </AppShot>
    </AbsoluteFill>
  );
};

const btn = (bg: string, color: string, outline = false): React.CSSProperties => ({
  backgroundColor: bg,
  color,
  padding: "8px 14px",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 500,
  border: outline ? `1px solid ${COLORS.border}` : "none",
  fontFamily: FONT_BODY,
  cursor: "pointer",
});

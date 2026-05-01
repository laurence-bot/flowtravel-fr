import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { AppShot, FTCard, FTBadge, FTPageHeader } from "../components/AppShot";
import { COLORS, FONT_BODY, FONT_DISPLAY } from "../theme";
import type { Format } from "../MainVideo";

const LIGNES = [
  { type: "Vol", desc: "Air France · CDG → HND · 2 pax · Premium Eco", achat: 2840, vente: 3320, devise: "EUR" },
  { type: "Hôtel", desc: "Park Hyatt Tokyo · 3 nuits · Suite Park", achat: 1620, vente: 2050, devise: "JPY" },
  { type: "Ryokan", desc: "Hakone · Gora Kadan · 2 nuits demi-pension", achat: 980, vente: 1280, devise: "JPY" },
  { type: "Train", desc: "JR Pass 14 jours · 2 pax · première classe", achat: 720, vente: 880, devise: "EUR" },
  { type: "Guide", desc: "Kyoto · 2 jours guide francophone privé", achat: 540, vente: 770, devise: "USD" },
  { type: "Transferts", desc: "Aéroports + gares · véhicule privé", achat: 280, vente: 380, devise: "JPY" },
];

export const Scene3Cotation: React.FC<{ format: Format }> = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const totalAchat = LIGNES.reduce((s, l) => s + l.achat, 0);
  const totalVente = LIGNES.reduce((s, l) => s + l.vente, 0);
  const marge = totalVente - totalAchat;
  const margePct = (marge / totalVente) * 100;

  const margeAnim = Math.round(interpolate(frame, [40, 140], [0, marge], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const venteAnim = Math.round(interpolate(frame, [40, 140], [0, totalVente], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const pctAnim = interpolate(frame, [40, 140], [0, margePct], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Alerte marge bienveillante : apparaît à 200, disparaît à 320
  const alertSpring = spring({ frame: frame - 200, fps, config: { damping: 18, stiffness: 130 } });
  const alertOpacity = interpolate(frame, [200, 220, 330, 355], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <AppShot route="/cotations/sophie-marchand-japon" active="Cotations" moduleLabel="02 · COTATION">
        <FTPageHeader
          title="Voyage Japon — Sophie & Antoine Marchand"
          description="14 jours · 2 voyageurs · Mai 2026 · Sur-mesure"
          action={<FTBadge variant="warning">En cours</FTBadge>}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 16 }}>
          <FTCard style={{ padding: 0, overflow: "hidden" }}>
            <div style={{
              padding: "10px 14px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em",
              color: COLORS.textMuted, backgroundColor: COLORS.bgSoft, borderBottom: `1px solid ${COLORS.border}`,
              fontWeight: 600, display: "grid", gridTemplateColumns: "0.7fr 2.2fr 0.6fr 0.7fr 0.7fr", gap: 10,
            }}>
              <div>Type</div><div>Prestation</div><div>Devise</div>
              <div style={{ textAlign: "right" }}>Achat</div><div style={{ textAlign: "right" }}>Vente</div>
            </div>
            {LIGNES.map((l, i) => {
              const opacity = interpolate(frame, [10 + i * 6, 30 + i * 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const tX = interpolate(frame, [10 + i * 6, 30 + i * 6], [-12, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const margeL = l.vente - l.achat;
              return (
                <div key={i} style={{
                  padding: "11px 14px", fontSize: 12,
                  borderBottom: i < LIGNES.length - 1 ? `1px solid ${COLORS.borderSoft}` : "none",
                  display: "grid", gridTemplateColumns: "0.7fr 2.2fr 0.6fr 0.7fr 0.7fr", gap: 10,
                  opacity, transform: `translateX(${tX}px)`, alignItems: "center",
                }}>
                  <div><FTBadge variant="default">{l.type}</FTBadge></div>
                  <div style={{ color: COLORS.text }}>{l.desc}</div>
                  <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: COLORS.textMuted }}>{l.devise}</div>
                  <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, textAlign: "right", color: COLORS.cost }}>{l.achat.toLocaleString("fr-FR")} €</div>
                  <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, textAlign: "right", color: COLORS.text, fontWeight: 600 }}>
                    {l.vente.toLocaleString("fr-FR")} €
                    <div style={{ fontSize: 9, color: COLORS.olive, fontWeight: 500 }}>+{margeL} €</div>
                  </div>
                </div>
              );
            })}
          </FTCard>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <FTCard style={{ background: `linear-gradient(135deg, ${COLORS.bg} 0%, ${COLORS.gold}20 100%)` }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: COLORS.textMuted, fontWeight: 600 }}>Total client</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 36, color: COLORS.text, marginTop: 4, fontWeight: 500 }}>{venteAnim.toLocaleString("fr-FR")} €</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>Acompte 30% · {Math.round(venteAnim * 0.3).toLocaleString("fr-FR")} €</div>
            </FTCard>

            <FTCard style={{ background: `linear-gradient(135deg, ${COLORS.bg} 0%, ${COLORS.olive}20 100%)`, border: `1px solid ${COLORS.olive}50` }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: COLORS.olive, fontWeight: 600 }}>Marge agence</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 36, color: COLORS.olive, marginTop: 4, fontWeight: 500 }}>{margeAnim.toLocaleString("fr-FR")} €</div>
              <div style={{ fontSize: 11, color: COLORS.olive, marginTop: 2, fontWeight: 600 }}>{pctAnim.toFixed(1)}% du CA · objectif agence 18%</div>
              <div style={{ marginTop: 10, height: 4, backgroundColor: COLORS.borderSoft, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${interpolate(frame, [40, 140], [0, margePct * 3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}%`, backgroundColor: COLORS.olive }} />
              </div>
            </FTCard>

            <FTCard>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: COLORS.textMuted, fontWeight: 600, marginBottom: 6 }}>Recalcul temps réel</div>
              <div style={{ fontSize: 11, color: COLORS.text, lineHeight: 1.5 }}>
                Chaque ligne ajustée → marge mise à jour. Multi-devises géré nativement.
              </div>
            </FTCard>
          </div>
        </div>

        {/* Toast bienveillant — alerte marge sous objectif */}
        <div style={{
          position: "absolute",
          bottom: 28,
          right: 36,
          opacity: alertOpacity,
          transform: `translateY(${interpolate(alertSpring, [0, 1], [40, 0])}px)`,
          backgroundColor: COLORS.card,
          border: `1px solid ${COLORS.gold}`,
          borderLeft: `4px solid ${COLORS.gold}`,
          borderRadius: 10,
          padding: "14px 18px",
          maxWidth: 420,
          boxShadow: "0 12px 30px rgba(26,24,21,0.15)",
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
        }}>
          <div style={{ fontSize: 22 }}>💛</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8C7344", textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Petit rappel marge
            </div>
            <div style={{ fontSize: 12, color: COLORS.text, marginTop: 6, lineHeight: 1.5 }}>
              Marge à <strong>14,6%</strong> — l'objectif agence est <strong>18%</strong>. Tu peux ajuster le ryokan ou le guide pour gagner 280 € sans dénaturer le voyage.
            </div>
          </div>
        </div>
      </AppShot>
    </AbsoluteFill>
  );
};

import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { AppShot, FTCard, FTBadge, FTPageHeader } from "../components/AppShot";
import { COLORS, FONT_DISPLAY } from "../theme";
import type { Format } from "../MainVideo";

// Scene 7 — FX intelligent : l'IA recommande la couverture optimale
// en croisant marge cible + timing du dossier
export const Scene7FX: React.FC<{ format: Format }> = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fade = (a: number, b: number) => interpolate(frame, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sIA = spring({ frame: frame - 100, fps, config: { damping: 16, stiffness: 110 } });

  // Marge avec / sans couverture optimisée
  const margeSans = Math.round(interpolate(frame, [180, 240], [12100, 12100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const margeAvec = Math.round(interpolate(frame, [180, 240], [12100, 12780], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const pctAvec = interpolate(frame, [180, 240], [14.0, 14.7], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <AppShot route="/couvertures-fx" active="Couvertures FX" moduleLabel="06 · FX INTELLIGENT">
        <FTPageHeader
          title="Couvertures de change pilotées par l'IA"
          description="Optimisées pour atteindre la marge cible — pas juste pour suivre le marché"
          action={<FTBadge variant="gold">Différenciateur FlowTravel</FTBadge>}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
          {/* Recommandation IA */}
          <FTCard style={{
            opacity: fade(40, 80),
            background: `linear-gradient(135deg, ${COLORS.bg} 0%, ${COLORS.gold}18 100%)`,
            borderLeft: `4px solid ${COLORS.ocre}`,
            transform: `scale(${interpolate(sIA, [0, 1], [0.96, 1])})`,
            transformOrigin: "left center",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: `linear-gradient(135deg, ${COLORS.ocre} 0%, ${COLORS.gold} 100%)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16,
              }}>✨</div>
              <div>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: COLORS.ocre, fontWeight: 700 }}>
                  Recommandation FlowTravel IA
                </div>
                <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>
                  Dossier Marchand · marge cible 18%
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16, fontSize: 13, color: COLORS.text, lineHeight: 1.6 }}>
              Achetez <strong style={{ color: COLORS.ocre }}>584 500 ¥</strong> dès aujourd'hui à <strong>171,80</strong>.
              <span style={{ display: "block", marginTop: 6, color: COLORS.textMuted, fontSize: 12 }}>
                Cette couverture sécurise les paiements Hoshinoya + Kyoto Guide
                et fait passer la marge de <strong>14,0%</strong> à <strong style={{ color: COLORS.olive }}>14,7%</strong>.
              </span>
            </div>

            {/* Tableau de raisons */}
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
              <Reason ok>JPY en baisse (−1,8% sur 30j)</Reason>
              <Reason ok>Paiements fournisseurs sous 22 jours</Reason>
              <Reason ok>Marge dossier sous objectif agence</Reason>
              <Reason ok>Liquidité disponible : 142 200 €</Reason>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button style={{ backgroundColor: COLORS.ocre, color: "#FFF", padding: "8px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "none" }}>
                Bloquer la couverture
              </button>
              <button style={{ backgroundColor: "transparent", color: COLORS.text, padding: "8px 14px", borderRadius: 6, fontSize: 12, border: `1px solid ${COLORS.border}` }}>
                Comparer 3 scénarios
              </button>
            </div>
          </FTCard>

          {/* Impact marge */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <FTCard style={{ opacity: fade(150, 185) }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: COLORS.textMuted, fontWeight: 600 }}>
                Sans optimisation FX
              </div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, color: COLORS.text, marginTop: 4 }}>
                {margeSans.toLocaleString("fr-FR")} €
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted }}>14,0% · sous l'objectif</div>
            </FTCard>

            <FTCard style={{
              opacity: fade(180, 215),
              background: `linear-gradient(135deg, ${COLORS.olive}10 0%, ${COLORS.olive}25 100%)`,
              border: `1.5px solid ${COLORS.olive}`,
              boxShadow: `0 12px 30px ${COLORS.olive}25`,
            }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: COLORS.olive, fontWeight: 700 }}>
                Avec FlowTravel IA
              </div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 32, color: COLORS.olive, marginTop: 4, fontWeight: 600 }}>
                {margeAvec.toLocaleString("fr-FR")} €
              </div>
              <div style={{ fontSize: 11, color: COLORS.olive, fontWeight: 600 }}>
                {pctAvec.toFixed(1)}% · +680 € de marge
              </div>
            </FTCard>

            <FTCard style={{ opacity: fade(220, 250), padding: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: COLORS.gold }}>
                L'IA pense à votre place
              </div>
              <div style={{ fontSize: 11, color: COLORS.text, marginTop: 6, lineHeight: 1.5 }}>
                Marge cible · timing dossier · liquidité · marché.
                Quatre variables croisées en temps réel.
              </div>
            </FTCard>
          </div>
        </div>
      </AppShot>
    </AbsoluteFill>
  );
};

const Reason: React.FC<{ ok?: boolean; children: React.ReactNode }> = ({ ok, children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: COLORS.text }}>
    <span style={{ color: ok ? COLORS.olive : COLORS.ocre, fontWeight: 700 }}>{ok ? "✓" : "!"}</span>
    {children}
  </div>
);

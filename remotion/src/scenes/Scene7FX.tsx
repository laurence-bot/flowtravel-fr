import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { AppShot, FTCard, FTBadge, FTPageHeader } from "../components/AppShot";
import { COLORS, FONT_DISPLAY } from "../theme";
import type { Format } from "../MainVideo";

export const Scene7FX: React.FC<{ format: Format }> = () => {
  const frame = useCurrentFrame();

  // Le taux qu'on couvre baisse (= meilleur achat)
  const rateNow = 0.0061;
  const rateOptim = 0.00582;
  const animRate = interpolate(frame, [40, 100], [rateNow, rateOptim], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const economy = Math.round(interpolate(frame, [40, 100], [0, 4280], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  }));

  // Sparkline points
  const points = Array.from({ length: 30 }, (_, i) => {
    const baseY = 50 + Math.sin(i / 3) * 8 + (i / 30) * -15;
    return { x: (i / 29) * 280, y: baseY };
  });
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <AbsoluteFill>
      <AppShot route="/couvertures-fx" active="Couvertures FX" moduleLabel="06 · OPTIMISEUR FX">
        <FTPageHeader
          title="Couvertures multi-devises"
          description="Achetez vos devises au bon moment — protégez vos marges"
          action={<FTBadge variant="gold">Différenciateur FlowTravel</FTBadge>}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          {/* Carte taux */}
          <FTCard>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: COLORS.gold, fontWeight: 600 }}>
                  EUR / JPY · spot
                </div>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 42, color: COLORS.text, marginTop: 4, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                  {animRate.toFixed(5)}
                </div>
                <div style={{ fontSize: 11, color: COLORS.olive, marginTop: 2 }}>
                  ▼ −{((rateNow - animRate) / rateNow * 100).toFixed(2)}% sur 30j
                </div>
              </div>
              <div style={{ width: 110, height: 60, position: "relative" }}>
                <svg width={110} height={60} viewBox="0 0 280 80">
                  <path d={pathD} fill="none" stroke={COLORS.olive} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                  <path d={`${pathD} L 280 80 L 0 80 Z`} fill={COLORS.olive} opacity={0.12} />
                </svg>
              </div>
            </div>
          </FTCard>

          {/* Économie réalisée */}
          <FTCard style={{ background: `linear-gradient(135deg, ${COLORS.olive}10 0%, ${COLORS.gold}15 100%)` }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: COLORS.olive, fontWeight: 600 }}>
              Économie suggérée
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 42, color: COLORS.olive, marginTop: 4, fontWeight: 500 }}>
              +{economy.toLocaleString("fr-FR")} €
            </div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
              vs achat au comptant · sur 4 dossiers Japon Q2
            </div>
          </FTCard>
        </div>

        {/* Recommandation IA */}
        <FTCard style={{ borderLeft: `3px solid ${COLORS.ocre}` }}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ fontSize: 22 }}>💡</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: COLORS.ocre, fontWeight: 600 }}>
                Recommandation FlowTravel
              </div>
              <div style={{ fontSize: 14, color: COLORS.text, marginTop: 6, lineHeight: 1.5 }}>
                Acheter <strong>584 500 ¥</strong> aujourd'hui pour couvrir vos engagements Hoshinoya + Kyoto Guide. Économie estimée vs spot du jour de paiement : <span style={{ color: COLORS.olive, fontWeight: 600 }}>+340 €</span>.
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button style={{ backgroundColor: COLORS.ocre, color: "#FFF", padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500, border: "none" }}>
                  Bloquer la couverture
                </button>
                <button style={{ backgroundColor: "transparent", color: COLORS.text, padding: "7px 14px", borderRadius: 6, fontSize: 12, border: `1px solid ${COLORS.border}` }}>
                  Voir le détail
                </button>
              </div>
            </div>
          </div>
        </FTCard>

        {/* Couvertures actives */}
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            { p: "EUR/USD", taux: "1,0851", q: "12 400 $", date: "Active depuis 4j" },
            { p: "EUR/JPY", taux: "172,18", q: "1,2M ¥", date: "Active depuis 12j" },
            { p: "EUR/MAD", taux: "10,89", q: "85 000 MAD", date: "Active depuis 8j" },
          ].map((c) => (
            <FTCard key={c.p} style={{ padding: 12 }}>
              <div style={{ fontSize: 10, color: COLORS.gold, fontWeight: 600, letterSpacing: "0.15em" }}>{c.p}</div>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 16, color: COLORS.text, marginTop: 4 }}>{c.taux}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{c.q}</div>
              <div style={{ fontSize: 10, color: COLORS.textSubtle, marginTop: 4 }}>{c.date}</div>
            </FTCard>
          ))}
        </div>
      </AppShot>
    </AbsoluteFill>
  );
};

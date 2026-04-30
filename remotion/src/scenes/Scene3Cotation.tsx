import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { AppShot, FTCard, FTBadge, FTPageHeader } from "../components/AppShot";
import { COLORS, FONT_BODY, FONT_DISPLAY } from "../theme";
import type { Format } from "../MainVideo";

export const Scene3Cotation: React.FC<{ format: Format }> = () => {
  const frame = useCurrentFrame();

  // Marge qui change en temps réel
  const marge = Math.round(interpolate(frame, [40, 120], [12, 23], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const ca = Math.round(interpolate(frame, [40, 120], [8500, 8500], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const margeEur = Math.round((ca * marge) / 100);

  // Options qui se cochent
  const opt1 = frame > 60;
  const opt2 = frame > 90;
  const opt3 = frame > 130;

  return (
    <AbsoluteFill>
      <AppShot route="/cotations/voyage-japon-marchand" active="Cotations" moduleLabel="02 · COTATION">
        <FTPageHeader
          title="Voyage Japon — Sophie Marchand"
          description="Cotation • 14 jours • 2 pax • Départ 12 mai 2026"
          action={<FTBadge variant="warning">Brouillon</FTBadge>}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
          {/* Left: composition prix */}
          <FTCard>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 18,
                marginBottom: 14,
                color: COLORS.text,
                fontWeight: 500,
              }}
            >
              Composition tarifaire
            </div>
            {[
              { l: "Vols Air France · Paris ⇄ Tokyo", p: "2 850 €" },
              { l: "Hôtels (12 nuits, 4★)", p: "2 980 €" },
              { l: "Transferts privés", p: "420 €" },
              { l: "Guide francophone (5 jours)", p: "890 €" },
              { l: "Activités & entrées", p: "560 €" },
            ].map((row) => (
              <div
                key={row.l}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  fontSize: 13,
                  color: COLORS.text,
                  borderBottom: `1px solid ${COLORS.borderSoft}`,
                }}
              >
                <span>{row.l}</span>
                <span style={{ fontFamily: '"JetBrains Mono", monospace', color: COLORS.textMuted }}>
                  {row.p}
                </span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 4px", fontSize: 13, color: COLORS.textMuted }}>
              <span>Coût total</span>
              <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>6 545 €</span>
            </div>

            {/* Options */}
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.18em", color: COLORS.gold, marginBottom: 8, fontWeight: 600 }}>
                Options
              </div>
              {[
                { l: "Surclassement vol Business", p: "+1 200 €", on: opt1 },
                { l: "Spa Ryokan Hakone", p: "+340 €", on: opt2 },
                { l: "Cours de cuisine kaiseki", p: "+180 €", on: opt3 },
              ].map((o) => (
                <div
                  key={o.l}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 0",
                    fontSize: 13,
                    color: o.on ? COLORS.text : COLORS.textSubtle,
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      border: `1.5px solid ${o.on ? COLORS.olive : COLORS.border}`,
                      backgroundColor: o.on ? COLORS.olive : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#FFF",
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {o.on ? "✓" : ""}
                  </div>
                  <span style={{ flex: 1 }}>{o.l}</span>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: o.on ? COLORS.olive : COLORS.textSubtle }}>
                    {o.p}
                  </span>
                </div>
              ))}
            </div>
          </FTCard>

          {/* Right: marge live */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <FTCard style={{ background: `linear-gradient(135deg, ${COLORS.bg} 0%, ${COLORS.gold}15 100%)` }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: COLORS.gold, fontWeight: 600 }}>
                Marge en temps réel
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 56, color: COLORS.olive, fontWeight: 500, lineHeight: 1 }}>
                  {marge}%
                </div>
                <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 14, color: COLORS.olive }}>
                  +{margeEur.toLocaleString("fr-FR")} €
                </div>
              </div>
              <div
                style={{
                  marginTop: 14,
                  height: 6,
                  backgroundColor: COLORS.borderSoft,
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(marge * 3, 100)}%`,
                    backgroundColor: COLORS.olive,
                    borderRadius: 3,
                    transition: "none",
                  }}
                />
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 8 }}>
                Objectif agence : 18% — atteint
              </div>
            </FTCard>

            <FTCard>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: COLORS.textMuted, fontWeight: 600 }}>
                Prix de vente TTC
              </div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 38, color: COLORS.text, marginTop: 6, fontWeight: 500 }}>
                {(ca + (opt1 ? 1200 : 0) + (opt2 ? 340 : 0) + (opt3 ? 180 : 0)).toLocaleString("fr-FR")} €
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>
                soit {Math.round((ca + (opt1 ? 1200 : 0) + (opt2 ? 340 : 0) + (opt3 ? 180 : 0)) / 2).toLocaleString("fr-FR")} € / pax
              </div>
            </FTCard>

            <FTCard style={{ padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: COLORS.textMuted }}>
                <span>TVA marge (20%)</span>
                <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>391 €</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>
                <span>Marge nette</span>
                <span style={{ fontFamily: '"JetBrains Mono", monospace', color: COLORS.olive }}>
                  {(margeEur - 391).toLocaleString("fr-FR")} €
                </span>
              </div>
            </FTCard>
          </div>
        </div>
      </AppShot>
    </AbsoluteFill>
  );
};

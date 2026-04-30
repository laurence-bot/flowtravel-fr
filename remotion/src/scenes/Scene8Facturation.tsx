import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { AppShot, FTCard, FTBadge, FTPageHeader } from "../components/AppShot";
import { COLORS, FONT_DISPLAY } from "../theme";
import type { Format } from "../MainVideo";

export const Scene8Facturation: React.FC<{ format: Format }> = () => {
  const frame = useCurrentFrame();

  const rows = [
    { type: "Acompte 1 (30%)", date: "10 fév.", m: "2 550 €", s: "Payé", v: "success" as const },
    { type: "Acompte 2 (40%)", date: "10 mars", m: "3 400 €", s: "Payé", v: "success" as const },
    { type: "Solde (30%)", date: "20 avr.", m: "2 550 €", s: "Relance auto envoyée", v: "ocre" as const },
  ];

  const progress = interpolate(frame, [20, 90], [0, 70], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <AppShot route="/dossiers/japon-marchand/facturation" active="Dossiers" moduleLabel="07 · FACTURATION">
        <FTPageHeader
          title="Facturation client"
          description="Acomptes · soldes · relances automatiques"
          action={<FTBadge variant="warning">2/3 réglés</FTBadge>}
        />

        {/* Progress bar */}
        <FTCard style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: COLORS.gold, fontWeight: 600 }}>
                Encaissé sur ce dossier
              </div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 36, color: COLORS.text, marginTop: 4, fontWeight: 500 }}>
                5 950 € <span style={{ fontSize: 16, color: COLORS.textMuted }}>/ 8 500 €</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: COLORS.olive, fontWeight: 600 }}>
                Reste à encaisser
              </div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, color: COLORS.ocre, marginTop: 4, fontWeight: 500 }}>
                2 550 €
              </div>
            </div>
          </div>
          <div style={{ height: 8, backgroundColor: COLORS.borderSoft, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg, ${COLORS.olive}, ${COLORS.gold})`, borderRadius: 4 }} />
          </div>
        </FTCard>

        {/* Échéances */}
        <FTCard style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: COLORS.textMuted, fontWeight: 600, backgroundColor: COLORS.bgSoft }}>
            Échéances
          </div>
          {rows.map((r, i) => {
            const appear = interpolate(frame, [25 + i * 18, 50 + i * 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "1.5fr 0.8fr 0.8fr 1.2fr",
                padding: "14px 16px", fontSize: 13, color: COLORS.text,
                borderBottom: i < rows.length - 1 ? `1px solid ${COLORS.borderSoft}` : "none",
                opacity: appear,
                alignItems: "center",
              }}>
                <div style={{ fontWeight: 500 }}>{r.type}</div>
                <div style={{ fontSize: 12, color: COLORS.textMuted }}>{r.date}</div>
                <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13 }}>{r.m}</div>
                <div><FTBadge variant={r.v}>{r.s}</FTBadge></div>
              </div>
            );
          })}
        </FTCard>
      </AppShot>
    </AbsoluteFill>
  );
};

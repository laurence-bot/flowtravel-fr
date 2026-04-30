import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { AppShot, FTCard, FTBadge, FTPageHeader } from "../components/AppShot";
import { COLORS, FONT_DISPLAY } from "../theme";
import type { Format } from "../MainVideo";

export const Scene9Pilotage: React.FC<{ format: Format }> = () => {
  const frame = useCurrentFrame();

  // Trésorerie totale qui s'anime
  const tresoReelle = Math.round(interpolate(frame, [10, 80], [0, 142800], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const acomptes = Math.round(interpolate(frame, [10, 80], [0, 87400], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));

  return (
    <AbsoluteFill>
      <AppShot route="/pilotage" active="Pilotage" moduleLabel="08 · PILOTAGE DIRECTION">
        <FTPageHeader
          title="Pilotage agence"
          description="Vue direction · trésorerie consolidée · performance par agent"
          action={<FTBadge variant="gold">Compte admin</FTBadge>}
        />

        {/* KPI direction */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
          <FTCard style={{ background: `linear-gradient(135deg, ${COLORS.bg} 0%, ${COLORS.olive}15 100%)` }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: COLORS.olive, fontWeight: 600 }}>
              Trésorerie réelle
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 36, color: COLORS.text, marginTop: 4, fontWeight: 500 }}>
              {tresoReelle.toLocaleString("fr-FR")} €
            </div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>
              Compte gestion + anticipation
            </div>
          </FTCard>
          <FTCard style={{ background: `linear-gradient(135deg, ${COLORS.bg} 0%, ${COLORS.gold}15 100%)` }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: COLORS.gold, fontWeight: 600 }}>
              Acomptes clients
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 36, color: COLORS.text, marginTop: 4, fontWeight: 500 }}>
              {acomptes.toLocaleString("fr-FR")} €
            </div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>
              Séquestre · 24 dossiers à venir
            </div>
          </FTCard>
          <FTCard>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: COLORS.ocre, fontWeight: 600 }}>
              Marge mensuelle
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 36, color: COLORS.text, marginTop: 4, fontWeight: 500 }}>
              19,4%
            </div>
            <div style={{ fontSize: 11, color: COLORS.olive, marginTop: 4 }}>
              ▲ +2,1 pts vs mois dernier
            </div>
          </FTCard>
        </div>

        {/* Performance par agent */}
        <FTCard style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`, fontSize: 11, color: COLORS.text, fontWeight: 600, backgroundColor: COLORS.bgSoft, display: "flex", justifyContent: "space-between" }}>
            <span style={{ textTransform: "uppercase", letterSpacing: "0.15em", fontSize: 10, color: COLORS.textMuted }}>Performance agents · ce mois-ci</span>
            <span style={{ fontSize: 10, color: COLORS.gold, letterSpacing: "0.1em" }}>AVRIL 2026</span>
          </div>
          {[
            { nom: "Camille Roux", dossiers: 8, ca: "62 400 €", marge: "21,2%", color: COLORS.olive, w: 100 },
            { nom: "Thomas Vallée", dossiers: 6, ca: "48 900 €", marge: "19,8%", color: COLORS.olive, w: 78 },
            { nom: "Léa Marin", dossiers: 5, ca: "39 200 €", marge: "17,5%", color: COLORS.gold, w: 63 },
            { nom: "Antoine Becker", dossiers: 4, ca: "31 100 €", marge: "16,1%", color: COLORS.gold, w: 50 },
          ].map((a, i) => {
            const w = interpolate(frame, [40 + i * 10, 80 + i * 10], [0, a.w], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div key={a.nom} style={{
                display: "grid", gridTemplateColumns: "1.4fr 0.6fr 1fr 0.7fr 1.5fr",
                padding: "13px 16px", fontSize: 13, color: COLORS.text,
                borderBottom: i < 3 ? `1px solid ${COLORS.borderSoft}` : "none",
                alignItems: "center",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: a.color, color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600 }}>
                    {a.nom.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <span style={{ fontWeight: 500 }}>{a.nom}</span>
                </div>
                <div style={{ fontSize: 12, color: COLORS.textMuted }}>{a.dossiers} dossiers</div>
                <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13 }}>{a.ca}</div>
                <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: a.color, fontWeight: 600 }}>{a.marge}</div>
                <div style={{ height: 6, backgroundColor: COLORS.borderSoft, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${w}%`, backgroundColor: a.color, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </FTCard>
      </AppShot>
    </AbsoluteFill>
  );
};

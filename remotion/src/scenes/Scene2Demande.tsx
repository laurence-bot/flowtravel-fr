import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { AppShot, FTCard, FTBadge, FTPageHeader, Highlight } from "../components/AppShot";
import { COLORS, FONT_BODY, FONT_DISPLAY } from "../theme";
import type { Format } from "../MainVideo";

const ROWS = [
  { nom: "Sophie Marchand", dest: "Japon · 14 jours · 2 pax", canal: "Site web", date: "il y a 12 min", statut: "Nouvelle", variant: "ocre" as const, budget: "8 500 €" },
  { nom: "Famille Dubois", dest: "Maroc · 7 jours · 4 pax", canal: "Email", date: "il y a 2 h", statut: "En cours", variant: "warning" as const, budget: "6 200 €" },
  { nom: "Marc & Julie Lemoine", dest: "Patagonie · 21 jours · 2 pax", canal: "Téléphone", date: "hier", statut: "À relancer", variant: "default" as const, budget: "14 800 €" },
  { nom: "Laure Petit", dest: "Italie · 10 jours · 2 pax", canal: "Site web", date: "hier", statut: "Transformée", variant: "success" as const, budget: "5 400 €" },
];

export const Scene2Demande: React.FC<{ format: Format }> = () => {
  const frame = useCurrentFrame();
  // Highlight bouton "Transformer en cotation" à partir de la frame 70
  return (
    <AbsoluteFill>
      <AppShot route="/demandes" active="Demandes" moduleLabel="01 · DEMANDES">
        <FTPageHeader
          title="Demandes clients"
          description="Centralisez vos demandes entrantes — site, email, téléphone."
          action={
            <button
              style={{
                backgroundColor: COLORS.text,
                color: COLORS.bg,
                padding: "8px 14px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                border: "none",
                fontFamily: FONT_BODY,
              }}
            >
              + Nouvelle demande
            </button>
          }
        />

        {/* Stat row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
          {[
            { l: "Nouvelles", v: "12", c: COLORS.ocre },
            { l: "En cours", v: "8", c: COLORS.gold },
            { l: "À relancer", v: "5", c: COLORS.textMuted },
            { l: "Cette semaine", v: "31", c: COLORS.olive },
          ].map((s) => (
            <FTCard key={s.l} style={{ padding: 14 }}>
              <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.15em" }}>
                {s.l}
              </div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, color: s.c, marginTop: 4, fontWeight: 500 }}>
                {s.v}
              </div>
            </FTCard>
          ))}
        </div>

        {/* Table */}
        <FTCard style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 2fr 0.8fr 0.8fr 0.8fr 1fr",
              padding: "12px 16px",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              color: COLORS.textMuted,
              borderBottom: `1px solid ${COLORS.border}`,
              backgroundColor: COLORS.bgSoft,
              fontWeight: 600,
            }}
          >
            <div>Client</div>
            <div>Voyage</div>
            <div>Canal</div>
            <div>Date</div>
            <div>Budget</div>
            <div>Statut</div>
          </div>
          {ROWS.map((r, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1.6fr 2fr 0.8fr 0.8fr 0.8fr 1fr",
                padding: "14px 16px",
                fontSize: 13,
                color: COLORS.text,
                borderBottom: i < ROWS.length - 1 ? `1px solid ${COLORS.borderSoft}` : "none",
                backgroundColor: i === 0 ? "rgba(201,169,110,0.06)" : "transparent",
                position: "relative",
              }}
            >
              <div style={{ fontWeight: 500 }}>{r.nom}</div>
              <div style={{ color: COLORS.textMuted, fontSize: 12 }}>{r.dest}</div>
              <div style={{ fontSize: 12 }}>{r.canal}</div>
              <div style={{ fontSize: 11, color: COLORS.textSubtle }}>{r.date}</div>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>{r.budget}</div>
              <div>
                <FTBadge variant={r.variant}>{r.statut}</FTBadge>
              </div>
            </div>
          ))}
        </FTCard>

        {/* Cursor + bouton "Transformer en cotation" qui apparaît */}
        <div style={{ position: "absolute", bottom: 30, right: 36 }}>
          <CursorButton />
        </div>
      </AppShot>
    </AbsoluteFill>
  );
};

const CursorButton: React.FC = () => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [70, 90], [0, 1], { extrapolateRight: "clamp" });
  const scale = interpolate(frame, [70, 90, 110, 118], [0.9, 1, 1, 0.96], { extrapolateRight: "clamp" });
  const ringOp = interpolate(frame, [105, 118, 130, 145], [0, 0.6, 0.6, 0], { extrapolateRight: "clamp" });

  return (
    <div style={{ opacity: op, transform: `scale(${scale})`, position: "relative" }}>
      <div
        style={{
          backgroundColor: COLORS.ocre,
          color: "#FFF",
          padding: "10px 18px",
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 500,
          fontFamily: FONT_BODY,
          boxShadow: "0 8px 24px rgba(161,78,44,0.3)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        ✨ Transformer en cotation
      </div>
      {/* Click ring */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: interpolate(frame, [105, 130], [0, 120], { extrapolateRight: "clamp", extrapolateLeft: "clamp" }),
          height: interpolate(frame, [105, 130], [0, 120], { extrapolateRight: "clamp", extrapolateLeft: "clamp" }),
          borderRadius: "50%",
          border: `2px solid ${COLORS.ocre}`,
          opacity: ringOp,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

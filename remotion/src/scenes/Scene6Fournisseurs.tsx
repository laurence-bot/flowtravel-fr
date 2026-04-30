import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { AppShot, FTCard, FTBadge, FTPageHeader } from "../components/AppShot";
import { COLORS, FONT_BODY, FONT_DISPLAY } from "../theme";
import type { Format } from "../MainVideo";

const FACTURES = [
  { four: "Air France", ref: "AF-2026-3421", devise: "EUR", montant: "2 850,00", echeance: "12 avr.", statut: "Payée", v: "success" as const },
  { four: "Hoshinoya Ryokan", ref: "HSY-J89", devise: "JPY", montant: "486 000", echeance: "28 avr.", statut: "Acompte 50%", v: "warning" as const },
  { four: "Kyoto Guide Co.", ref: "KGC-1124", devise: "JPY", montant: "98 500", echeance: "5 mai", statut: "À payer", v: "ocre" as const },
  { four: "DMC Tokyo Premium", ref: "DTP-9921", devise: "USD", montant: "1 240,00", echeance: "10 mai", statut: "Échéance 1/3", v: "default" as const },
];

export const Scene6Fournisseurs: React.FC<{ format: Format }> = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <AppShot route="/dossiers/japon-marchand/fournisseurs" active="Dossiers" moduleLabel="05 · FOURNISSEURS">
        <FTPageHeader
          title="Fournisseurs & factures"
          description="Multi-devises · échéances · acomptes · suivi consolidé"
          action={
            <div style={{ display: "flex", gap: 8 }}>
              <FTBadge variant="default">JPY · USD · EUR</FTBadge>
              <FTBadge variant="success">4 factures</FTBadge>
            </div>
          }
        />

        {/* KPI multi-devises */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
          {[
            { l: "EUR engagé", v: "2 850 €", c: COLORS.text, sub: "1 facture · payée" },
            { l: "JPY engagé", v: "584 500 ¥", c: COLORS.ocre, sub: "≈ 3 620 € · 2 factures" },
            { l: "USD engagé", v: "1 240 $", c: COLORS.gold, sub: "≈ 1 145 € · 1 facture" },
          ].map((s) => (
            <FTCard key={s.l} style={{ padding: 14 }}>
              <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.15em" }}>{s.l}</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, color: s.c, marginTop: 4, fontWeight: 500 }}>{s.v}</div>
              <div style={{ fontSize: 11, color: COLORS.textSubtle, marginTop: 4 }}>{s.sub}</div>
            </FTCard>
          ))}
        </div>

        {/* Table factures */}
        <FTCard style={{ padding: 0, overflow: "hidden" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "1.6fr 1fr 0.6fr 1fr 0.8fr 1fr",
            padding: "12px 16px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em",
            color: COLORS.textMuted, borderBottom: `1px solid ${COLORS.border}`, backgroundColor: COLORS.bgSoft, fontWeight: 600,
          }}>
            <div>Fournisseur</div><div>Référence</div><div>Devise</div><div>Montant</div><div>Échéance</div><div>Statut</div>
          </div>
          {FACTURES.map((f, i) => {
            const appear = interpolate(frame, [15 + i * 12, 35 + i * 12], [0, 1], {
              extrapolateLeft: "clamp", extrapolateRight: "clamp",
            });
            return (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "1.6fr 1fr 0.6fr 1fr 0.8fr 1fr",
                padding: "13px 16px", fontSize: 13, color: COLORS.text,
                borderBottom: i < FACTURES.length - 1 ? `1px solid ${COLORS.borderSoft}` : "none",
                opacity: appear,
              }}>
                <div style={{ fontWeight: 500 }}>{f.four}</div>
                <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: COLORS.textMuted }}>{f.ref}</div>
                <div><FTBadge variant={f.devise === "EUR" ? "default" : f.devise === "JPY" ? "ocre" : "gold"}>{f.devise}</FTBadge></div>
                <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>{f.montant}</div>
                <div style={{ fontSize: 12, color: COLORS.textMuted }}>{f.echeance}</div>
                <div><FTBadge variant={f.v}>{f.statut}</FTBadge></div>
              </div>
            );
          })}
        </FTCard>
      </AppShot>
    </AbsoluteFill>
  );
};

import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { AppShot, FTCard, FTBadge, FTPageHeader } from "../components/AppShot";
import { COLORS, FONT_BODY, FONT_DISPLAY } from "../theme";
import type { Format } from "../MainVideo";

// Scene 5 — Envoi → Acceptation → Bulletin signé → Facture auto
export const Scene5Envoi: React.FC<{ format: Format }> = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Étapes (chaque étape apparaît avec un spring)
  const step = (delay: number) => spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 140 } });
  const fade = (a: number, b: number) => interpolate(frame, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const sEnvoi = step(10);
  const sAccept = step(70);
  const sBulletin = step(140);
  const sSign = step(210);
  const sFacture = step(265);

  return (
    <AbsoluteFill>
      <AppShot route="/dossiers/japon-marchand" active="Dossiers" moduleLabel="05 · ENVOI → SIGNATURE → FACTURE">
        <FTPageHeader
          title="Du devis à la facture, automatiquement"
          description="Sophie reçoit, signe, l'agence facture — sans intervention"
          action={<FTBadge variant="success">Workflow auto</FTBadge>}
        />

        {/* Timeline horizontale */}
        <div style={{ position: "relative", marginTop: 10 }}>
          {/* Ligne de fond */}
          <div style={{
            position: "absolute", top: 32, left: 40, right: 40, height: 2,
            backgroundColor: COLORS.borderSoft,
          }} />
          {/* Ligne progressive */}
          <div style={{
            position: "absolute", top: 32, left: 40, height: 2,
            width: `${interpolate(frame, [10, 280], [0, 92], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}%`,
            backgroundColor: COLORS.olive,
          }} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, paddingTop: 12 }}>
            <Step n={1} label="Devis envoyé" sub="Email + lien" emoji="✉️" appear={sEnvoi} done />
            <Step n={2} label="Acceptation" sub="Sophie ✓" emoji="👍" appear={sAccept} done={frame > 100} />
            <Step n={3} label="Bulletin signé" sub="Signature électronique" emoji="✍️" appear={sBulletin} done={frame > 230} highlight />
            <Step n={4} label="Acompte 30%" sub="Virement reçu" emoji="💳" appear={sSign} done={frame > 250} />
            <Step n={5} label="Facture émise" sub="PDF auto + envoi" emoji="🧾" appear={sFacture} done={frame > 295} highlight />
          </div>
        </div>

        {/* Carte qui zoome sur le bulletin signé puis la facture */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 28 }}>
          {/* Bulletin */}
          <FTCard style={{
            opacity: fade(140, 175),
            transform: `translateY(${interpolate(sBulletin, [0, 1], [20, 0])}px)`,
            padding: 0, overflow: "hidden",
          }}>
            <div style={{ padding: "10px 14px", borderBottom: `1px solid ${COLORS.border}`, backgroundColor: COLORS.bgSoft, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: COLORS.gold }}>
                Bulletin d'inscription
              </span>
              {frame > 220 && <FTBadge variant="success">✓ Signé · 14:32</FTBadge>}
            </div>
            <div style={{ padding: 16, fontSize: 11, color: COLORS.text, lineHeight: 1.6, fontFamily: FONT_BODY }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: COLORS.text, marginBottom: 8 }}>
                Voyage Japon — 14 jours
              </div>
              <div>Sophie & Antoine Marchand · 2 pax</div>
              <div>Départ : 12 mai 2026 · Retour : 25 mai 2026</div>
              <div>Total : <strong>8 680 €</strong> · Acompte 30% : 2 604 €</div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${COLORS.border}` }}>
                <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.14em" }}>Conditions</div>
                <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 4 }}>
                  Annulation, modification, assurance · cf. CGV
                </div>
              </div>
              {/* Signature animée */}
              <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                <div style={{
                  fontFamily: '"Cormorant Garamond", serif',
                  fontStyle: "italic",
                  fontSize: 22,
                  color: COLORS.ocre,
                  opacity: fade(215, 235),
                  borderBottom: `1px solid ${COLORS.text}30`,
                  paddingBottom: 2,
                }}>
                  Sophie M.
                </div>
              </div>
            </div>
          </FTCard>

          {/* Facture */}
          <FTCard style={{
            opacity: fade(265, 295),
            transform: `translateY(${interpolate(sFacture, [0, 1], [20, 0])}px)`,
            padding: 0, overflow: "hidden",
          }}>
            <div style={{ padding: "10px 14px", borderBottom: `1px solid ${COLORS.border}`, backgroundColor: COLORS.bgSoft, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: COLORS.ocre }}>
                Facture FA-2026-0341
              </span>
              <FTBadge variant="ocre">Générée auto</FTBadge>
            </div>
            <div style={{ padding: 16, fontSize: 11, color: COLORS.text, lineHeight: 1.6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 9, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.14em" }}>De</div>
                  <div>La Voyagerie SARL</div>
                  <div style={{ color: COLORS.textMuted }}>FR 23 891 234 567</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.14em" }}>À</div>
                  <div>S. Marchand</div>
                  <div style={{ color: COLORS.textMuted }}>Paris 11ᵉ</div>
                </div>
              </div>

              <div style={{ marginTop: 14, padding: "10px 12px", backgroundColor: COLORS.bgSoft, borderRadius: 6, display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: COLORS.text }}>Voyage Japon · sur-mesure 14j</span>
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 600 }}>8 680,00 €</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: COLORS.textMuted, display: "flex", justifyContent: "space-between" }}>
                <span>TVA marge (Art. 266)</span><span>incluse</span>
              </div>

              <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.14em" }}>Total TTC</span>
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: COLORS.ocre, fontWeight: 600 }}>8 680,00 €</span>
              </div>
            </div>
          </FTCard>
        </div>
      </AppShot>
    </AbsoluteFill>
  );
};

const Step: React.FC<{
  n: number; label: string; sub: string; emoji: string;
  appear: number; done?: boolean; highlight?: boolean;
}> = ({ n, label, sub, emoji, appear, done, highlight }) => (
  <div style={{
    opacity: appear,
    transform: `translateY(${interpolate(appear, [0, 1], [12, 0])}px)`,
    display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
  }}>
    <div style={{
      width: 56, height: 56, borderRadius: "50%",
      backgroundColor: done ? (highlight ? COLORS.ocre : COLORS.olive) : COLORS.card,
      border: `2px solid ${done ? (highlight ? COLORS.ocre : COLORS.olive) : COLORS.border}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 22, color: "#FFF",
      boxShadow: done ? `0 6px 20px ${(highlight ? COLORS.ocre : COLORS.olive)}40` : "none",
    }}>
      {done ? "✓" : emoji}
    </div>
    <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: COLORS.text }}>{label}</div>
    <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>{sub}</div>
  </div>
);

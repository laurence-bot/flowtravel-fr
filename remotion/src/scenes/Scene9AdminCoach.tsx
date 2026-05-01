import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { AppShot, FTCard, FTBadge, FTPageHeader } from "../components/AppShot";
import { COLORS, FONT_DISPLAY } from "../theme";
import type { Format } from "../MainVideo";

// Scene 9 — Admin & Coaching agent (split-screen)
// Gauche : vue manager (équipe, objectifs)
// Droite : vue agent (perso, messages bienveillants)
export const Scene9AdminCoach: React.FC<{ format: Format }> = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fade = (a: number, b: number) => interpolate(frame, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sCoach1 = spring({ frame: frame - 130, fps, config: { damping: 14, stiffness: 120 } });
  const sCoach2 = spring({ frame: frame - 220, fps, config: { damping: 14, stiffness: 120 } });
  const sCoach3 = spring({ frame: frame - 310, fps, config: { damping: 14, stiffness: 120 } });

  const AGENTS = [
    { nom: "Sophie M.", ca: 84200, marge: 17.8, obj: 75000, color: COLORS.olive },
    { nom: "Camille T.", ca: 67400, marge: 16.2, obj: 75000, color: COLORS.gold },
    { nom: "Thomas R.", ca: 52800, marge: 18.4, obj: 60000, color: COLORS.olive },
    { nom: "Léa B.", ca: 41500, marge: 15.1, obj: 60000, color: COLORS.ocre },
  ];

  return (
    <AbsoluteFill>
      <AppShot route="/admin/equipe" active="Pilotage" moduleLabel="09 · ADMIN & COACHING">
        <FTPageHeader
          title="Manager l'équipe — encourager les agents"
          description="Vue direction & vue agent — les bonnes infos, au bon moment"
          action={<FTBadge variant="gold">Octobre 2026</FTBadge>}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 18 }}>
          {/* === GAUCHE : Vue Manager === */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: COLORS.ocre }}>
              👔 Vue direction
            </div>

            {/* Stats globales */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <Stat label="CA équipe" value="245,9 K€" sub="+12% vs N-1" color={COLORS.olive} delay={20} />
              <Stat label="Marge moy." value="17,1%" sub="objectif 18%" color={COLORS.gold} delay={35} />
              <Stat label="Taux transfo" value="42%" sub="meilleur Q3" color={COLORS.olive} delay={50} />
            </div>

            {/* Liste agents */}
            <FTCard style={{ padding: 0, overflow: "hidden", opacity: fade(60, 100) }}>
              <div style={{ padding: "8px 14px", backgroundColor: COLORS.bgSoft, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: COLORS.textMuted, fontWeight: 600, display: "grid", gridTemplateColumns: "1.4fr 1fr 0.8fr", gap: 8 }}>
                <div>Agent</div>
                <div>CA / Objectif</div>
                <div style={{ textAlign: "right" }}>Marge</div>
              </div>
              {AGENTS.map((a, i) => {
                const opacity = interpolate(frame, [70 + i * 10, 95 + i * 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                const pct = (a.ca / a.obj) * 100;
                return (
                  <div key={a.nom} style={{
                    padding: "10px 14px", display: "grid", gridTemplateColumns: "1.4fr 1fr 0.8fr", gap: 8, alignItems: "center",
                    borderBottom: i < AGENTS.length - 1 ? `1px solid ${COLORS.borderSoft}` : "none",
                    fontSize: 12, opacity,
                  }}>
                    <div>
                      <div style={{ color: COLORS.text, fontWeight: 600 }}>{a.nom}</div>
                      <div style={{ fontSize: 10, color: COLORS.textMuted }}>{a.ca.toLocaleString("fr-FR")} €</div>
                    </div>
                    <div>
                      <div style={{ height: 6, backgroundColor: COLORS.borderSoft, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, backgroundColor: a.color, transition: "none" }} />
                      </div>
                      <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 3 }}>{pct.toFixed(0)}% objectif</div>
                    </div>
                    <div style={{ textAlign: "right", fontFamily: '"JetBrains Mono", monospace', color: a.color, fontWeight: 600 }}>
                      {a.marge}%
                    </div>
                  </div>
                );
              })}
            </FTCard>
          </div>

          {/* === DROITE : Vue Agent (Sophie) === */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: COLORS.gold }}>
              💛 Vue agent · Sophie
            </div>

            {/* Message 1 : victoire */}
            <Coach
              opacity={sCoach1}
              tone="win"
              title="Bravo Sophie ! 🎉"
              text="Le voyage Marchand est signé. +1 240 € de marge dossier. Tu enchaînes 3 ventes cette semaine, tu es à 112% de ton objectif mensuel."
            />

            {/* Message 2 : perte bienveillante */}
            <Coach
              opacity={sCoach2}
              tone="loss"
              title="Pas grave 🌿"
              text="Le dossier Dubois n'a pas abouti. Tu as fait toutes les relances, le suivi était nickel. Le client n'était simplement pas prêt — ça arrive. La prochaine fois sera la bonne."
            />

            {/* Message 3 : alerte gentille */}
            <Coach
              opacity={sCoach3}
              tone="warn"
              title="Petit point marge 💡"
              text="Sur les 5 derniers devis, tu es à 14,8% de marge. L'objectif agence est 18%. On regarde ensemble ? Souvent un ajustement guide ou ryokan suffit."
            />
          </div>
        </div>
      </AppShot>
    </AbsoluteFill>
  );
};

const Stat: React.FC<{ label: string; value: string; sub: string; color: string; delay: number }> = ({ label, value, sub, color, delay }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + 25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tY = interpolate(frame, [delay, delay + 25], [10, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ opacity, transform: `translateY(${tY}px)`, backgroundColor: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 10 }}>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", color: COLORS.textMuted, fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color, marginTop: 2, fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 10, color: COLORS.textMuted }}>{sub}</div>
    </div>
  );
};

const Coach: React.FC<{ opacity: number; tone: "win" | "loss" | "warn"; title: string; text: string }> = ({ opacity, tone, title, text }) => {
  const palette = {
    win: { bg: `linear-gradient(135deg, ${COLORS.olive}15 0%, ${COLORS.olive}30 100%)`, border: COLORS.olive, color: COLORS.olive },
    loss: { bg: COLORS.card, border: COLORS.gold, color: "#8C7344" },
    warn: { bg: `linear-gradient(135deg, ${COLORS.gold}15 0%, ${COLORS.bg} 100%)`, border: COLORS.gold, color: "#8C7344" },
  }[tone];

  return (
    <div style={{
      opacity,
      transform: `translateY(${interpolate(opacity, [0, 1], [16, 0])}px) scale(${interpolate(opacity, [0, 1], [0.97, 1])})`,
      background: palette.bg,
      border: `1px solid ${palette.border}50`,
      borderLeft: `4px solid ${palette.border}`,
      borderRadius: 10,
      padding: "14px 16px",
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: palette.color }}>{title}</div>
      <div style={{ fontSize: 12, color: COLORS.text, marginTop: 6, lineHeight: 1.55 }}>{text}</div>
    </div>
  );
};

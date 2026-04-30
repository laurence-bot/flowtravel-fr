import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Sequence } from "remotion";
import { AppShot, FTCard, FTBadge } from "../components/AppShot";
import { COLORS, FONT_BODY, FONT_DISPLAY } from "../theme";
import type { Format } from "../MainVideo";

// Plan en 2 temps :
// Phase A (0-130) : éditeur d'itinéraire dans l'app FlowTravel
// Phase B (130-322) : rendu public client (carnet de voyage), scroll vertical
export const Scene4Itineraire: React.FC<{ format: Format }> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Transition : phase B prend le dessus à frame 130
  const transition = spring({ frame: frame - 125, fps, config: { damping: 22, stiffness: 100 } });
  const phaseAOpacity = interpolate(transition, [0, 0.6, 1], [1, 0.4, 0]);
  const phaseAScale = interpolate(transition, [0, 1], [1, 0.95]);
  const phaseBOpacity = interpolate(transition, [0, 1], [0, 1]);
  const phaseBScale = interpolate(transition, [0, 1], [1.04, 1]);

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, opacity: phaseAOpacity, transform: `scale(${phaseAScale})` }}>
        <PhaseEditor />
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: phaseBOpacity, transform: `scale(${phaseBScale})` }}>
        <PhasePublic />
      </div>
    </AbsoluteFill>
  );
};

// =====================================================
// PHASE A : Éditeur d'itinéraire dans FlowTravel
// =====================================================
const PhaseEditor: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AppShot route="/dossiers/japon-marchand/itineraire" active="Dossiers" moduleLabel="03 · ITINÉRAIRE">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, color: COLORS.text, fontWeight: 500 }}>
            Carnet de voyage — Japon
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>
            Mise en page jour par jour · auto-générée depuis la cotation
          </div>
        </div>
        <FTBadge variant="success">14 jours · 12 étapes</FTBadge>
      </div>

      {/* Mini timeline */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 24,
              borderRadius: 3,
              backgroundColor: i < 7 ? COLORS.gold : i < 10 ? COLORS.ocre : COLORS.olive,
              opacity: 0.7,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 9,
              color: "#FFF",
              fontWeight: 600,
            }}
          >
            J{i + 1}
          </div>
        ))}
      </div>

      {/* Liste des jours */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { j: "Jour 1-3", ville: "Tokyo", desc: "Asakusa, Shibuya, Tsukiji", img: "🏯", color: COLORS.gold },
          { j: "Jour 4-5", ville: "Hakone", desc: "Ryokan & onsen, mont Fuji", img: "♨️", color: COLORS.ocre },
          { j: "Jour 6-9", ville: "Kyoto", desc: "Temples, Gion, Arashiyama", img: "⛩️", color: COLORS.gold },
          { j: "Jour 10-11", ville: "Osaka", desc: "Dotonbori, château", img: "🏮", color: COLORS.ocre },
          { j: "Jour 12-14", ville: "Hiroshima & Miyajima", desc: "Mémorial, sanctuaire flottant", img: "⛩️", color: COLORS.olive },
          { j: "Jour 15", ville: "Retour Paris", desc: "Vol Air France direct", img: "✈️", color: COLORS.textMuted },
        ].map((step, i) => {
          const appear = interpolate(frame, [10 + i * 8, 30 + i * 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const tY = interpolate(appear, [0, 1], [12, 0]);
          return (
            <div
              key={step.j}
              style={{
                opacity: appear,
                transform: `translateY(${tY}px)`,
                backgroundColor: COLORS.card,
                border: `1px solid ${COLORS.border}`,
                borderLeft: `3px solid ${step.color}`,
                borderRadius: 8,
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 28 }}>{step.img}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>
                  {step.j}
                </div>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: COLORS.text, fontWeight: 500, marginTop: 2 }}>
                  {step.ville}
                </div>
                <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 1 }}>
                  {step.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Banner "rendu pour le client" qui apparaît à la fin */}
      <div
        style={{
          position: "absolute",
          bottom: 18,
          left: "50%",
          transform: `translate(-50%, ${interpolate(frame, [80, 120], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
          opacity: interpolate(frame, [80, 120], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          backgroundColor: COLORS.text,
          color: COLORS.bg,
          padding: "10px 20px",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 500,
          fontFamily: FONT_BODY,
          letterSpacing: "0.02em",
          boxShadow: "0 12px 32px rgba(26,24,21,0.25)",
        }}
      >
        👁  Aperçu côté client →
      </div>
    </AppShot>
  );
};

// =====================================================
// PHASE B : Rendu public — carnet de voyage que reçoit le client
// =====================================================
const PhasePublic: React.FC = () => {
  const frame = useCurrentFrame();
  // Le scroll commence après la transition (frame 130 dans la scène totale)
  // Ici frame est local à la scène. On scroll de frame 140 à 322
  const scrollY = interpolate(frame, [145, 322], [0, -1100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Cadre navigateur "lien public" */}
      <div
        style={{
          width: "70%",
          height: "90%",
          backgroundColor: "#FFFFFF",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(26,24,21,0.22), 0 0 0 1px rgba(0,0,0,0.04)",
          display: "flex",
          flexDirection: "column",
          fontFamily: FONT_BODY,
          position: "relative",
        }}
      >
        {/* Mini browser bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 16px",
            backgroundColor: "#EDE7D8",
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div style={{ width: 11, height: 11, borderRadius: "50%", backgroundColor: "#E8665E" }} />
          <div style={{ width: 11, height: 11, borderRadius: "50%", backgroundColor: "#E8B547" }} />
          <div style={{ width: 11, height: 11, borderRadius: "50%", backgroundColor: "#7AAB57" }} />
          <div
            style={{
              flex: 1,
              backgroundColor: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 6,
              padding: "5px 12px",
              fontSize: 12,
              color: COLORS.textSubtle,
              fontFamily: '"JetBrains Mono", monospace',
              maxWidth: 500,
              margin: "0 auto",
            }}
          >
            🔒 lavoyagerie.fr/voyage/japon-marchand
          </div>
          <div style={{ width: 60 }} />
        </div>

        {/* Page content scrollable */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative", backgroundColor: "#FAF6EC" }}>
          <div style={{ transform: `translateY(${scrollY}px)`, padding: "30px 50px" }}>
            <PublicCarnet />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const PublicCarnet: React.FC = () => {
  return (
    <div style={{ color: COLORS.text }}>
      {/* Hero */}
      <div style={{ textAlign: "center", padding: "20px 0 32px" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.32em", color: COLORS.gold, fontWeight: 600 }}>
          La Voyagerie · Carnet de voyage
        </div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 56, color: COLORS.text, marginTop: 12, lineHeight: 1.05, fontWeight: 500, letterSpacing: "-0.015em" }}>
          Japon
        </div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: COLORS.ocre, fontStyle: "italic", marginTop: 4 }}>
          Tokyo · Hakone · Kyoto · Hiroshima
        </div>
        <div style={{ marginTop: 18, fontSize: 13, color: COLORS.textMuted }}>
          Voyage sur mesure pour Sophie & Antoine Marchand
        </div>
        <div style={{ fontSize: 13, color: COLORS.textMuted }}>
          12 mai → 26 mai 2026 · 14 jours · 2 voyageurs
        </div>
        <div style={{ marginTop: 18, height: 1, width: 60, backgroundColor: COLORS.gold, margin: "18px auto 0" }} />
      </div>

      {/* Vol */}
      <div style={{ backgroundColor: "#FFF", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 18, marginBottom: 22 }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: COLORS.gold, fontWeight: 600, marginBottom: 10 }}>
          Vols · Air France
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 14, alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 500 }}>CDG</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>12 mai · 11h30</div>
            <div style={{ fontSize: 11, color: COLORS.textSubtle, marginTop: 2 }}>Paris Charles de Gaulle</div>
          </div>
          <div style={{ textAlign: "center", color: COLORS.textMuted }}>
            <div style={{ fontSize: 11 }}>AF272 · 11h45 vol</div>
            <div style={{ fontSize: 18, marginTop: 2 }}>✈</div>
            <div style={{ fontSize: 11, marginTop: 2 }}>direct</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 500 }}>HND</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>13 mai · 07h15</div>
            <div style={{ fontSize: 11, color: COLORS.textSubtle, marginTop: 2 }}>Tokyo Haneda</div>
          </div>
        </div>
      </div>

      {/* Jours */}
      {[
        { j: "Jour 1-3", ville: "Tokyo", text: "Arrivée à Haneda, transfert privé vers votre hôtel à Shibuya. Découverte d'Asakusa, du temple Senso-ji, et soirée dans les ruelles de Shimokitazawa. Marché aux poissons de Toyosu, vue depuis le Shibuya Sky.", img: "linear-gradient(135deg, #C9A96E 0%, #A14E2C 100%)" },
        { j: "Jour 4-5", ville: "Hakone", text: "Train Romance Car puis ryokan traditionnel face au mont Fuji. Bains chauds, dîner kaiseki en chambre, croisière sur le lac Ashi.", img: "linear-gradient(135deg, #6A6F4C 0%, #C9A96E 100%)" },
        { j: "Jour 6-9", ville: "Kyoto", text: "Shinkansen jusqu'à Kyoto. Quartier de Gion au crépuscule, marché Nishiki, temple Kinkaku-ji, forêt de bambous d'Arashiyama, cours de cuisine kaiseki avec votre chef.", img: "linear-gradient(135deg, #A14E2C 0%, #6A6F4C 100%)" },
        { j: "Jour 10-11", ville: "Osaka", text: "Dotonbori et son célèbre Glico, château d'Osaka, soirée izakaya avec votre guide francophone.", img: "linear-gradient(135deg, #C9A96E 0%, #6A6F4C 100%)" },
      ].map((day) => (
        <div key={day.j} style={{ marginBottom: 28 }}>
          <div
            style={{
              height: 180,
              borderRadius: 10,
              background: day.img,
              marginBottom: 14,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                bottom: 14,
                left: 18,
                color: "#FFF",
                fontFamily: FONT_DISPLAY,
                fontSize: 32,
                fontWeight: 500,
                letterSpacing: "-0.01em",
                textShadow: "0 2px 12px rgba(0,0,0,0.4)",
              }}
            >
              {day.ville}
            </div>
            <div
              style={{
                position: "absolute",
                top: 14,
                left: 18,
                color: "#FFF",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.28em",
                fontWeight: 600,
                opacity: 0.9,
              }}
            >
              {day.j}
            </div>
          </div>
          <div style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.6, padding: "0 4px" }}>
            {day.text}
          </div>
        </div>
      ))}
    </div>
  );
};

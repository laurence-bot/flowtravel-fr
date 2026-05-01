import { AbsoluteFill, useCurrentFrame, interpolate, Img, staticFile } from "remotion";
import { COLORS, FONT_BODY, FONT_DISPLAY } from "../theme";
import type { Format } from "../MainVideo";

// Scene 4 : Devis envoyé au client — effet waouh
// Aperçu navigateur du /p/$token avec hero Mont Fuji + scroll
export const Scene4Itineraire: React.FC<{ format: Format }> = () => {
  const frame = useCurrentFrame();

  // Apparition du device
  const enter = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const tY = interpolate(enter, [0, 1], [40, 0]);

  // Scroll vertical de la page (commence après l'entrée)
  const scrollY = interpolate(frame, [40, 200], [0, -1400], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      {/* Label flottant */}
      <div style={{
        position: "absolute",
        top: 40,
        left: "50%",
        transform: "translateX(-50%)",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.32em",
        color: COLORS.gold,
        fontWeight: 600,
        opacity: enter,
      }}>
        04 · Devis envoyé au client
      </div>

      {/* Browser frame */}
      <div style={{
        opacity: enter,
        transform: `translateY(${tY}px)`,
        width: "75%",
        height: "85%",
        backgroundColor: "#FFF",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 40px 100px rgba(26,24,21,0.28), 0 0 0 1px rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
        fontFamily: FONT_BODY,
      }}>
        {/* Browser bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 16px",
          backgroundColor: "#EDE7D8",
          borderBottom: `1px solid ${COLORS.border}`,
        }}>
          <div style={{ width: 11, height: 11, borderRadius: "50%", backgroundColor: "#E8665E" }} />
          <div style={{ width: 11, height: 11, borderRadius: "50%", backgroundColor: "#E8B547" }} />
          <div style={{ width: 11, height: 11, borderRadius: "50%", backgroundColor: "#7AAB57" }} />
          <div style={{
            flex: 1,
            backgroundColor: "#FBF8F0",
            border: `1px solid ${COLORS.border}`,
            borderRadius: 6,
            padding: "5px 12px",
            fontSize: 12,
            color: COLORS.textSubtle,
            fontFamily: '"JetBrains Mono", monospace',
            maxWidth: 540,
            margin: "0 auto",
            textAlign: "center",
          }}>
            🔒 lavoyagerie.fr/voyage/japon-marchand-2026
          </div>
          <div style={{ width: 60 }} />
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative", backgroundColor: "#FAF6EC" }}>
          <div style={{ transform: `translateY(${scrollY}px)`, willChange: "transform" }}>
            <PublicQuote />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const PublicQuote: React.FC = () => {
  const frame = useCurrentFrame();
  // Légère parallax sur le hero
  const heroParallax = interpolate(frame, [40, 200], [0, 200], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const heroScale = interpolate(frame, [0, 60], [1.08, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div>
      {/* HERO */}
      <div style={{ position: "relative", height: 580, overflow: "hidden" }}>
        <div style={{
          position: "absolute",
          inset: 0,
          transform: `translateY(${heroParallax * 0.4}px) scale(${heroScale})`,
        }}>
          <Img
            src={staticFile("images/fuji.jpg")}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
        {/* Overlay dégradé */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.65) 100%)",
        }} />
        {/* Texte hero */}
        <div style={{
          position: "absolute",
          bottom: 50,
          left: 60,
          right: 60,
          color: "#FFF",
        }}>
          <div style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.32em",
            color: "#E0C896",
            fontWeight: 600,
            marginBottom: 14,
          }}>
            La Voyagerie · Voyage sur-mesure
          </div>
          <div style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 88,
            fontWeight: 500,
            lineHeight: 1.0,
            letterSpacing: "-0.02em",
          }}>
            Japon
          </div>
          <div style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 28,
            fontStyle: "italic",
            color: "#E0C896",
            marginTop: 8,
          }}>
            Tokyo · Hakone · Kyoto · Hiroshima
          </div>
          <div style={{ marginTop: 18, fontSize: 14, opacity: 0.9 }}>
            Pour Sophie & Antoine Marchand · 12 → 26 mai 2026 · 14 jours
          </div>
        </div>
      </div>

      {/* CONTENU */}
      <div style={{ padding: "50px 70px" }}>
        {/* Bloc voyage */}
        <div style={{
          backgroundColor: "#FFF",
          borderRadius: 12,
          padding: 30,
          border: `1px solid ${COLORS.border}`,
          marginBottom: 40,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 20,
        }}>
          {[
            { label: "Durée", value: "14 jours", sub: "12 → 26 mai" },
            { label: "Voyageurs", value: "2 adultes", sub: "Sophie & Antoine" },
            { label: "Investissement", value: "8 680 €", sub: "tout compris" },
          ].map((b) => (
            <div key={b.label} style={{ borderLeft: `2px solid ${COLORS.gold}`, paddingLeft: 14 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em", color: COLORS.textMuted, fontWeight: 600 }}>
                {b.label}
              </div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, color: COLORS.text, marginTop: 4, fontWeight: 500 }}>
                {b.value}
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>{b.sub}</div>
            </div>
          ))}
        </div>

        {/* Section votre voyage */}
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.32em", color: COLORS.gold, fontWeight: 600 }}>
            Votre itinéraire
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 44, color: COLORS.text, marginTop: 10, fontWeight: 500 }}>
            Quatorze jours d'émerveillement
          </div>
        </div>

        {/* Cartes jours */}
        {[
          { j: "Jour 1 → 3", ville: "Tokyo", text: "Arrivée à Haneda, transfert privé vers le Park Hyatt. Découverte d'Asakusa, Shibuya Sky au crépuscule, marché de Toyosu à l'aube.", img: "tokyo.jpg" },
          { j: "Jour 4 → 5", ville: "Hakone", text: "Train Romance Car puis ryokan Gora Kadan face au Mont Fuji. Bains chauds privés, dîner kaiseki, croisière sur le lac Ashi.", img: "hakone.jpg" },
          { j: "Jour 6 → 9", ville: "Kyoto", text: "Shinkansen première classe. Gion au crépuscule avec votre guide francophone, Arashiyama, cours de cuisine kaiseki avec un chef étoilé.", img: "kyoto.jpg" },
        ].map((d, i) => (
          <div key={d.j} style={{
            display: "grid",
            gridTemplateColumns: i % 2 === 0 ? "1.2fr 1fr" : "1fr 1.2fr",
            gap: 30,
            marginBottom: 40,
            alignItems: "center",
          }}>
            <div style={{
              order: i % 2 === 0 ? 1 : 2,
              height: 320,
              borderRadius: 10,
              overflow: "hidden",
            }}>
              <Img src={staticFile(`images/${d.img}`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div style={{ order: i % 2 === 0 ? 2 : 1 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em", color: COLORS.gold, fontWeight: 600 }}>
                {d.j}
              </div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 48, color: COLORS.text, marginTop: 6, fontWeight: 500, lineHeight: 1.05 }}>
                {d.ville}
              </div>
              <div style={{ height: 1, width: 50, backgroundColor: COLORS.gold, margin: "16px 0" }} />
              <div style={{ fontSize: 15, color: COLORS.text, lineHeight: 1.7 }}>
                {d.text}
              </div>
            </div>
          </div>
        ))}

        {/* CTA */}
        <div style={{ textAlign: "center", padding: "40px 0 60px" }}>
          <div style={{
            display: "inline-block",
            backgroundColor: COLORS.ocre,
            color: "#FFF",
            padding: "16px 38px",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: "0.05em",
            boxShadow: `0 12px 32px ${COLORS.ocre}40`,
          }}>
            ✓  J'accepte ce voyage
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: COLORS.textMuted }}>
            Signature en ligne · acompte sécurisé · réponse 24h
          </div>
        </div>
      </div>
    </div>
  );
};

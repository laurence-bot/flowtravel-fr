import { AbsoluteFill, useCurrentFrame, interpolate, Img, staticFile, spring, useVideoConfig } from "remotion";
import { COLORS, FONT_BODY, FONT_DISPLAY } from "../theme";
import type { Format } from "../MainVideo";

// Scene 9 — Carnet de voyage : DEUX versions
// Gauche : livret papier imprimé · Droite : application mobile live
export const Scene9Carnet: React.FC<{ format: Format }> = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterLeft = spring({ frame: frame - 5, fps, config: { damping: 22, stiffness: 110 } });
  const enterRight = spring({ frame: frame - 25, fps, config: { damping: 22, stiffness: 110 } });

  return (
    <AbsoluteFill style={{ padding: "60px 40px" }}>
      {/* Module label */}
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
      }}>
        09 · Carnet de voyage — deux versions pour Sophie
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 40,
        height: "100%",
        paddingTop: 50,
        fontFamily: FONT_BODY,
      }}>
        {/* === GAUCHE : LIVRET IMPRIMÉ === */}
        <div style={{
          opacity: enterLeft,
          transform: `translateX(${interpolate(enterLeft, [0, 1], [-30, 0])}px)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          position: "relative",
        }}>
          <PrintedBook />
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.28em",
              color: COLORS.ocre,
              fontWeight: 700,
            }}>
              Version impression
            </div>
            <div style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 22,
              color: COLORS.text,
              marginTop: 4,
              fontWeight: 500,
            }}>
              Livret papier · livré avant le départ
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>
              PDF haute résolution · prêt à imprimer · souvenir
            </div>
          </div>
        </div>

        {/* === DROITE : APPLICATION MOBILE LIVE === */}
        <div style={{
          opacity: enterRight,
          transform: `translateX(${interpolate(enterRight, [0, 1], [30, 0])}px)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
        }}>
          <MobileApp />
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.28em",
              color: COLORS.olive,
              fontWeight: 700,
            }}>
              Version application live
            </div>
            <div style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 22,
              color: COLORS.text,
              marginTop: 4,
              fontWeight: 500,
            }}>
              Le client suit son voyage en direct
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>
              Géoloc · programme du jour · contact conseiller
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// =================== LIVRET IMPRIMÉ ===================
const PrintedBook: React.FC = () => {
  const frame = useCurrentFrame();
  // Animation : la couverture s'ouvre légèrement (rotateY)
  const openAngle = interpolate(frame, [40, 100], [0, -28], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Pages intérieures se révèlent quand le livre s'ouvre
  const innerOpacity = interpolate(frame, [70, 110], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Léger bobbing
  const bob = Math.sin(frame * 0.04) * 4;

  return (
    <div style={{
      perspective: 1400,
      width: 380,
      height: 520,
      position: "relative",
      transform: `translateY(${bob}px)`,
    }}>
      {/* Pages intérieures (en arrière) */}
      <div style={{
        position: "absolute",
        inset: "10px 8px 10px 10px",
        backgroundColor: "#FBF8F0",
        borderRadius: 4,
        boxShadow: "inset -4px 0 8px rgba(0,0,0,0.06)",
        opacity: innerOpacity,
        display: "flex",
        flexDirection: "column",
        padding: "30px 26px",
        transform: "rotateY(-2deg)",
        transformOrigin: "left center",
      }}>
        <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.25em", color: COLORS.gold, fontWeight: 600 }}>
          Jour 4 · Hakone
        </div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, color: COLORS.text, marginTop: 6, fontWeight: 500 }}>
          Ryokan Gora Kadan
        </div>
        <div style={{ height: 1, width: 30, backgroundColor: COLORS.gold, margin: "10px 0" }} />
        <div style={{ height: 140, marginTop: 6, borderRadius: 3, overflow: "hidden" }}>
          <Img src={staticFile("images/hakone.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div style={{ fontSize: 10, color: COLORS.text, lineHeight: 1.6, marginTop: 12 }}>
          Train Romance Car puis ryokan traditionnel face au Mont Fuji. Bains chauds privés, dîner kaiseki en chambre, croisière sur le lac Ashi au coucher du soleil.
        </div>
        <div style={{ marginTop: "auto", fontSize: 9, color: COLORS.textMuted, textAlign: "center", fontStyle: "italic" }}>
          — 12 —
        </div>
      </div>

      {/* COUVERTURE qui s'ouvre */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(135deg, #1A1815 0%, #2C2620 100%)`,
        borderRadius: 4,
        boxShadow: "0 30px 70px rgba(0,0,0,0.35), 0 10px 25px rgba(0,0,0,0.2)",
        transform: `rotateY(${openAngle}deg)`,
        transformOrigin: "left center",
        transformStyle: "preserve-3d",
        padding: "50px 36px",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Bordure dorée */}
        <div style={{
          position: "absolute",
          inset: 16,
          border: `1px solid ${COLORS.gold}60`,
          borderRadius: 2,
          pointerEvents: "none",
        }} />
        <div style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.4em",
          color: COLORS.gold,
          fontWeight: 600,
          textAlign: "center",
        }}>
          La Voyagerie
        </div>
        <div style={{
          marginTop: "auto",
          marginBottom: "auto",
          textAlign: "center",
        }}>
          <div style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 64,
            color: "#F5F1E8",
            fontWeight: 500,
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}>
            Japon
          </div>
          <div style={{ height: 1, width: 50, backgroundColor: COLORS.gold, margin: "20px auto" }} />
          <div style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 16,
            color: COLORS.goldSoft,
            fontStyle: "italic",
          }}>
            Carnet de voyage
          </div>
        </div>
        <div style={{
          textAlign: "center",
          fontSize: 10,
          color: COLORS.gold,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
        }}>
          Sophie & Antoine · Mai 2026
        </div>
      </div>
    </div>
  );
};

// =================== APPLICATION MOBILE LIVE ===================
const MobileApp: React.FC = () => {
  const frame = useCurrentFrame();
  // Notification push qui apparaît à frame 90
  const notifEnter = interpolate(frame, [90, 110], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const notifExit = interpolate(frame, [180, 210], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const notifOp = Math.min(notifEnter, notifExit);
  const notifY = interpolate(notifEnter, [0, 1], [-40, 0]);

  // Pulse du dot "live"
  const livePulse = (Math.sin(frame * 0.18) + 1) / 2;

  return (
    <div style={{
      width: 280,
      height: 560,
      backgroundColor: "#1A1815",
      borderRadius: 38,
      padding: 10,
      boxShadow: "0 30px 70px rgba(0,0,0,0.35), 0 0 0 2px #2A2620",
      position: "relative",
    }}>
      {/* Notch */}
      <div style={{
        position: "absolute",
        top: 14,
        left: "50%",
        transform: "translateX(-50%)",
        width: 100,
        height: 26,
        backgroundColor: "#000",
        borderRadius: 14,
        zIndex: 10,
      }} />

      {/* Screen */}
      <div style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#FAF6EC",
        borderRadius: 30,
        overflow: "hidden",
        position: "relative",
        fontFamily: FONT_BODY,
      }}>
        {/* Status bar */}
        <div style={{
          padding: "14px 22px 8px",
          fontSize: 10,
          color: COLORS.text,
          fontWeight: 600,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span>9:41</span>
          <span>•••</span>
        </div>

        {/* Header app */}
        <div style={{ padding: "20px 20px 14px" }}>
          <div style={{
            fontSize: 9,
            textTransform: "uppercase",
            letterSpacing: "0.22em",
            color: COLORS.gold,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}>
            <div style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: COLORS.olive,
              opacity: 0.6 + livePulse * 0.4,
              boxShadow: `0 0 ${4 + livePulse * 6}px ${COLORS.olive}`,
            }} />
            En direct · Hakone
          </div>
          <div style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 26,
            color: COLORS.text,
            fontWeight: 500,
            marginTop: 6,
            lineHeight: 1.1,
          }}>
            Bonjour Sophie
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
            Jour 4 sur 14 · 18°C ☁
          </div>
        </div>

        {/* Photo Hakone */}
        <div style={{ margin: "0 20px", height: 120, borderRadius: 10, overflow: "hidden", position: "relative" }}>
          <Img src={staticFile("images/hakone.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.6) 100%)",
          }} />
          <div style={{
            position: "absolute",
            bottom: 8,
            left: 10,
            right: 10,
            color: "#FFF",
            fontSize: 10,
          }}>
            <div style={{ fontWeight: 600 }}>📍 Lac Ashi · 2,1 km</div>
          </div>
        </div>

        {/* Prochain RDV */}
        <div style={{
          margin: "12px 20px",
          padding: 12,
          backgroundColor: "#FFF",
          borderRadius: 10,
          border: `1px solid ${COLORS.border}`,
          borderLeft: `3px solid ${COLORS.ocre}`,
        }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.18em", color: COLORS.ocre, fontWeight: 700 }}>
            Prochain · 14h00
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, color: COLORS.text, marginTop: 3, fontWeight: 500 }}>
            Croisière lac Ashi
          </div>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>
            Embarquement Moto-Hakone
          </div>
        </div>

        {/* Bouton conseiller */}
        <div style={{
          margin: "8px 20px",
          padding: "10px 12px",
          backgroundColor: COLORS.text,
          color: COLORS.bg,
          borderRadius: 8,
          fontSize: 11,
          fontWeight: 500,
          textAlign: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}>
          💬  Contacter Camille
        </div>

        {/* Programme du jour mini */}
        <div style={{ padding: "8px 20px" }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.2em", color: COLORS.textMuted, fontWeight: 600 }}>
            Programme du jour
          </div>
          {[
            { h: "09h", t: "Petit-déj. ryokan", done: true },
            { h: "11h", t: "Bains onsen privés", done: true },
            { h: "14h", t: "Croisière lac Ashi", done: false },
            { h: "18h", t: "Dîner kaiseki", done: false },
          ].map((s, i) => (
            <div key={i} style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 0",
              fontSize: 10,
              color: s.done ? COLORS.textMuted : COLORS.text,
              opacity: s.done ? 0.5 : 1,
            }}>
              <span style={{ color: s.done ? COLORS.olive : COLORS.gold, fontSize: 11 }}>
                {s.done ? "✓" : "○"}
              </span>
              <span style={{ fontWeight: 600, width: 24 }}>{s.h}</span>
              <span style={{ textDecoration: s.done ? "line-through" : "none" }}>{s.t}</span>
            </div>
          ))}
        </div>

        {/* NOTIFICATION PUSH qui apparaît */}
        <div style={{
          position: "absolute",
          top: 50,
          left: 14,
          right: 14,
          opacity: notifOp,
          transform: `translateY(${notifY}px)`,
          backgroundColor: "rgba(255,255,255,0.97)",
          borderRadius: 12,
          padding: "10px 14px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
          border: `1px solid ${COLORS.border}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: COLORS.textMuted }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: COLORS.ocre, color: "#FFF", fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>FT</div>
            <span style={{ fontWeight: 600, color: COLORS.text }}>FlowTravel</span>
            <span style={{ marginLeft: "auto" }}>maintenant</span>
          </div>
          <div style={{ fontSize: 11, color: COLORS.text, marginTop: 4, fontWeight: 500 }}>
            Votre transfert pour le ryokan arrive dans 15 min 🚗
          </div>
        </div>
      </div>
    </div>
  );
};

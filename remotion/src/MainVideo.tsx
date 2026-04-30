import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadCormorant } from "@remotion/google-fonts/CormorantGaramond";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { COLORS } from "./theme";
import { Background } from "./components/Background";
import { Caption } from "./components/Caption";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2Demande } from "./scenes/Scene2Demande";
import { Scene3Cotation } from "./scenes/Scene3Cotation";
import { Scene4Itineraire } from "./scenes/Scene4Itineraire";
import { Scene5Envoi } from "./scenes/Scene5Envoi";
import { Scene6Fournisseurs } from "./scenes/Scene6Fournisseurs";
import { Scene7FX } from "./scenes/Scene7FX";
import { Scene8Facturation } from "./scenes/Scene8Facturation";
import { Scene9Pilotage } from "./scenes/Scene9Pilotage";
import { Scene10Outro } from "./scenes/Scene10Outro";

loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });
loadCormorant("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] });

export type Format = "landscape" | "square";

// Durations in frames @30fps — calées sur la voix off mesurée
// s1=4.25s s2=4.96s s3=7.26s s4=10.6s s5=5.94s s6=6.97s s7=6.18s s8=4.91s s9=7.83s s10=4.35s
// + ~5f de respiration entre chaque
const D = {
  s1: 135,   // 4.5s
  s2: 158,   // 5.27s
  s3: 222,   // 7.4s
  s4: 322,   // 10.73s
  s5: 184,   // 6.13s
  s6: 215,   // 7.17s
  s7: 192,   // 6.4s
  s8: 152,   // 5.07s
  s9: 240,   // 8s
  s10: 145,  // 4.83s
};

export const TOTAL =
  D.s1 + D.s2 + D.s3 + D.s4 + D.s5 + D.s6 + D.s7 + D.s8 + D.s9 + D.s10;

// Captions par scène
const CAPTIONS: Record<string, string> = {
  s1: "Une agence de voyages, c'est 12 outils. FlowTravel, c'est un seul.",
  s2: "Une demande client → cotation en un clic.",
  s3: "Prix, marge, options : tout se calcule en temps réel.",
  s4: "Carnet de voyage mis en page automatiquement. Le wow factor client.",
  s5: "Lien partageable, email auto, signature en ligne.",
  s6: "Factures multi-devises, échéances, acomptes.",
  s7: "Optimiseur de couvertures FX : protégez vos marges.",
  s8: "Acomptes, soldes, relances : tout en automatique.",
  s9: "Trésorerie réelle, acomptes, performance par agent.",
  s10: "Le système d'exploitation des agences de voyages.",
};

export const MainVideo: React.FC<{ format: Format }> = ({ format }) => {
  let cursor = 0;
  const scenes = [
    { key: "s1", dur: D.s1, Comp: Scene1Hook },
    { key: "s2", dur: D.s2, Comp: Scene2Demande },
    { key: "s3", dur: D.s3, Comp: Scene3Cotation },
    { key: "s4", dur: D.s4, Comp: Scene4Itineraire },
    { key: "s5", dur: D.s5, Comp: Scene5Envoi },
    { key: "s6", dur: D.s6, Comp: Scene6Fournisseurs },
    { key: "s7", dur: D.s7, Comp: Scene7FX },
    { key: "s8", dur: D.s8, Comp: Scene8Facturation },
    { key: "s9", dur: D.s9, Comp: Scene9Pilotage },
    { key: "s10", dur: D.s10, Comp: Scene10Outro },
  ] as const;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, fontFamily: "Inter, sans-serif" }}>
      <Background />

      {scenes.map((s) => {
        const from = cursor;
        cursor += s.dur;
        const C = s.Comp;
        return (
          <Sequence key={s.key} from={from} durationInFrames={s.dur}>
            <C format={format} />
            {s.key !== "s1" && s.key !== "s10" && (
              <Caption text={CAPTIONS[s.key]} />
            )}
          </Sequence>
        );
      })}

      {/* Voix off */}
      <VoiceTrack />
    </AbsoluteFill>
  );
};

const VoiceTrack: React.FC = () => {
  let cursor = 0;
  const tracks = [
    { key: "s1", dur: D.s1 },
    { key: "s2", dur: D.s2 },
    { key: "s3", dur: D.s3 },
    { key: "s4", dur: D.s4 },
    { key: "s5", dur: D.s5 },
    { key: "s6", dur: D.s6 },
    { key: "s7", dur: D.s7 },
    { key: "s8", dur: D.s8 },
    { key: "s9", dur: D.s9 },
    { key: "s10", dur: D.s10 },
  ];
  return (
    <>
      {tracks.map((t) => {
        const from = cursor;
        cursor += t.dur;
        return (
          <Sequence key={t.key} from={from + 4}>
            <Audio src={staticFile(`audio-v2/${t.key}.aac`)} volume={1} />
          </Sequence>
        );
      })}
    </>
  );
};

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
import { Scene9Pilotage } from "./scenes/Scene9Pilotage";
import { Scene9AdminCoach } from "./scenes/Scene9AdminCoach";
import { Scene9Carnet } from "./scenes/Scene9Carnet";
import { Scene10Outro } from "./scenes/Scene10Outro";

loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });
loadCormorant("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] });

export type Format = "landscape" | "square";

// Durées v4 calées sur la voix off française mesurée :
// s1=6.3 s2=7.86 s3=11.97 s4=9.24 s5=10.46 s6=6.75 s7=12.53 s8=13.4 s9=13.02 s10=14.09
// + 6f de respiration entre scènes
const D = {
  s1: 195,   // hook
  s2: 242,   // demande
  s3: 365,   // cotation + alerte marge
  s4: 283,   // itinéraire wow
  s5: 320,   // envoi → bulletin → facture
  s6: 209,   // fournisseurs
  s7: 382,   // FX intelligent
  s8: 408,   // trésorerie réelle
  s9: 397,   // admin & coaching agent
  s10: 429,  // carnet 2 versions + outro
};

export const TOTAL =
  D.s1 + D.s2 + D.s3 + D.s4 + D.s5 + D.s6 + D.s7 + D.s8 + D.s9 + D.s10;

const CAPTIONS: Record<string, string> = {
  s1: "Une agence, c'est 12 outils. FlowTravel, c'est un seul.",
  s2: "Demande client → cotation en un clic.",
  s3: "Marges en temps réel · alerte si sous l'objectif agence.",
  s4: "Devis envoyé. Page éditoriale immersive.",
  s5: "Acceptation → bulletin signé → facture émise. Auto.",
  s6: "Fournisseurs multi-devises automatisés.",
  s7: "FX intelligent : l'IA optimise pour la marge cible.",
  s8: "Trésorerie réelle vs acomptes — la vérité comptable.",
  s9: "Manager & coacher l'équipe — bienveillance intégrée.",
  s10: "Livret imprimé + app live. Le système d'exploitation des agences.",
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
    { key: "s8", dur: D.s8, Comp: Scene9Pilotage },
    { key: "s9", dur: D.s9, Comp: Scene9AdminCoach },
    { key: "s10", dur: D.s10, Comp: Scene9Carnet },
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
            {s.key !== "s1" && (
              <Caption text={CAPTIONS[s.key]} />
            )}
          </Sequence>
        );
      })}

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
            <Audio src={staticFile(`audio-v4/${t.key}.aac`)} volume={1} />
          </Sequence>
        );
      })}
    </>
  );
};

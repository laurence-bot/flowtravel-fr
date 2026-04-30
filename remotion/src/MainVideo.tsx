import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadDM } from "@remotion/google-fonts/DMSans";
import { COLORS } from "./theme";
import { Background } from "./components/Background";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2Problem } from "./scenes/Scene2Problem";
import { Scene3Solution } from "./scenes/Scene3Solution";
import { Scene4Benefits } from "./scenes/Scene4Benefits";
import { Scene5CTA } from "./scenes/Scene5CTA";

loadInter("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
loadDM("normal", { weights: ["500", "700", "900"], subsets: ["latin"] });

// Scene durations (frames @30fps)
const D = {
  s1: 98,
  s2: 132,
  s3: 250,
  s4: 164,
  s5: 116,
};

const PAD = 4; // tiny gap between voiceover triggers

export type Format = "landscape" | "square";

export const MainVideo: React.FC<{ format: Format }> = ({ format }) => {
  const { fps } = useVideoConfig();

  let cursor = 0;
  const s1From = cursor; cursor += D.s1;
  const s2From = cursor; cursor += D.s2;
  const s3From = cursor; cursor += D.s3;
  const s4From = cursor; cursor += D.s4;
  const s5From = cursor; cursor += D.s5;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, fontFamily: "Inter, sans-serif" }}>
      <Background />

      <Sequence from={s1From} durationInFrames={D.s1}><Scene1Hook format={format} /></Sequence>
      <Sequence from={s2From} durationInFrames={D.s2}><Scene2Problem format={format} /></Sequence>
      <Sequence from={s3From} durationInFrames={D.s3}><Scene3Solution format={format} /></Sequence>
      <Sequence from={s4From} durationInFrames={D.s4}><Scene4Benefits format={format} /></Sequence>
      <Sequence from={s5From} durationInFrames={D.s5}><Scene5CTA format={format} /></Sequence>

      {/* Voiceover - aligned with scene starts */}
      <Sequence from={s1From + PAD}><Audio src={staticFile("audio/s1.aac")} volume={1} /></Sequence>
      <Sequence from={s2From + PAD}><Audio src={staticFile("audio/s2.aac")} volume={1} /></Sequence>
      <Sequence from={s3From + PAD}><Audio src={staticFile("audio/s3.aac")} volume={1} /></Sequence>
      <Sequence from={s4From + PAD}><Audio src={staticFile("audio/s4.aac")} volume={1} /></Sequence>
      <Sequence from={s5From + PAD}><Audio src={staticFile("audio/s5.aac")} volume={1} /></Sequence>
    </AbsoluteFill>
  );
};

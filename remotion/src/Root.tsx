import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";

const FPS = 30;
const DURATION = 760; // ~25.3s

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="main-landscape"
        component={MainVideo}
        durationInFrames={DURATION}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ format: "landscape" as const }}
      />
      <Composition
        id="main-square"
        component={MainVideo}
        durationInFrames={DURATION}
        fps={FPS}
        width={1080}
        height={1080}
        defaultProps={{ format: "square" as const }}
      />
    </>
  );
};

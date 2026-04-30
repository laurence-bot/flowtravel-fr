import { Composition } from "remotion";
import { MainVideo, TOTAL } from "./MainVideo";

const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="main-landscape"
        component={MainVideo}
        durationInFrames={TOTAL}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ format: "landscape" as const }}
      />
      <Composition
        id="main-square"
        component={MainVideo}
        durationInFrames={TOTAL}
        fps={FPS}
        width={1080}
        height={1080}
        defaultProps={{ format: "square" as const }}
      />
    </>
  );
};

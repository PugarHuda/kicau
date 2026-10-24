import React from "react";
import { Composition, registerRoot, staticFile, type CalculateMetadataFunction } from "remotion";
import { KicauDemo, KicauTeaser, type Props } from "./Kicau";
import { FPS, H, SCENES, TEASER_SEC, W, demoFrames } from "./scenes";

// Finds which recordings exist (works in Studio and render: both serve public/). Missing -> pixel placeholder.
const detect: CalculateMetadataFunction<Props> = async ({ props }) => {
  const found = await Promise.all(
    SCENES.map(async (s) => {
      const r = await fetch(staticFile(`recordings/${s.id}.mp4`), { method: "HEAD" }).catch(() => null);
      return r?.ok && !(r.headers.get("content-type") ?? "").includes("text/html") ? s.id : null;
    }),
  );
  return { props: { ...props, recordings: found.filter((x): x is string => !!x) } };
};

const Root: React.FC = () => (
  <>
    <Composition id="KicauDemo" component={KicauDemo} durationInFrames={demoFrames()} fps={FPS} width={W} height={H} defaultProps={{ recordings: [] }} calculateMetadata={detect} />
    <Composition id="KicauTeaser" component={KicauTeaser} durationInFrames={TEASER_SEC * FPS} fps={FPS} width={W} height={H} defaultProps={{ recordings: [] }} calculateMetadata={detect} />
  </>
);
registerRoot(Root);

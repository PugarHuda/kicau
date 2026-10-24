import React from "react";
import {
  AbsoluteFill, Html5Audio, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig,
} from "remotion";
import { loadFont as loadDisplay } from "@remotion/google-fonts/PressStart2P";
import { loadFont as loadSans } from "@remotion/google-fonts/PixelifySans";
import { birdDataUri } from "./birds";
import {
  FPS, INTRO_SEC, LINKS, OUTRO_SEC, SCENES, TEASER_CLIPS, W, sceneFrames, type Callout, type Scene, type SfxName,
} from "./scenes";

const { fontFamily: DISPLAY } = loadDisplay("normal", { weights: ["400"], subsets: ["latin"] });
const { fontFamily: SANS } = loadSans("normal", { weights: ["400", "700"], subsets: ["latin"] });

// palette from web/src/app/globals.css
const C = { cream: "#f6f1e4", paper: "#fffdf7", ink: "#1e2a1f", muted: "#4f5d50", leaf: "#2f6b3a", sun: "#e8a33d", clay: "#b5532a", check: "#efe7d3" };
export const MUSIC_VOL = 0.15; // ducked under the live presenter
export type Props = { recordings: string[] };

const checker: React.CSSProperties = {
  backgroundColor: C.cream,
  backgroundImage: `conic-gradient(${C.check} 25%, transparent 0 50%, ${C.check} 0 75%, transparent 0)`,
  backgroundSize: "32px 32px",
};
const scan: React.CSSProperties = { backgroundImage: "repeating-linear-gradient(0deg, rgb(0 0 0 / 0.06) 0 2px, transparent 2px 4px)" };
const box = (bg: string, shadow = 8): React.CSSProperties => ({ background: bg, border: `6px solid ${C.ink}`, boxShadow: `${shadow}px ${shadow}px 0 ${C.ink}` });
const display = (size: number, color = C.ink): React.CSSProperties => ({ fontFamily: DISPLAY, fontSize: size, lineHeight: 1.35, color });
const sans = (size: number, color = C.ink): React.CSSProperties => ({ fontFamily: SANS, fontSize: size, lineHeight: 1.25, color });

export const Sfx: React.FC<{ at: number; name: SfxName; volume?: number }> = ({ at, name, volume = 0.6 }) => (
  <Sequence from={at} durationInFrames={FPS} layout="none">
    <Html5Audio src={staticFile(`audio/${name}.wav`)} volume={volume} />
  </Sequence>
);

/** Flapping, bobbing pixel bird. Wing toggles every 6 frames, like the game. */
const Bird: React.FC<{ species: number; size: number; x: number; y: number; delay?: number; flip?: boolean }> = ({ species, size, x, y, delay = 0, flip }) => {
  const f = useCurrentFrame() + delay;
  return (
    <Img
      src={birdDataUri(species, Math.floor(f / 6) % 2 === 0)}
      style={{ position: "absolute", left: x, top: y + Math.sin(f / 8) * 10, width: size, height: (size * 36) / 48, imageRendering: "pixelated", transform: flip ? "scaleX(-1)" : undefined }}
    />
  );
};

const pop = (frame: number, fps: number, delay = 0) => spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 160 } });

// ---------------- Intro ----------------
export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = pop(frame, fps);
  return (
    <AbsoluteFill style={{ ...checker, alignItems: "center", justifyContent: "center" }}>
      {[0, 1, 2, 3, 4].map((sp) => (
        <Bird key={sp} species={sp} size={170} x={interpolate(frame, [0, INTRO_SEC * FPS], [-260 - sp * 330, W + 200 - sp * 330])} y={110 + (sp % 2) * 70} delay={sp * 5} />
      ))}
      <div style={{ ...box(C.paper, 12), ...scan, padding: "56px 80px", textAlign: "center", transform: `scale(${k})` }}>
        <div style={display(140, C.leaf)}>KICAU</div>
        <div style={{ ...display(40), marginTop: 24 }}>Keep the song, not the cage.</div>
      </div>
      <div style={{ ...sans(40, C.ink), position: "absolute", bottom: 150, opacity: interpolate(frame, [20, 35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        The on-chain record for real-life songbird contests · built on <b style={{ color: C.leaf }}>Monad</b>
      </div>
      <Sfx at={2} name="chirp" />
    </AbsoluteFill>
  );
};

// ---------------- Scene ----------------
const FRAME = { x: 160, y: 36, w: 1600, h: 900 }; // recording window; caption bar sits below it
const SCALE = FRAME.w / W;

const Placeholder: React.FC<{ title: string; id: string }> = ({ title, id }) => (
  <AbsoluteFill style={{ ...checker, alignItems: "center", justifyContent: "center", gap: 28 }}>
    <Bird species={2} size={200} x={700} y={160} />
    <div style={{ ...display(48), marginTop: 220, textAlign: "center", maxWidth: 1300 }}>{title}</div>
    <div style={sans(32, C.muted)}>recording pending · public/recordings/{id}.mp4</div>
  </AbsoluteFill>
);

const CalloutBox: React.FC<{ c: Callout }> = ({ c }) => {
  const frame = useCurrentFrame();
  if (frame < c.from || frame > c.to) return null;
  const t = frame - c.from;
  const grow = interpolate(t, [0, 6], [1.15, 1], { extrapolateRight: "clamp" });
  const blink = Math.floor(t / 10) % 2 === 0 ? C.sun : C.clay;
  return (
    <div style={{ position: "absolute", left: c.x * SCALE, top: c.y * SCALE, width: c.w * SCALE, height: c.h * SCALE, border: `6px dashed ${blink}`, boxShadow: `0 0 0 4px ${C.ink}`, transform: `scale(${grow})` }}>
      {c.label && <div style={{ ...display(20, C.ink), position: "absolute", top: -50, left: -6, background: C.sun, border: `4px solid ${C.ink}`, padding: "6px 12px", whiteSpace: "nowrap" }}>{c.label}</div>}
    </div>
  );
};

const CaptionBar: React.FC<{ n: number; sc: Scene }> = ({ n, sc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const x = interpolate(pop(frame, fps, 4), [0, 1], [-1800, 0]);
  return (
    <div style={{ position: "absolute", left: FRAME.x, top: FRAME.y + FRAME.h + 18, width: FRAME.w, height: 110, display: "flex", transform: `translateX(${x}px)`, ...box(C.paper, 8) }}>
      <div style={{ ...display(40, C.ink), background: C.sun, borderRight: `6px solid ${C.ink}`, width: 140, display: "flex", alignItems: "center", justifyContent: "center" }}>{String(n).padStart(2, "0")}</div>
      <div style={{ padding: "12px 28px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
        <div style={display(30)}>{sc.caption}</div>
        <div style={display(19, C.leaf)}>◆ {sc.monadDetail}</div>
      </div>
    </div>
  );
};

export const SceneView: React.FC<{ sc: Scene; n: number; has: boolean }> = ({ sc, n, has }) => {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={checker}>
      <div style={{ position: "absolute", left: FRAME.x, top: FRAME.y, width: FRAME.w, height: FRAME.h, overflow: "hidden", opacity: fade, ...box(C.paper, 10) }}>
        {has ? <OffthreadVideo src={staticFile(`recordings/${sc.id}.mp4`)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Placeholder title={sc.title} id={sc.id} />}
        {has && sc.callouts.map((c, i) => <CalloutBox key={i} c={c} />)}
      </div>
      <CaptionBar n={n} sc={sc} />
      <Sfx at={0} name="whoosh" volume={0.35} />
      {sc.sfx.map((e, i) => <Sfx key={i} at={e.frame} name={e.name} />)}
    </AbsoluteFill>
  );
};

// ---------------- Outro ----------------
const Line: React.FC<{ k: string; v: string; d: number; mono?: boolean }> = ({ k, v, d, mono }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", gap: 28, alignItems: "baseline", opacity: interpolate(frame, [d, d + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
      <div style={{ ...display(22, C.leaf), width: 230 }}>{k}</div>
      <div style={mono ? display(24) : sans(38)}>{v}</div>
    </div>
  );
};

export const Outro: React.FC = () => (
  <AbsoluteFill style={{ ...checker, alignItems: "center", justifyContent: "center" }}>
    <Bird species={4} size={180} x={1600} y={90} flip />
    <Bird species={0} size={130} x={140} y={860} />
    <div style={{ ...box(C.paper, 12), ...scan, padding: "48px 64px", display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ ...display(54, C.leaf), marginBottom: 12 }}>KICAU · try it live</div>
      <Line k="LIVE" v={LINKS.live} d={4} />
      <Line k="REPO" v={LINKS.repo} d={10} />
      <Line k="TESTNET" v={LINKS.testnet} d={16} mono />
      <Line k="MAINNET" v={LINKS.mainnet} d={22} mono />
      <div style={{ ...display(24), marginTop: 22 }}>Built at Monad Blitz Jogja 2026</div>
      <div style={sans(34, C.clay)}>@monad @monad_dev @geeky_kartikey @devweb3jogja</div>
    </div>
    <Sfx at={4} name="coin" volume={0.4} />
  </AbsoluteFill>
);

// ---------------- Compositions ----------------
const Music: React.FC<{ file: string; volume: number }> = ({ file, volume }) => {
  const { durationInFrames } = useVideoConfig();
  return (
    <Html5Audio
      src={staticFile(`audio/${file}.wav`)}
      loop
      volume={(f) => volume * interpolate(f, [0, 15, durationInFrames - 45, durationInFrames], [0, 1, 1, 0], { extrapolateRight: "clamp" })}
    />
  );
};

export const KicauDemo: React.FC<Props> = ({ recordings }) => {
  let at = INTRO_SEC * FPS;
  return (
    <AbsoluteFill>
      <Music file="music-garden" volume={MUSIC_VOL} />
      <Sequence durationInFrames={INTRO_SEC * FPS}><Intro /></Sequence>
      {SCENES.map((sc, i) => {
        const from = at;
        at += sceneFrames(sc);
        return (
          <Sequence key={sc.id} from={from} durationInFrames={sceneFrames(sc)}>
            <SceneView sc={sc} n={i + 1} has={recordings.includes(sc.id)} />
          </Sequence>
        );
      })}
      <Sequence from={at} durationInFrames={OUTRO_SEC * FPS}><Outro /></Sequence>
    </AbsoluteFill>
  );
};

// Teaser: punchy kinetic type + 4 quick UI clips, ends on the live URL. No presenter, so music is louder.
const Punch: React.FC<{ lines: string[]; bg: string; fg: string; species?: number }> = ({ lines, bg, fg, species }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: bg, ...scan, alignItems: "center", justifyContent: "center", gap: 30 }}>
      {species !== undefined && <Bird species={species} size={260} x={interpolate(frame, [0, 90], [-300, W])} y={120} />}
      {lines.map((l, i) => (
        <div key={i} style={{ ...display(i === 0 ? Math.min(84, Math.floor(1700 / l.length)) : 44, fg), transform: `scale(${pop(frame, fps, i * 6)})`, textAlign: "center" }}>{l}</div>
      ))}
    </AbsoluteFill>
  );
};

const TeaserClip: React.FC<{ id: string; text: string; sub: string; has: boolean }> = ({ id, text, sub, has }) => {
  const frame = useCurrentFrame();
  const z = interpolate(frame, [0, 120], [1.08, 1]);
  return (
    <AbsoluteFill style={checker}>
      <div style={{ position: "absolute", inset: 60, overflow: "hidden", ...box(C.paper, 12), transform: `scale(${z}) rotate(-1deg)` }}>
        {has ? <OffthreadVideo src={staticFile(`recordings/${id}.mp4`)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Placeholder title={text} id={id} />}
      </div>
      <div style={{ position: "absolute", left: 100, bottom: 110, ...box(C.sun, 10), padding: "20px 34px" }}>
        <div style={display(56)}>{text}</div>
        <div style={sans(38)}>{sub}</div>
      </div>
      <Sfx at={0} name="whoosh" volume={0.5} />
      <Sfx at={8} name="tx-confirm" volume={0.5} />
    </AbsoluteFill>
  );
};

export const KicauTeaser: React.FC<Props> = ({ recordings }) => {
  const T = (s: number) => Math.round(s * FPS);
  const parts: [number, React.ReactNode][] = [
    [3, <Punch key="a" lines={["KICAU", "Keep the song, not the cage."]} bg={C.leaf} fg={C.paper} species={2} />],
    [4, <Punch key="b" lines={["Songbird contests", "judged on paper.", "Disputed. Poached."]} bg={C.ink} fg={C.sun} />],
    [3, <Punch key="c" lines={["Now on Monad."]} bg={C.sun} fg={C.ink} species={4} />],
    ...TEASER_CLIPS.map((c) => [5, <TeaserClip key={c.id} {...c} has={recordings.includes(c.id)} />] as [number, React.ReactNode]),
    [3, <Punch key="d" lines={["~0.6 s", "live scoreboard"]} bg={C.paper} fg={C.leaf} />],
    [3, <Punch key="e" lines={["30%", "to conservation"]} bg={C.leaf} fg={C.paper} species={3} />],
    [4, <Punch key="f" lines={["PLAY · PROTECT · PROVE", LINKS.live.replace("https://", "")]} bg={C.cream} fg={C.ink} species={0} />],
  ];
  let at = 0;
  return (
    <AbsoluteFill>
      <Music file="music-flappy" volume={0.55} />
      {parts.map(([sec, node], i) => {
        const from = at;
        at += T(sec);
        return (
          <Sequence key={i} from={from} durationInFrames={T(sec)}>
            {node}
            <Sfx at={0} name={i % 2 ? "score-tick" : "ui-click"} volume={0.5} />
          </Sequence>
        );
      })}
      <Sequence from={T(36)} durationInFrames={T(1)}><Sfx at={0} name="chirp" /></Sequence>
    </AbsoluteFill>
  );
};

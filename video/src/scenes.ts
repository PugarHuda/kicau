// Data for the demo video. The recording step only drops MP4s into public/recordings/<id>.mp4
// and tweaks durationSec / callouts / sfx here. Click scripts per scene: STORYBOARD.md + scripts/record.mjs.

export const FPS = 30;
export const W = 1920;
export const H = 1080;
export const INTRO_SEC = 4;
export const OUTRO_SEC = 6;

export type SfxName = "ui-click" | "tx-confirm" | "coin" | "score-tick" | "whoosh" | "chirp";
/** Box in RECORDING pixels (1920x1080), frames relative to the scene start. */
export type Callout = { x: number; y: number; w: number; h: number; from: number; to: number; label?: string };
export type Scene = {
  id: string;
  title: string; // placeholder card title
  caption: string; // headline, <= 60 chars, readable at a glance
  monadDetail: string; // one line under the headline
  durationSec: number;
  callouts: Callout[];
  sfx: { frame: number; name: SfxName }[];
};

const s = (sec: number) => Math.round(sec * FPS);

// Callouts/SFX tuned against the 24 Oct recordings (fresh contest #2 on 0x9479…0F58). Clips are pre-cut/sped in
// public/recordings so each starts at frame 0 of its scene.
export const SCENES: Scene[] = [
  {
    id: "contest-live",
    title: "Live judging at the gantangan",
    caption: "Judges score live. The crowd sees it instantly",
    monadDetail: "1 tx per score · board updates from the Proposed block (monadLogs)",
    durationSec: 19,
    callouts: [{ x: 220, y: 410, w: 1450, h: 660, from: s(1.5), to: s(18), label: "LIVE SCOREBOARD" }],
    sfx: [{ frame: s(4.5), name: "score-tick" }, { frame: s(10.5), name: "score-tick" }, { frame: s(16.5), name: "score-tick" }],
  },
  {
    id: "contest-podium",
    title: "Instant prizes, on-chain podium",
    caption: "Finalize: prizes paid to keepers instantly",
    monadDetail: "50/25/15% to the top 3 + 10% conservation, in the same tx",
    durationSec: 10,
    callouts: [{ x: 216, y: 320, w: 1490, h: 560, from: s(4), to: s(9.5), label: "PAID IN THE FINALIZE TX" }],
    sfx: [{ frame: s(2), name: "coin" }, { frame: s(7), name: "chirp" }],
  },
  {
    id: "register",
    title: "Register your real bird",
    caption: "Register your real bird",
    monadDetail: "Photo → AI species ID → pixel character → ERC-721 on Monad",
    durationSec: 15,
    callouts: [{ x: 734, y: 444, w: 456, h: 346, from: s(4.5), to: s(9), label: "AI SPECIES ID" }],
    sfx: [{ frame: s(1), name: "ui-click" }, { frame: s(13.5), name: "tx-confirm" }],
  },
  {
    id: "kicau-value",
    title: "Kicau Value + proof timeline",
    caption: "Kicau Value: earned, not hyped",
    monadDetail: "Rebuilt from on-chain events, checked against the contract",
    durationSec: 12,
    callouts: [{ x: 740, y: 362, w: 448, h: 380, from: s(6.5), to: s(11.5), label: "MATCHES CONTRACT" }],
    sfx: [{ frame: s(0.5), name: "ui-click" }],
  },
  {
    id: "sponsor-adopt",
    title: "Support a species · adopt an NFT",
    caption: "Support & adopt. Confirmed in ~1 s",
    monadDetail: "Support: 100% to conservation · adoption: 30% to conservation",
    durationSec: 14,
    callouts: [],
    sfx: [{ frame: s(1), name: "ui-click" }, { frame: s(5.3), name: "tx-confirm" }, { frame: s(9.3), name: "tx-confirm" }],
  },
  {
    id: "flappy",
    title: "Verified Flappy runs",
    caption: "Verified runs. Weekly prize pool",
    monadDetail: "startRun seeds the level on-chain · contract rejects impossible scores",
    durationSec: 14.5,
    callouts: [{ x: 1060, y: 40, w: 460, h: 420, from: s(9), to: s(14.3), label: "DAILY / WEEKLY / ALL-TIME" }],
    sfx: [{ frame: s(1.2), name: "chirp" }, { frame: s(6.5), name: "tx-confirm" }, { frame: s(9), name: "coin" }],
  },
  {
    id: "garden",
    title: "Kicau Garden",
    caption: "Kicau Garden: an open world of real birds",
    monadDetail: "Every bird NFT lives here · adopt or support from its card",
    durationSec: 8,
    callouts: [],
    sfx: [{ frame: s(0.5), name: "chirp" }],
  },
  {
    id: "proof",
    title: "Shareable result page",
    caption: "Every result is a public link",
    monadDetail: "Server-rendered from the chain + live OG preview · no database",
    durationSec: 6,
    callouts: [],
    sfx: [{ frame: s(0.5), name: "ui-click" }],
  },
];

export const sceneFrames = (sc: Scene) => s(sc.durationSec);
export const demoFrames = () => s(INTRO_SEC) + SCENES.reduce((a, sc) => a + sceneFrames(sc), 0) + s(OUTRO_SEC);

// Teaser: 4 quick UI clips reuse the demo recordings (same ids).
export const TEASER_CLIPS = [
  { id: "contest-live", text: "SCORED LIVE", sub: "every score on Monad" },
  { id: "register", text: "YOUR REAL BIRD", sub: "AI species ID → pixel NFT" },
  { id: "flappy", text: "VERIFIED RUNS", sub: "weekly prize pool" },
  { id: "garden", text: "KICAU GARDEN", sub: "an open world of birds" },
];
export const TEASER_SEC = 40;

export const LINKS = {
  live: "https://kicau.xyz",
  repo: "https://github.com/PugarHuda/kicau",
  testnet: "0x947929841Ba8154BB6E9BDeb35137d159c6A0F58",
  mainnet: "0xdada618e564edaf7ec0af0a12575bf3c0dc8523b",
};

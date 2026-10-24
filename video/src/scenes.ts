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

// ponytail: callout boxes are first guesses against the live layout; nudge after the real recording.
export const SCENES: Scene[] = [
  {
    id: "contest-live",
    title: "Live judging at the gantangan",
    caption: "Judges score live. Scoreboard in ~0.6 s",
    monadDetail: "1 tx per score · monadLogs Proposed-state stream",
    durationSec: 18,
    callouts: [
      { x: 1180, y: 250, w: 640, h: 520, from: s(4), to: s(12), label: "LIVE SCOREBOARD" },
      { x: 1180, y: 200, w: 420, h: 60, from: s(12), to: s(17), label: "~0.6 s" },
    ],
    sfx: [{ frame: s(3), name: "score-tick" }, { frame: s(5), name: "tx-confirm" }, { frame: s(9), name: "score-tick" }, { frame: s(11), name: "tx-confirm" }],
  },
  {
    id: "contest-podium",
    title: "Instant prizes, attested champion",
    caption: "Prizes paid instantly. Champion on-chain",
    monadDetail: "finalize: 50/25/15% to keepers + 10% conservation, 1 tx",
    durationSec: 12,
    callouts: [{ x: 360, y: 260, w: 1200, h: 420, from: s(2), to: s(8), label: "PAID IN THE SAME TX" }],
    sfx: [{ frame: s(1.5), name: "coin" }, { frame: s(7), name: "chirp" }],
  },
  {
    id: "register",
    title: "Register your real bird",
    caption: "Register your real bird",
    monadDetail: "AI species ID → pixel sprite → registerBird ERC-721",
    durationSec: 15,
    callouts: [{ x: 620, y: 300, w: 680, h: 360, from: s(5), to: s(10), label: "AI SPECIES ID" }],
    sfx: [{ frame: s(2), name: "ui-click" }, { frame: s(12), name: "tx-confirm" }],
  },
  {
    id: "kicau-value",
    title: "Kicau Value + proof timeline",
    caption: "Kicau Value: earned, not hyped",
    monadDetail: "valueOf rises with wins, decays without updates",
    durationSec: 12,
    callouts: [{ x: 560, y: 320, w: 800, h: 360, from: s(2), to: s(9), label: "MATCHES CONTRACT" }],
    sfx: [{ frame: s(1), name: "ui-click" }],
  },
  {
    id: "sponsor-adopt",
    title: "Sponsor a bird · adopt a species",
    caption: "Sponsor & adopt. Confirmed in < 1 s",
    monadDetail: "eth_sendRawTransactionSync · 70/30 split in the same tx",
    durationSec: 12,
    callouts: [{ x: 1300, y: 140, w: 560, h: 120, from: s(4), to: s(11), label: "LIVE KICAU" }],
    sfx: [{ frame: s(2), name: "ui-click" }, { frame: s(3), name: "tx-confirm" }, { frame: s(8), name: "tx-confirm" }],
  },
  {
    id: "flappy",
    title: "Verified Flappy runs",
    caption: "Verified runs. Weekly prize pool",
    monadDetail: "prevrandao seed · contract rejects impossible scores",
    durationSec: 15,
    callouts: [{ x: 1240, y: 260, w: 600, h: 520, from: s(10), to: s(15), label: "DAILY / WEEKLY" }],
    sfx: [{ frame: s(1), name: "chirp" }, { frame: s(9), name: "tx-confirm" }, { frame: s(12), name: "coin" }],
  },
  {
    id: "garden",
    title: "Kicau Garden",
    caption: "Kicau Garden: walk your bird NFT",
    monadDetail: "Open world · adopt or support straight from the card",
    durationSec: 8,
    callouts: [],
    sfx: [{ frame: s(0.5), name: "chirp" }],
  },
  {
    id: "proof",
    title: "x402 certificate · verified contracts",
    caption: "x402 certificate. Verified on mainnet",
    monadDetail: "$0.01 USDC via Monad x402 · testnet + mainnet verified",
    durationSec: 8,
    callouts: [],
    sfx: [{ frame: s(1), name: "ui-click" }, { frame: s(3), name: "coin" }],
  },
];

export const sceneFrames = (sc: Scene) => s(sc.durationSec);
export const demoFrames = () => s(INTRO_SEC) + SCENES.reduce((a, sc) => a + sceneFrames(sc), 0) + s(OUTRO_SEC);

// Teaser: 4 quick UI clips reuse the demo recordings (same ids).
export const TEASER_CLIPS = [
  { id: "contest-live", text: "SCORED LIVE", sub: "~0.6 s on Monad" },
  { id: "register", text: "YOUR REAL BIRD", sub: "AI species ID → pixel NFT" },
  { id: "flappy", text: "VERIFIED RUNS", sub: "weekly prize pool" },
  { id: "garden", text: "KICAU GARDEN", sub: "walk your bird" },
];
export const TEASER_SEC = 40;

export const LINKS = {
  live: "https://kicau-theta.vercel.app",
  repo: "https://github.com/PugarHuda/kicau",
  testnet: "0xD15bF5b95dC29083eBA236057e2DC9dE90092725",
  mainnet: "0xdada618e564edaf7ec0af0a12575bf3c0dc8523b",
};

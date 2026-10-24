// Synthesizes all video audio as 16-bit mono PCM WAV. No deps, no licensed assets.
// Music reuses the slendro scale + patterns from web/src/lib/music.ts (copied: web/ is a Next client module).
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SR = 44100;
const OUT = fileURLToPath(new URL("../public/audio/", import.meta.url));
mkdirSync(OUT, { recursive: true });

// ---- same constants as web/src/lib/music.ts ----
const SLENDRO = [0, 2.4, 4.8, 7.2, 9.6];
const ROOT = { garden: 220, flappy: 262 };
const BPM = { garden: 84, flappy: 138 };
const MELODY = {
  garden: [0, null, 2, 3, null, 2, 4, null, 3, null, 2, 0, null, 1, 2, null],
  flappy: [0, 2, 4, 5, 4, 2, 3, null, 0, 2, 4, 7, 6, 4, 5, null],
};
const BASS = {
  garden: [0, null, null, null, -3, null, null, null, -2, null, null, null, -5, null, null, null],
  flappy: [0, null, 0, null, -3, null, -3, null, -2, null, -2, null, -1, null, -5, null],
};
const freq = (root, degree) => {
  const octave = Math.floor(degree / 5);
  const idx = ((degree % 5) + 5) % 5;
  return root * 2 ** ((SLENDRO[idx] + octave * 12) / 12);
};

const OSC = {
  square: (p) => (p % 1 < 0.5 ? 1 : -1),
  triangle: (p) => 1 - 4 * Math.abs((p % 1) - 0.5),
  sine: (p) => Math.sin(2 * Math.PI * p),
};

/** Same envelope as music.ts note(): 10 ms attack, exponential decay to -80 dB over `dur`. */
function note(buf, f, t, dur, type, vol, f2 = f) {
  const start = Math.floor(t * SR), n = Math.floor((dur + 0.05) * SR);
  let phase = 0;
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const s = i / SR;
    const env = s < 0.01 ? vol * (s / 0.01) : vol * Math.pow(0.0001 / vol, Math.min(1, (s - 0.01) / Math.max(0.001, dur - 0.01)));
    phase += (f + (f2 - f) * Math.min(1, s / dur)) / SR;
    buf[start + i] += OSC[type](phase) * env;
  }
}

function music(theme, steps) {
  const stepDur = 60 / BPM[theme] / 2;
  const buf = new Float32Array(Math.ceil(steps * stepDur * SR) + SR); // +1 s tail, trimmed below
  for (let step = 0; step < steps; step++) {
    const t = step * stepDur, i = step % 16;
    const m = MELODY[theme][i], b = BASS[theme][i];
    if (m !== null) note(buf, freq(ROOT[theme], m + 5), t, stepDur * 1.8, "square", 0.05);
    if (b !== null) note(buf, freq(ROOT[theme], b), t, stepDur * 3.5, "triangle", 0.09);
    if (theme === "garden" && step % 64 === 0) note(buf, ROOT.garden / 2, t, 3, "sine", 0.12);
    if (theme === "flappy" && i % 4 === 2) note(buf, 1800, t, 0.03, "square", 0.015);
    if (i % 8 === 0) [0, 2, 4].forEach((d, k) => note(buf, freq(ROOT[theme], (m ?? 0) + 10 + d), t + k * (stepDur / 3), stepDur / 3, "square", 0.025));
  }
  // fold the tail back onto the start so the loop is seamless
  const len = Math.round(steps * stepDur * SR);
  for (let i = len; i < buf.length; i++) buf[i - len] += buf[i];
  return buf.subarray(0, len);
}

function noise(buf, t, dur, vol, cutFrom, cutTo) {
  const start = Math.floor(t * SR), n = Math.floor(dur * SR);
  let lp = 0, seed = 1;
  for (let i = 0; i < n; i++) {
    seed = (seed * 16807) % 2147483647;
    const x = (seed / 2147483647) * 2 - 1, k = i / n;
    const a = 1 - Math.exp((-2 * Math.PI * (cutFrom + (cutTo - cutFrom) * k)) / SR);
    lp += a * (x - lp);
    buf[start + i] += lp * vol * Math.sin(Math.PI * k);
  }
}

const sfx = (sec, fn) => { const b = new Float32Array(Math.ceil(sec * SR)); fn(b); return b; };
const HI = 880;
const SFX = {
  "ui-click": sfx(0.08, (b) => { note(b, 1400, 0, 0.03, "square", 0.5); noise(b, 0, 0.012, 0.4, 6000, 6000); }),
  "tx-confirm": sfx(0.45, (b) => { note(b, freq(HI, 2), 0, 0.12, "square", 0.45); note(b, freq(HI, 5), 0.09, 0.3, "square", 0.45); }),
  coin: sfx(0.6, (b) => [0, 1, 2, 3, 4, 5, 7].forEach((d, k) => note(b, freq(HI / 2, d + 5), k * 0.055, 0.14, "square", 0.4))),
  "score-tick": sfx(0.05, (b) => note(b, 2400, 0, 0.02, "square", 0.35)),
  whoosh: sfx(0.5, (b) => noise(b, 0, 0.5, 2.2, 300, 5000)),
  chirp: sfx(0.6, (b) => { let t = 0; for (const [f1, f2, d] of [[2600, 3400, 0.08], [3400, 2800, 0.08], [2800, 3600, 0.08], [3600, 3000, 0.12]]) { note(b, f1, t, d, "sine", 0.5, f2); t += d + 0.02; } }),
};

function writeWav(name, data, peak) {
  let max = 0;
  for (const v of data) max = Math.max(max, Math.abs(v));
  const g = max ? peak / max : 0;
  const pcm = Buffer.alloc(44 + data.length * 2);
  pcm.write("RIFF", 0); pcm.writeUInt32LE(36 + data.length * 2, 4); pcm.write("WAVE", 8);
  pcm.write("fmt ", 12); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34);
  pcm.write("data", 36); pcm.writeUInt32LE(data.length * 2, 40);
  data.forEach((v, i) => pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * g)) * 32767), 44 + i * 2));
  writeFileSync(OUT + name + ".wav", pcm);
  // self-check: header sizes match the file and the signal isn't silent
  const r = readFileSync(OUT + name + ".wav");
  if (r.readUInt32LE(40) !== r.length - 44 || r.toString("ascii", 8, 12) !== "WAVE" || !max) throw new Error(`bad wav ${name}`);
  console.log(`${name}.wav  ${(data.length / SR).toFixed(2)} s`);
}

// Music normalised to -1 dBFS peak; Remotion plays it at volume ~0.12-0.15 under the voice-over.
writeWav("music-garden", music("garden", 192), 0.9); // 192 steps @84 BPM = 68.6 s seamless loop (3 gong cycles)
writeWav("music-flappy", music("flappy", 192), 0.9); // 192 steps @138 BPM = 41.7 s (teaser)
for (const [k, v] of Object.entries(SFX)) writeWav(k, v, 0.7);

import { BIRDS } from "./birds";

// ponytail: synthesized chirps, no audio assets or licensing. Swap for xeno-canto recordings (CC, with attribution) later.
let ctx: AudioContext | null = null;

/** Safari/old iOS only ship webkitAudioContext; some embedded browsers have neither. */
export function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return AC ? new AC() : null;
}

export function chirp(speciesId: number, volume = 0.15) {
  ctx ??= audioContext();
  if (!ctx) return;
  let t = ctx.currentTime;
  for (const [from, to, dur] of BIRDS[speciesId]?.song ?? BIRDS[0].song) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    t += dur + 0.03;
  }
}

let songNodes: OscillatorNode[] = [];

/** Long song for the bird card (~4–5 s): the species phrase three times with pitch variation, trills in between,
 *  and a closing flourish. Calling again restarts it. */
export function singSong(speciesId: number, volume = 0.14) {
  ctx ??= audioContext();
  if (!ctx) return;
  const c = ctx;
  songNodes.forEach((o) => {
    try {
      o.stop();
    } catch {}
  });
  songNodes = [];
  const phrase = BIRDS[speciesId]?.song ?? BIRDS[0].song;
  let t = c.currentTime + 0.02;

  const tone = (from: number, to: number, dur: number, vol = volume) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const vib = c.createOscillator();
    const vibGain = c.createGain();
    vib.frequency.value = 28; // fast warble, sounds more like a syrinx than a pure beep
    vibGain.gain.value = from * 0.012;
    vib.connect(vibGain).connect(osc.frequency);
    osc.type = "sine";
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    vib.start(t);
    osc.stop(t + dur + 0.02);
    vib.stop(t + dur + 0.02);
    songNodes.push(osc, vib);
    t += dur + 0.025;
  };

  const [hi, lo] = [Math.max(...phrase.map((p) => p[0])), Math.min(...phrase.map((p) => p[1]))];
  [1, 1.07, 0.94].forEach((k, rep) => {
    for (const [from, to, dur] of phrase) tone(from * k, to * k, dur);
    if (rep < 2) {
      for (let i = 0; i < 7; i++) tone(i % 2 ? hi * k : (hi * k * 0.85), i % 2 ? hi * k * 0.85 : hi * k, 0.035, volume * 0.8); // trill
      t += 0.12;
    }
  });
  for (let i = 0; i < 4; i++) tone(hi * (1 - i * 0.08), lo * (1 - i * 0.05), 0.07); // closing flourish
  return t - c.currentTime;
}

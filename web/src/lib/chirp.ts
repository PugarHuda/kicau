import { BIRDS } from "./birds";

// ponytail: synthesized chirps, no audio assets or licensing. Swap for xeno-canto recordings (CC, with attribution) later.
let ctx: AudioContext | null = null;

export function chirp(speciesId: number, volume = 0.15) {
  if (typeof window === "undefined") return;
  ctx ??= new AudioContext();
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

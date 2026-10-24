// Pure game rules (no DOM) so they can be sanity-checked outside the browser.

export const W = 400;
export const H = 600;
export const GROUND_Y = H - 40;
export const BIRD_X = 110;
export const BASE = { gravity: 1500, flap: 450, radius: 14, pipeSpeed: 180, gap: 150, spawnEvery: 1.4, pipeW: 64 };
export const CAP_OVERHANG = 4; // pipe caps are drawn 4px wider on each side
export const CAP_H = 16;
export const MIN_GAP = 120;
const EDGE = 56; // min distance between a gap and the ceiling / ground

/** Difficulty ramp: pipes get 5% faster every 10 points. Tune here. */
export function pipeSpeed(score: number) {
  return BASE.pipeSpeed * (1 + 0.05 * Math.floor(score / 10));
}

/** Gap narrows 1px per point, from 150 down to 120. */
export function gapSize(score: number) {
  return Math.max(MIN_GAP, BASE.gap - score);
}

/**
 * Next gap centre: a bounded random walk from the previous one so consecutive gaps
 * are always reachable. Max jump grows from 70px to 150px as the score climbs.
 * `r` is a random number in [0, 1).
 */
export function nextGapY(prevY: number, gap: number, score: number, r: number) {
  const lo = EDGE + gap / 2;
  const hi = GROUND_Y - EDGE - gap / 2;
  const maxJump = Math.min(150, 70 + score * 4);
  const y = prevY + (r * 2 - 1) * maxJump;
  return Math.max(lo, Math.min(hi, y));
}

/** Circle vs axis-aligned rect (x, y, w, h). Touching counts as a hit. */
export function circleRect(cx: number, cy: number, r: number, x: number, y: number, w: number, h: number) {
  if (w <= 0 || h <= 0) return false;
  const nx = cx < x ? x : cx > x + w ? x + w : cx;
  const ny = cy < y ? y : cy > y + h ? y + h : cy;
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

/** A pipe counts as passed once the bird's left edge clears the cap. */
export function passedPipe(r: number, px: number) {
  return px + BASE.pipeW + CAP_OVERHANG < BIRD_X - r;
}

/** Bird circle vs one pipe pair, including the wider caps, exactly as drawn. */
export function hitsPipe(cy: number, r: number, px: number, gapY: number, gap: number) {
  const top = gapY - gap / 2;
  const bot = gapY + gap / 2;
  const cx = BIRD_X;
  const w = BASE.pipeW;
  const o = CAP_OVERHANG;
  // quick reject: horizontally clear of the widest part
  if (cx + r < px - o || cx - r > px + w + o) return false;
  return (
    circleRect(cx, cy, r, px, 0, w, top - CAP_H) || // top shaft
    circleRect(cx, cy, r, px - o, top - CAP_H, w + 2 * o, CAP_H) || // top cap
    circleRect(cx, cy, r, px - o, bot, w + 2 * o, CAP_H) || // bottom cap
    circleRect(cx, cy, r, px, bot + CAP_H, w, GROUND_Y - bot - CAP_H) // bottom shaft
  );
}

/** Seeded PRNG (mulberry32) so an on-chain run seed gives every player the same, replayable pipe layout. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pure game rules (no DOM) so they can be sanity-checked outside the browser.

export const W = 400;
export const H = 600;
export const GROUND_Y = H - 40;
export const BIRD_X = 110;
export const BASE = { gravity: 1500, flap: 450, radius: 14, pipeSpeed: 180, gap: 150, spawnEvery: 1.4, pipeW: 64 };
export const CAP_OVERHANG = 4; // max horizontal reach past pipeW (leaves); used for spawn / pass / cull
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

/** An obstacle counts as passed once the bird's left edge clears its widest drawn part. */
export function passedPipe(r: number, px: number) {
  return px + BASE.pipeW + CAP_OVERHANG < BIRD_X - r;
}

/*
 * Obstacle geometry ("keep the song, not the cage"). All x are relative to the obstacle's left
 * edge `px`; the obstacle body spans px..px+pipeW (leaves may poke CAP_OVERHANG further).
 *
 * TOP: a bamboo gantangan pole hangs from the sky with 1-3 empty bird cages hooked onto it.
 *   The lowest cage's base sits exactly on the gap's top edge.
 * BOTTOM: a clump of cut bamboo stalks; the tallest stalk top sits exactly on the gap's bottom edge.
 *
 * COLLIDES: the pole, each cage's stepped dome (3 rects), cage body, cage base tray, each bamboo stalk
 *   (the contest number plate sits inside the main stalk's width, so it is covered by the stalk).
 * NEVER COLLIDES: hook ring, rope and peg above each cage (thin, 8px of empty air between pole end and
 *   the lowest dome, smaller than any bird), bamboo leaves (foliage).
 */
export const POLE = { x: 26, w: 12 };
export const CAGE_H = 50;
export const CAGE_ROPE = 8; // non-colliding hook + rope between a peg on the pole and the cage top
/** Cage parts as [x, y, w, h], y from the cage top. Drawn and collided identically. */
export const CAGE_RECTS: readonly (readonly [number, number, number, number])[] = [
  [22, 2, 20, 4], // dome tip
  [14, 6, 36, 4], // dome
  [10, 10, 44, 4], // dome rim
  [8, 14, 48, 30], // barred body
  [6, 44, 52, 6], // wooden base tray
];
/** Bamboo clump variants: stalks as [x, w, dy], dy = how far below the gap edge the stalk top is. */
export const BAMBOO: readonly (readonly (readonly [number, number, number])[])[] = [
  [
    [16, 28, 0],
    [46, 18, 40],
  ],
  [
    [22, 28, 0],
    [2, 18, 56],
  ],
  [
    [4, 26, 0],
    [34, 26, 20],
  ],
];

export type Look = { cages: number; tint: number; bamboo: number; plate: number };

/**
 * Cosmetics for obstacle `i` from a hash of (seed, i): deterministic per run seed but a separate
 * stream from `mulberry32`, so gap positions are untouched by it.
 */
export function obstacleLook(seed: number, i: number): Look {
  let h = (seed ^ Math.imul(i + 1, 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h = (h ^ (h >>> 16)) >>> 0;
  return {
    cages: 1 + (h % 3),
    tint: (h >>> 4) & 3,
    bamboo: ((h >>> 8) & 0xff) % BAMBOO.length,
    plate: (h >>> 16) & 1 ? 1 + ((h >>> 17) % 30) : 0,
  };
}

/** Bird circle vs one obstacle pair, exactly as drawn (see the geometry notes above). */
export function hitsPipe(cy: number, r: number, px: number, gapY: number, gap: number, look: Look) {
  const cx = BIRD_X;
  if (cx + r < px || cx - r > px + BASE.pipeW) return false; // horizontally clear
  const top = gapY - gap / 2;
  const bot = gapY + gap / 2;
  if (cy - r <= top) {
    const lowTop = top - CAGE_H; // lowest cage's top
    const poleEnd = lowTop - CAGE_ROPE;
    if (circleRect(cx, cy, r, px + POLE.x, -H, POLE.w, poleEnd + H)) return true;
    for (let k = 0; k < look.cages; k++) {
      const ct = lowTop - k * (CAGE_H + CAGE_ROPE);
      for (const [x, y, w, h] of CAGE_RECTS) if (circleRect(cx, cy, r, px + x, ct + y, w, h)) return true;
    }
  }
  if (cy + r >= bot) {
    for (const [x, w, dy] of BAMBOO[look.bamboo]) if (circleRect(cx, cy, r, px + x, bot + dy, w, GROUND_Y - bot - dy)) return true;
  }
  return false;
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

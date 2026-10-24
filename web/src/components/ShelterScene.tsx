"use client";

import { useEffect, useRef, useState } from "react";
import { birdDataUri } from "@/lib/birds";
import { chirp } from "@/lib/chirp";

/** One bird in the garden. `id` = species art id (also the chirp voice); `image` overrides the sprite (registered birds). */
export type SceneBird = { key: string; id: number; name: string; label: string; image?: string; imageUp?: string; soldOut?: boolean };
type Spot = { x: number; y: number; perch: boolean };
type Pose = { spot: number; mode: "idle" | "hop" | "fly"; dur: number; flip: boolean };

// Everything is in % of the scene box (x from left, y = where the bird's feet touch), so it scales at any size.
// The painted background (paintScene) places branches, poles and fence posts at these same %.
const SPOTS: Spot[] = [
  // tree branches, bamboo perch, fence posts
  { x: 27, y: 41, perch: true },
  { x: 35, y: 41, perch: true },
  { x: 9, y: 53, perch: true },
  { x: 75, y: 46, perch: true },
  { x: 86, y: 46, perch: true },
  { x: 66, y: 67, perch: true },
  { x: 90, y: 67, perch: true },
  { x: 32, y: 67, perch: true },
  // ground
  { x: 22, y: 92, perch: false },
  { x: 32, y: 85, perch: false },
  { x: 42, y: 93, perch: false },
  { x: 53, y: 86, perch: false },
  { x: 64, y: 92, perch: false },
  { x: 74, y: 85, perch: false },
  { x: 88, y: 91, perch: false },
  { x: 12, y: 84, perch: false },
  { x: 8, y: 95, perch: false },
  { x: 46, y: 79, perch: false },
  { x: 60, y: 79, perch: false },
  { x: 84, y: 79, perch: false },
  { x: 28, y: 97, perch: false },
  { x: 56, y: 97, perch: false },
  { x: 78, y: 97, perch: false },
];
const START = [0, 8, 3, 11, 14, 1, 18, 10, 4, 9, 12, 2, 20, 6, 16, 13]; // distinct, deterministic so SSR and client agree
export const MAX_SCENE_BIRDS = START.length;

// birdSvg is not free and `birds` is a fresh array each parent render, so cache per frame.
const spriteCache = new Map<string, string>();
const sprite = (id: number, up: boolean) => {
  const k = `${id}:${up}`;
  if (!spriteCache.has(k)) spriteCache.set(k, birdDataUri(id, up));
  return spriteCache.get(k)!;
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

// ---------------------------------------------------------------------------------------------
// Background: painted once per aspect into a tiny canvas (128×160 phone, 256×144 desktop) and
// upscaled nearest-neighbour. Grass uses Kenney Tiny Town tiles (CC0) at 1:1 so it matches /taman.

const TILESET = "/taman/tiny-town.png";
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function mulberry(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LEAF = ["#1d3f27", "#2a5e35", "#3b7e40", "#56a04b", "#7fc463", "#a8dc7c"];
const LEAF_FAR = ["#3c6447", "#4a7a55", "#5a8f63", "#6ca472", "#86b98a", "#9fcca0"];
const GRASS = "#84c669";
type Blob = [cx: number, cy: number, rx: number, ry: number];

function paintScene(W: number, H: number, sheet: ImageData | null): ImageData {
  const img = new ImageData(W, H);
  const buf = new Uint32Array(img.data.buffer);
  const cc = new Map<string, number>();
  const u32 = (h: string) => {
    let v = cc.get(h);
    if (v === undefined) {
      const n = parseInt(h.slice(1), 16);
      v = ((255 << 24) | ((n & 255) << 16) | (n & 0xff00) | ((n >> 16) & 255)) >>> 0;
      cc.set(h, v);
    }
    return v;
  };
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const p = (x: number, y: number, c: string) => {
    x = Math.floor(x);
    y = Math.floor(y);
    if (inb(x, y)) buf[y * W + x] = u32(c);
  };
  const is = (x: number, y: number, c: string) => inb(x, y) && buf[y * W + x] === u32(c);
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) p(i, j, c);
  };
  const X = (v: number) => Math.round((v * W) / 100);
  const Y = (v: number) => Math.round((v * H) / 100);
  const R = mulberry(11);
  const gy = Y(74); // ground line
  const tile = (t: number, dx: number, dy: number) => {
    if (!sheet) return rect(dx, dy, 16, 16, GRASS);
    const sx = (t % 12) * 16, sy = Math.floor(t / 12) * 16;
    for (let j = 0; j < 16; j++)
      for (let i = 0; i < 16; i++) {
        const o = ((sy + j) * sheet.width + sx + i) * 4;
        const x = dx + i, y = dy + j;
        if (sheet.data[o + 3] && inb(x, y)) buf[y * W + x] = ((255 << 24) | (sheet.data[o + 2] << 16) | (sheet.data[o + 1] << 8) | sheet.data[o]) >>> 0;
      }
  };

  /** Leaf canopy from overlapping clumps: later clumps sit in front and cast a dark lip on the ones below. */
  const canopy = (blobs: Blob[], pal: string[]) => {
    // integer bounds: blobs can be fractional (R(), * s), and a fractional x0 makes `own[...]` undefined → crash
    const x0 = Math.max(0, Math.floor(Math.min(...blobs.map((b) => b[0] - b[2])) - 2)), x1 = Math.min(W, Math.ceil(Math.max(...blobs.map((b) => b[0] + b[2])) + 2));
    const y0 = Math.max(0, Math.floor(Math.min(...blobs.map((b) => b[1] - b[3])) - 2)), y1 = Math.min(H, Math.ceil(Math.max(...blobs.map((b) => b[1] + b[3])) + 2));
    const bw = x1 - x0, bh = y1 - y0;
    const own = new Int16Array(bw * bh).fill(-1);
    const at = (x: number, y: number) => (x < x0 || y < y0 || x >= x1 || y >= y1 ? -1 : own[(y - y0) * bw + x - x0]);
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++)
        blobs.forEach(([cx, cy, rx, ry], i) => {
          const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry;
          if (u * u + v * v <= 1 + (hash(x, y) - 0.5) * 0.45) own[(y - y0) * bw + x - x0] = i;
        });
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = at(x, y);
        if (i < 0) continue;
        const [cx, cy, rx, ry] = blobs[i];
        let c: string;
        if (at(x, y + 1) < 0 || at(x - 1, y) < 0) c = pal[0];
        else if (at(x, y - 1) < 0 || at(x + 1, y) < 0) c = pal[1];
        else if (at(x, y - 1) > i || at(x, y - 2) > i) c = at(x, y - 1) > i ? pal[0] : pal[1]; // shadow under a front clump
        else {
          const u = (x - cx) / rx, v = (y - cy) / ry;
          const g = (y - y0) / bh;
          const l = -v * 0.6 + u * 0.35 + (hash(x * 3, y) - 0.5) * 0.3 + (bay(x, y) - 0.5) * 0.3 - g * 0.55 + 0.25;
          c = l > 0.62 ? (hash(y, x) < 0.2 ? pal[5] : pal[4]) : l > 0.25 ? pal[3] : l > -0.15 ? pal[2] : pal[1];
        }
        p(x, y, c);
      }
  };

  // ---- sky: dithered bands
  const SKY = ["#78c0da", "#8fcfe0", "#a6d9e6", "#bfe4ea", "#d8eee9", "#eaf3e2"];
  for (let y = 0; y < gy; y++) {
    const t = Math.min(SKY.length - 1, (y / (gy * 0.9)) * (SKY.length - 1));
    const i = Math.floor(t);
    const f = Math.max(0, Math.min(1, (t - i - 0.5) / 0.5));
    for (let x = 0; x < W; x++) p(x, y, bay(x, y) < f ? SKY[Math.min(i + 1, SKY.length - 1)] : SKY[i]);
  }

  // ---- sun with glow ring and rays
  {
    const cx = X(86), cy = Y(11), r = Math.max(5, Math.round(Math.min(W, H) * 0.055));
    for (let y = cy - r - 4; y <= cy + r + 4; y++)
      for (let x = cx - r - 4; x <= cx + r + 4; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
        if (d > r + 3.5) continue;
        if (d > r + 1.5) { if (bay(x, y) < 0.4) p(x, y, "#fbefc0"); }
        else if (d > r) p(x, y, "#f8dc8a");
        else p(x, y, dx + dy > r * 0.55 ? "#e8a33d" : dx + dy < -r * 0.7 ? "#ffe39a" : "#f6c25b");
      }
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4, len = k % 2 ? 2 : 3;
      for (let s = r + 5; s < r + 5 + len; s++) p(cx + Math.round(Math.cos(a) * s), cy + Math.round(Math.sin(a) * s), "#f8d77e");
    }
  }

  // ---- clouds: puffs + flat base, lit from above
  const cloud = (cx: number, cy: number, w: number) => {
    const h = w * 0.42;
    const puffs: [number, number, number][] = [
      [cx - w * 0.24, cy + h * 0.1, h * 0.5],
      [cx + w * 0.02, cy - h * 0.2, h * 0.68],
      [cx + w * 0.27, cy + h * 0.12, h * 0.46],
    ];
    const inC = (x: number, y: number) =>
      (y >= cy && y <= cy + h * 0.38 && Math.abs(x + 0.5 - cx) <= w * 0.44 - (y - cy) * 0.7) || puffs.some(([px, py, r]) => Math.hypot(x + 0.5 - px, y + 0.5 - py) <= r && y <= cy + h * 0.38);
    for (let y = Math.floor(cy - h); y <= cy + h; y++)
      for (let x = Math.floor(cx - w / 2 - 1); x <= cx + w / 2 + 1; x++) {
        if (!inC(x, y)) continue;
        p(x, y, !inC(x, y + 1) ? "#c3dbe6" : !inC(x, y - 1) ? "#ffffff" : y > cy + h * 0.12 ? (bay(x, y) < 0.5 ? "#dcebf0" : "#eef5f4") : "#fffdf7");
      }
  };
  cloud(X(50), Y(11), W * 0.2);
  cloud(X(67), Y(27), W * 0.12);
  cloud(X(38), Y(33), W * 0.09);
  if (W > H) cloud(X(96), Y(30), W * 0.08);

  // ---- far hills + distant trees
  const fh = (x: number) => Math.round(Y(61) + H * (0.025 * Math.sin((x / W) * 9 + 1) + 0.015 * Math.sin((x / W) * 23)));
  for (let x = 0; x < W; x++)
    for (let y = fh(x); y < gy; y++) p(x, y, y === fh(x) ? "#cde4cf" : hash(x, y) < 0.07 ? "#a9cdb1" : "#b6d6bc");
  for (let k = 0, n = Math.round(W / 11); k < n; k++) {
    const x = Math.floor(R() * W), s = 2 + Math.floor(R() * 2), base = fh(x);
    if (x > X(55) && x < X(73)) continue; // keep the gantangan readable
    rect(x, base - 2, 1, 3, "#8eaa8e");
    for (let dy = -s; dy <= s; dy++)
      for (let dx = -s; dx <= s; dx++)
        if (dx * dx + dy * dy <= s * s + 1) p(x + dx, base - 2 - s + dy, dy > s / 2 || dx < -s / 2 ? "#7fb089" : dy < 0 && dx > 0 ? "#a6d3ab" : "#92c39a");
  }

  // ---- gantangan: a distant bamboo contest pole with hanging cages
  {
    const x0 = X(57), x1 = X(71), top = Y(55), bot = Y(71), w = W > 200 ? 2 : 1;
    for (const x of [x0, x1 - w]) {
      rect(x, top, w, bot - top, "#d6bf74");
      if (w > 1) rect(x + 1, top, 1, bot - top, "#b9a25a");
      for (let y = top + 4; y < bot; y += 4) rect(x, y, w, 1, "#a08a48");
    }
    rect(x0 - 1, top, x1 - x0 + 2, 1, "#d6bf74");
    rect(x0 - 1, top + 1, x1 - x0 + 2, 1, "#b9a25a");
    const n = W > 200 ? 4 : 3;
    for (let k = 0; k < n; k++) {
      const cx = Math.round(x0 + ((x1 - x0) * (k + 1)) / (n + 1)), cy = top + 2 + (k % 2);
      p(cx, cy, "#7a5a3a");
      p(cx, cy + 1, "#7a5a3a");
      rect(cx - 1, cy + 2, 3, 1, "#9a7650");
      rect(cx - 2, cy + 3, 5, 1, "#9a7650");
      for (let y = cy + 4; y < cy + 8; y++) for (let x = cx - 2; x <= cx + 2; x += 2) p(x, y, "#8a6a46");
      rect(cx - 2, cy + 8, 5, 1, "#6b4a2e");
      if (k === 1) p(cx, cy + 1, "#f2c94c"); // a bird sitting on top of an open cage
    }
  }

  // ---- near hills
  const nh = (x: number) => Math.round(Y(67) + H * (0.03 * Math.sin((x / W) * 6 + 3) + 0.012 * Math.sin((x / W) * 17 + 1)));
  for (let x = 0; x < W; x++)
    for (let y = nh(x); y < gy; y++) {
      const d = y - nh(x);
      p(x, y, d === 0 ? "#a3d394" : d === 1 ? "#93c788" : hash(x, y) < 0.08 || (y > gy - 4 && bay(x, y) < ((y - gy + 4) / 4) * 0.6) ? "#78ad73" : "#86bb80");
    }
  for (let k = 0; k < Math.round(W / 40); k++) {
    const x = Math.floor(R() * W), y = nh(x) + 2;
    canopy([[x, y, 3 + R() * 2, 2.2]], LEAF_FAR);
  }

  // ---- small tree in the back, right
  {
    const tx = X(94), base = nh(tx) + 2, th = Math.round(H * 0.07);
    rect(tx - 1, base - th, 2, th, "#6b4a2e");
    p(tx, base - th, "#56391f");
    const s = Math.min(W, H) / 100;
    canopy(
      [
        [tx - 4 * s, base - th - 1 * s, 5 * s, 4 * s],
        [tx + 4 * s, base - th - 1 * s, 5 * s, 4 * s],
        [tx, base - th - 5 * s, 6 * s, 5 * s],
      ],
      LEAF_FAR,
    );
  }

  // ---- ground: Tiny Town grass tiles + blades
  for (let y = gy; y < H; y += 16) for (let x = -5; x < W; x += 16) tile(R() < 0.7 ? 0 : R() < 0.78 ? 1 : 2, x, y);
  for (let x = 0; x < W; x++) {
    if (hash(x, 1) < 0.45) p(x, gy - 1, GRASS);
    if (hash(x, 2) < 0.14) p(x, gy - 2, GRASS);
    if (hash(x, 3) < 0.3) p(x, gy, "#8bd87d");
  }
  for (let y = gy + 2; y < H; y++)
    for (let x = 0; x < W; x++) {
      const h = hash(x, y);
      if (h < 0.035) {
        p(x, y, "#65a556");
        p(x - 1, y - 1, "#65a556");
        p(x + 1, y - 1, "#65a556");
      } else if (h > 0.985) p(x, y, "#8bd87d");
      if (y >= H - 3 && bay(x, y) < (y - H + 4) / 4) p(x, y, "#65a556");
    }

  // ---- dirt path winding toward the back
  const PATH = "#eaa56c";
  for (let y = gy + 3; y < H; y++) {
    const t = (y - gy) / (H - gy);
    const cx = W * (0.53 + 0.035 * Math.sin(t * 4.2)), hw = W * (0.045 + 0.2 * t);
    const l = Math.round(cx - hw), r = Math.round(cx + hw);
    for (let x = l; x <= r; x++) {
      const h = hash(x, y);
      if ((x - l < 2 || r - x < 2) && h < 0.3) continue; // grass nibbles the edge
      p(x, y, x === l || x === r || y === gy + 3 ? "#cf8254" : h < 0.05 ? "#fec99c" : h > 0.975 ? "#cf8254" : PATH);
    }
  }
  for (let k = 0; k < 14; k++) {
    const x = Math.floor(R() * W), y = gy + 4 + Math.floor(R() * (H - gy - 5));
    if (!is(x, y, PATH) || !is(x + 1, y, PATH)) continue;
    rect(x, y, 2, 1, "#d8c7b2");
    rect(x, y + 1, 2, 1, "#8f7f70");
  }

  // ---- soft shadows: tree, perch stand
  const shadow = (cx: number, cy: number, rx: number, ry: number) => {
    for (let y = cy - ry; y <= cy + ry; y++)
      for (let x = cx - rx; x <= cx + rx; x++) {
        const u = (x - cx) / rx, v = (y - cy) / ry;
        if (u * u + v * v <= 1 && bay(x, y) < 0.55 && (is(x, y, GRASS) || is(x, y, "#8bd87d") || is(x, y, "#65a556"))) p(x, y, "#5f9f50");
      }
  };
  shadow(X(19), gy + 4, Math.round(W * 0.14), 3);
  shadow(X(81), gy + 3, Math.round(W * 0.06), 2);

  // ---- bushes at the edges
  const s = Math.min(W, H) / 100;
  canopy([[X(1), Y(72), 8 * s, 5 * s], [X(9), Y(73), 6 * s, 4 * s]], LEAF);
  canopy([[X(99), Y(72), 8 * s, 5 * s], [X(92), Y(74), 5 * s, 3.5 * s]], LEAF);

  // ---- fences in the Tiny Town palette (posts line up with fence perch spots)
  const fence = (posts: number[]) => {
    const top = Y(67), bot = gy + 3;
    const xs = posts.map(X);
    for (const ry of [top + 4, top + 8]) {
      rect(xs[0], ry - 1, xs[xs.length - 1] - xs[0], 1, "#3f2631");
      rect(xs[0], ry, xs[xs.length - 1] - xs[0], 2, "#eaa56c");
      rect(xs[0], ry + 2, xs[xs.length - 1] - xs[0], 1, "#3f2631");
    }
    for (const x of xs) {
      rect(x - 3, top + 1, 6, bot - top - 1, "#3f2631");
      rect(x - 2, top, 4, 1, "#3f2631");
      rect(x - 2, top + 1, 4, bot - top - 2, "#eaa56c");
      rect(x + 1, top + 2, 1, bot - top - 3, "#bd6c4a");
      p(x - 2, top + 1, "#fec99c");
    }
  };
  fence([60, 66, 72, 78, 84, 90, 96, 102]);
  fence([-2, 4, 26, 32]);

  // ---- main tree: trunk, branches, canopy
  const BARK = { light: "#9a6a40", base: "#7a5232", dark: "#5e3d24", deep: "#4a2f1c" };
  const tx0 = X(16), tx1 = X(21), tw = tx1 - tx0;
  // limbs into the crown (mostly hidden, peek out under the leaves)
  for (let k = 0; k < Math.round(H * 0.12); k++) {
    rect(tx0 + 1 - Math.round(k * 0.8), Y(28) - k, 2, 2, BARK.dark);
    rect(tx1 - 2 + Math.round(k * 0.9), Y(28) - k, 2, 2, BARK.base);
  }
  for (let y = Y(24); y < gy + 3; y++) {
    const flare = Math.max(0, y - (gy - 2));
    for (let x = tx0 - flare; x < tx1 + flare; x++) {
      const rel = (x - tx0) / Math.max(1, tw - 1);
      let c = rel < 0.25 ? BARK.light : rel > 0.7 ? BARK.dark : BARK.base;
      if (rel > 0.15 && rel < 0.85 && hash(x, Math.floor(y / 3)) < 0.2) c = BARK.deep; // bark lines
      if (x < tx0 || x >= tx1) c = BARK.deep; // roots
      if (y < Y(33)) c = rel < 0.25 ? BARK.base : BARK.deep; // under-shade of the crown
      p(x, y, c);
    }
  }
  rect(tx0 + Math.floor(tw / 2), Y(60), 2, 2, BARK.deep); // knot
  p(tx0 + Math.floor(tw / 2), Y(60), BARK.light);

  const branch = (from: number, to: number, topY: number) => {
    const th = Math.max(3, Math.round(H * 0.024));
    const len = Math.abs(to - from), dir = Math.sign(to - from);
    for (let k = 0; k <= len; k++) {
      const x = from + dir * k, t = k / len;
      const thick = Math.max(2, Math.round(th + (1 - t) * 2 - t * 1)); // tapers toward the tip
      for (let j = 0; j < thick; j++) p(x, topY + j, j === 0 ? BARK.light : j === thick - 1 ? BARK.deep : BARK.base);
      if (hash(x, topY) < 0.12) p(x, topY + 1, BARK.dark);
    }
    // twig + leaf tuft at the tip
    for (let k = 1; k <= 3; k++) p(to + dir * k, topY - k, BARK.dark);
    canopy([[to + dir * 5, topY - 5, 4.5 * s, 3.2 * s]], LEAF);
  };
  branch(tx1 - 1, X(39), Y(41));
  branch(tx0, X(4), Y(53));

  canopy(
    (
      [
        [6, 26, 8, 7],
        [33, 25, 8, 7],
        [14, 24, 10, 7],
        [26, 23, 10, 7],
        [5, 16, 9, 8],
        [32, 15, 10, 8],
        [19, 17, 11, 8],
        [11, 9, 9, 7],
        [27, 8, 9, 7],
        [19, 4, 9, 5],
      ] as const
    ).map(([cx, cy, rx, ry]) => [X(cx), Y(cy), (rx * W) / 100, (ry * H) / 100] as Blob),
    LEAF,
  );

  // ---- bamboo perch stand
  {
    const px0 = X(79.5), pw = Math.max(3, X(82) - px0), top = Y(46), th = Math.max(3, Math.round(H * 0.024));
    for (let y = top; y < gy + 3; y++)
      for (let x = px0; x < px0 + pw; x++) p(x, y, x === px0 ? "#e6cf72" : x === px0 + pw - 1 ? "#b08f35" : "#d2b04c");
    for (let y = top + th + 6; y < gy; y += 7) rect(px0 - 1, y, pw + 2, 1, "#9c7a2a");
    const cx0 = X(70), cx1 = X(91);
    for (let x = cx0; x < cx1; x++) for (let j = 0; j < th; j++) p(x, top + j, j === 0 ? "#e6cf72" : j === th - 1 ? "#9c7a2a" : "#d2b04c");
    for (let x = cx0 + 6; x < cx1 - 2; x += 8) rect(x, top, 1, th, "#9c7a2a");
    rect(cx0 - 1, top, 1, th, "#8a6a24");
    rect(cx1, top, 1, th, "#8a6a24");
    for (let j = 0; j < 3; j++) for (let x = px0 - 1; x < px0 + pw + 1; x++) p(x, top + th + j, (x + j) % 2 ? "#7a5232" : "#5e3d24"); // rope lashing
    rect(px0 - 3, gy + 2, pw + 6, 2, "#a39a8c");
    rect(px0 - 2, gy + 1, pw + 4, 1, "#c4bcae");
    rect(px0 - 3, gy + 4, pw + 6, 1, "#857d71");
  }

  // ---- flowers + pebbles on the grass
  const PETALS = ["#ffffff", "#f27ea9", "#e34b4b", "#b38cf0", "#fdbe53"];
  for (let k = 0, n = Math.round((W * (H - gy)) / 90); k < n; k++) {
    const x = 1 + Math.floor(R() * (W - 2)), y = gy + 3 + Math.floor(R() * (H - gy - 5));
    if (!is(x, y, GRASS) || !is(x, y + 1, GRASS)) continue;
    const c = PETALS[Math.floor(R() * PETALS.length)];
    if (R() < 0.5) {
      p(x, y + 1, "#4f9a45");
      p(x - 1, y, c);
      p(x + 1, y, c);
      p(x, y - 1, c);
      p(x, y, "#fdbe53");
    } else if (R() < 0.6) {
      p(x, y, c);
      p(x, y + 1, "#4f9a45");
    } else {
      p(x, y, "#c4bcae");
      p(x + 1, y, "#a39a8c");
    }
  }
  return img;
}

const bgCache = new Map<string, ImageData>();
let sheetData: ImageData | null = null;

export function ShelterScene({ birds, onSelect }: { birds: SceneBird[]; onSelect: (bird: SceneBird) => void }) {
  const [poses, setPoses] = useState<Pose[]>(() =>
    birds.map((_, i) => ({ spot: START[i % START.length], mode: "idle", dur: 0, flip: i % 2 === 1 })),
  );
  const posesRef = useRef(poses); // kept in sync by update() below
  const count = birds.length;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // new birds (async loads) get their own start spot; existing birds keep wandering where they are
  if (poses.length < count) {
    const next = [...poses];
    for (let i = poses.length; i < count; i++) next.push({ spot: START[i % START.length], mode: "idle", dur: 0, flip: i % 2 === 1 });
    posesRef.current = next;
    setPoses(next);
  }

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const draw = () => {
      const c = canvasRef.current;
      if (!c) return;
      const [W, H] = mq.matches ? [256, 144] : [128, 160];
      const k = `${W}x${H}:${!!sheetData}`;
      if (!bgCache.has(k)) bgCache.set(k, paintScene(W, H, sheetData));
      c.width = W;
      c.height = H;
      c.getContext("2d")?.putImageData(bgCache.get(k)!, 0, 0);
    };
    draw();
    if (!sheetData) {
      const im = new Image();
      im.onload = () => {
        const t = document.createElement("canvas");
        t.width = im.width;
        t.height = im.height;
        const g = t.getContext("2d");
        if (!g) return;
        g.drawImage(im, 0, 0);
        sheetData = g.getImageData(0, 0, im.width, im.height);
        draw();
      };
      im.src = TILESET;
    }
    mq.addEventListener("change", draw);
    return () => mq.removeEventListener("change", draw);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };
    const update = (i: number, p: Partial<Pose>) => {
      const next = posesRef.current.map((q, k) => (k === i ? { ...q, ...p } : q));
      posesRef.current = next;
      setPoses(next);
    };

    const move = (i: number) => {
      const cur = posesRef.current[i];
      if (!cur) return;
      const from = SPOTS[cur.spot];
      // perched birds mostly stay put; ground birds mostly hop around, sometimes fly up
      if (from.perch && Math.random() < 0.5) return later(() => move(i), rand(2500, 6000));
      const wantPerch = from.perch ? Math.random() < 0.15 : Math.random() < 0.3;
      const taken = new Set(posesRef.current.slice(0, count).map((p) => p.spot));
      const free = SPOTS.flatMap((s, k) => (!taken.has(k) && s.perch === wantPerch ? [k] : []));
      if (!free.length) return later(() => move(i), rand(2500, 6000));
      const spot = free[Math.floor(Math.random() * free.length)];
      const to = SPOTS[spot];
      const fly = from.perch || to.perch;
      const d = Math.hypot(to.x - from.x, to.y - from.y);
      const dur = Math.round(fly ? 900 + d * 14 : 400 + d * 32);
      update(i, { spot, mode: fly ? "fly" : "hop", dur, flip: to.x < from.x });
      later(() => {
        update(i, { mode: "idle" });
        later(() => move(i), rand(2500, 6000));
      }, dur);
    };

    for (let i = 0; i < count; i++) later(() => move(i), rand(800, 4000));
    return () => timers.forEach(clearTimeout);
  }, [count]);

  return (
    <div
      className="relative isolate aspect-[4/5] w-full overflow-hidden border-4 border-ink shadow-[6px_6px_0_var(--ink)] select-none sm:aspect-[16/9]"
      style={{ background: "linear-gradient(#8fcfe0 0 30%, #d8eee9 60%, #84c669 74%)" }}
    >
      <style>{`
        @keyframes kc-bob { 50% { transform: translateY(-4%); } }
        @keyframes kc-hop { 50% { transform: translateY(-22%); } }
        @keyframes kc-flap { 0% { visibility: visible; } 50%, 100% { visibility: hidden; } }
        .kc-bob { animation: kc-bob 1.2s steps(1) infinite; }
        .kc-hop { animation: kc-hop 0.32s steps(2) infinite; }
        .kc-fly .kc-up, .kc-fly .kc-down { animation: kc-flap 0.24s infinite; }
        .kc-fly .kc-down { animation-delay: -0.12s; } /* opposite phase: exactly one frame visible */
        @media (prefers-reduced-motion: reduce) { .kc-bob, .kc-hop { animation: none; } }
      `}</style>

      {/* ---- scenery (decorative): one pre-painted pixel canvas + the sign ---- */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full [image-rendering:pixelated]" />
        <div className="absolute left-[44.5%] top-[64%] h-[10%] w-[1.5%] bg-[#5e3d24] shadow-[inset_-2px_0_0_#4a2f1c]" />
        <div className="absolute left-[38%] top-[56%] grid w-[15%] min-w-[64px] place-items-center border-[3px] border-ink bg-[#c99a5b] px-1 py-[0.6%] text-center font-display text-[clamp(6px,1.1vw,11px)] leading-tight text-ink shadow-[3px_3px_0_var(--ink)]">
          KICAU GARDEN
        </div>
      </div>

      {/* ---- birds ---- */}
      {birds.slice(0, MAX_SCENE_BIRDS).map((b, i) => {
        const pose = poses[i] ?? { spot: START[i % START.length], mode: "idle", dur: 0, flip: false };
        const s = SPOTS[pose.spot];
        const align = s.x < 20 ? "left-0" : s.x > 80 ? "right-0" : "left-1/2 -translate-x-1/2";
        const down = b.image ?? sprite(b.id, false);
        const up = b.image ? (b.imageUp ?? b.image) : sprite(b.id, true);
        return (
          <button
            key={b.key}
            type="button"
            aria-label={`${b.name}, ${b.label}${b.soldOut ? ", sold out" : ""}`}
            onClick={() => {
              onSelect(b); // first: an audio failure must never block the card
              chirp(b.id);
            }}
            className="group absolute cursor-pointer outline-offset-2 hover:z-[200]! focus-visible:z-[200]!"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: "clamp(40px, 9.5%, 108px)",
              zIndex: Math.round(s.y),
              transform: "translate(-50%, -86%)", // feet (sprite row ~31/36) on the spot
              transition:
                pose.mode === "fly"
                  ? `left ${pose.dur}ms linear, top ${pose.dur}ms cubic-bezier(.2,.9,.4,1)`
                  : `left ${pose.dur}ms linear, top ${pose.dur}ms linear`,
            }}
          >
            {/* tags */}
            <span className={`pointer-events-none absolute bottom-full mb-1 flex flex-col items-center gap-1 ${align}`}>
              <span className="hidden whitespace-nowrap border-2 border-ink bg-paper px-1.5 py-1 font-display text-[9px] leading-none text-ink shadow-[2px_2px_0_var(--ink)] group-hover:block group-focus-visible:block">
                {b.name} · {b.label}
              </span>
              {b.soldOut && (
                <span className="whitespace-nowrap border-2 border-ink bg-clay px-1 py-0.5 font-display text-[7px] leading-none text-paper">
                  SOLD OUT
                </span>
              )}
            </span>
            {/* soft ground shadow (hidden mid-flight) */}
            <span
              className="pointer-events-none absolute left-1/2 top-[80%] h-[12%] w-[56%] -translate-x-1/2 rounded-[50%] bg-ink/25 transition-opacity duration-200"
              style={{ opacity: pose.mode === "fly" ? 0 : s.perch ? 0.5 : 1 }}
            />
            {/* sprite: flip wrapper > motion wrapper > 2 frames */}
            <span className="relative block transition-transform duration-100 group-hover:scale-110 group-focus-visible:scale-110">
              <span className="block" style={{ transform: pose.flip ? "scaleX(-1)" : undefined }}>
                <span
                  className={`relative block ${pose.mode === "hop" ? "kc-hop" : pose.mode === "fly" ? "kc-fly" : "kc-bob"}`}
                  style={pose.mode === "idle" ? { animationDelay: `${-i * 0.37}s` } : undefined}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={down} alt="" draggable={false} className="kc-down block w-full [image-rendering:pixelated]" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={up} alt="" draggable={false} className="kc-up invisible absolute inset-0 block w-full [image-rendering:pixelated]" />
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

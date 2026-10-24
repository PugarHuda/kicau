// Pixel-art obstacles, pre-rendered once per variant into offscreen canvases (1 logical px = 1 canvas px;
// the main canvas scales them up with imageSmoothing off, so they stay crisp at any DPR).
// Shapes come from physics.ts so what you see is exactly what collides.
import { BAMBOO, BASE, CAGE_H, CAGE_RECTS, CAGE_ROPE, CAP_OVERHANG, GROUND_Y, POLE, type Look } from "./physics";

const INK = "#1e2a1f";
const PAD = CAP_OVERHANG; // sprite x = obstacle x - PAD, room for leaves
const SW = BASE.pipeW + PAD * 2;
const TOP_H = GROUND_Y + 8; // tall enough for the highest gap edge plus the shake overdraw
const NODE = 24; // bamboo node spacing

// cage lacquer tints: [main, light, dark]
const TINTS = [
  ["#c99a52", "#ecd08f", "#5e4424"], // natural rattan
  ["#b5532a", "#e08a5a", "#4a2214"], // clay red
  ["#e8a33d", "#f7d27a", "#5e3c10"], // sun yellow
  ["#3f7f7a", "#86c3b4", "#1d3b39"], // teal
];
const POLE_C = ["#a8823f", "#d1ab5e", "#6f5428", "#4f3a1a"]; // main, light, dark, node
const STALK_C = ["#d9b85c", "#f2dc94", "#a8862f", "#7a5c1e"];
const WOOD = ["#8a6a3b", "#b48a52", "#6f5430"];
const LEAF = ["#5a9a5c", "#2f6b3a"];

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Vertical bamboo segment, top at y. Light/mid/dark pixel columns, a node band every 24px. */
function bamboo(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, [m, l, d, n]: string[], cut: boolean) {
  g.fillStyle = INK;
  g.fillRect(x, y, w, h);
  g.fillStyle = m;
  g.fillRect(x + 2, y, w - 4, h);
  g.fillStyle = l;
  g.fillRect(x + 4, y, Math.max(2, (w / 5) | 0), h);
  g.fillStyle = d;
  g.fillRect(x + w - 2 - Math.max(2, (w / 4) | 0), y, Math.max(2, (w / 4) | 0), h);
  for (let ny = y + (cut ? 18 : 10); ny < y + h; ny += NODE) {
    g.fillStyle = INK;
    g.fillRect(x + 2, ny, w - 4, 1);
    g.fillStyle = n;
    g.fillRect(x + 2, ny + 1, w - 4, 2);
    g.fillStyle = l;
    g.fillRect(x + 2, ny + 3, w - 4, 1);
  }
  if (cut) {
    // cut top: ink rim, pale ring, dark hollow
    g.fillStyle = INK;
    g.fillRect(x, y, w, 2);
    g.fillStyle = l;
    g.fillRect(x + 2, y + 2, w - 4, 4);
    g.fillStyle = n;
    g.fillRect(x + 4, y + 3, w - 8, 2);
    g.fillStyle = INK;
    g.fillRect(x, y + 6, w, 1);
  }
}

// drooping bamboo leaf, 2px cells: 1 = mid, 2 = dark underside
const LEAF_MAP = ["1100000", "0111110", "0021111", "0000222"];
// per BAMBOO variant: [x, y below the gap edge, dir]; kept inside the obstacle's 72px reach
const LEAVES: readonly (readonly [number, number, number])[][] = [
  [
    [16, 66, -1],
    [44, 18, 1],
  ],
  [
    [50, 66, 1],
    [22, 42, -1],
  ],
  [
    [30, 4, 1],
    [34, 62, -1],
  ],
];
/** Leaf sprouting from (x, y); dir -1 = left, 1 = right. Decorative, non-colliding. */
function leaf(g: CanvasRenderingContext2D, x: number, y: number, dir: number) {
  for (const pass of [0, 1])
    LEAF_MAP.forEach((row, ry) => {
      for (let cx = 0; cx < row.length; cx++) {
        const v = row[cx];
        if (v === "0") continue;
        const lx = dir > 0 ? x + cx * 2 : x - cx * 2 - 2;
        g.fillStyle = pass ? LEAF[+v - 1] : INK;
        if (pass) g.fillRect(lx, y + ry * 2, 2, 2);
        else g.fillRect(lx - 1, y + ry * 2 - 1, 4, 4);
      }
    });
}

/** Pole + cages, bottom of the sprite = the gap's top edge. */
function topSprite(cages: number, tint: number) {
  const c = canvas(SW, TOP_H);
  const g = c.getContext("2d")!;
  const [m, l, d] = TINTS[tint];
  const lowTop = TOP_H - CAGE_H;
  const poleEnd = lowTop - CAGE_ROPE;
  bamboo(g, PAD + POLE.x, 0, POLE.w, poleEnd, POLE_C, false);
  g.fillStyle = INK; // pole end cap
  g.fillRect(PAD + POLE.x, poleEnd - 2, POLE.w, 2);

  for (let k = 0; k < cages; k++) {
    const ct = lowTop - k * (CAGE_H + CAGE_ROPE);
    const o = (x: number, y: number, w: number, h: number, col: string) => {
      g.fillStyle = col;
      g.fillRect(PAD + x, ct + y, w, h);
    };
    // peg on the pole, hook ring and rope (non-colliding)
    o(POLE.x - 4, -CAGE_ROPE - 2, POLE.w + 8, 3, INK);
    o(POLE.x - 3, -CAGE_ROPE - 1, POLE.w + 6, 1, WOOD[1]);
    o(31, -CAGE_ROPE + 1, 2, CAGE_ROPE, INK);
    o(29, -2, 6, 4, INK);
    o(31, -1, 2, 2, l);

    const [tip, dome, rim, body, base] = CAGE_RECTS;
    for (const [x, y, w, h] of [tip, dome, rim]) {
      o(x, y, w, h, INK);
      o(x + 2, y + 1, w - 4, h - 1, m);
      o(x + 2, y + 1, 4, 1, l);
    }
    // barred body: dark back so it reads as solid, light bars every 6px
    const [bx, by, bw, bh] = body;
    o(bx, by, bw, bh, INK);
    o(bx + 2, by, bw - 4, bh, d);
    for (let x = bx + 4; x < bx + bw - 3; x += 6) o(x, by, 2, bh, l);
    o(bx + 2, by + 2, bw - 4, 2, m); // top rail
    o(bx + 2, by + 18, bw - 4, 2, WOOD[1]); // perch
    // open door (front, right side): frame with no bars = the bird got out
    o(36, by + 5, 14, 20, INK);
    o(37, by + 6, 12, 18, m);
    o(39, by + 8, 8, 14, d);
    o(46, by + 13, 2, 3, "#f4c430"); // latch
    // seed cup
    o(14, by + 22, 8, 4, INK);
    o(15, by + 22, 6, 2, "#e8a33d");
    // base tray
    const [tx, ty, tw, th] = base;
    o(tx, ty, tw, th, INK);
    o(tx + 2, ty + 1, tw - 4, th - 3, WOOD[0]);
    o(tx + 2, ty + 1, tw - 4, 1, WOOD[1]);
  }
  return c;
}

/** Bamboo clump, top of the sprite = the gap's bottom edge. Extends past the ground (ground overdraws it). */
function bottomSprite(variant: number) {
  const c = canvas(SW, GROUND_Y);
  const g = c.getContext("2d")!;
  const stalks = BAMBOO[variant];
  // shorter stalks first so the tall one overlaps them
  for (const [x, w, dy] of [...stalks].reverse()) bamboo(g, PAD + x, dy, w, GROUND_Y - dy, STALK_C, true);
  for (const [x, y, dir] of LEAVES[variant]) leaf(g, PAD + x, y, dir);
  return c;
}

// 3x5 pixel glyphs for the contest plate
const GLYPH: Record<string, string> = {
  "0": "111101101101111",
  "1": "010110010010111",
  "2": "111001111100111",
  "3": "111001111001111",
  "4": "101101111001001",
  "5": "111100111001111",
  "6": "111100111101111",
  "7": "111001010010010",
  "8": "111101111101111",
  "9": "111101111001111",
};
function glyph(g: CanvasRenderingContext2D, ch: string, x: number, y: number, sx: number, sy: number) {
  const bits = GLYPH[ch];
  for (let i = 0; i < 15; i++) if (bits[i] === "1") g.fillRect(x + (i % 3) * sx, y + ((i / 3) | 0) * sy, sx, sy);
}

export const PLATE_W = 24;
/** Gantangan contest number plate hung on a nail (big 2x digits; "No." was unreadable at 3px); fits inside the main stalk. */
function plateSprite(n: number) {
  const c = canvas(PLATE_W, 20);
  const g = c.getContext("2d")!;
  g.fillStyle = INK;
  g.fillRect(11, 0, 2, 4); // nail + string
  g.fillRect(0, 4, PLATE_W, 16);
  g.fillStyle = "#f6f1e4";
  g.fillRect(2, 6, PLATE_W - 4, 12);
  g.fillStyle = INK;
  const digits = String(n);
  const x0 = (PLATE_W - (digits.length * 8 - 2)) >> 1;
  for (let i = 0; i < digits.length; i++) glyph(g, digits[i], x0 + i * 8, 7, 2, 2);
  return c;
}

/** Lazily-filled sprite cache (<= 12 tops, 3 bottoms, 30 plates). */
export function obstacleArt() {
  const cache = new Map<string, HTMLCanvasElement>();
  const get = (k: string, make: () => HTMLCanvasElement) => {
    let c = cache.get(k);
    if (!c) cache.set(k, (c = make()));
    return c;
  };
  return (g: CanvasRenderingContext2D, x: number, top: number, bot: number, look: Look) => {
    g.drawImage(get(`t${look.cages}${look.tint}`, () => topSprite(look.cages, look.tint)), x - PAD, top - TOP_H);
    g.drawImage(get(`b${look.bamboo}`, () => bottomSprite(look.bamboo)), x - PAD, bot);
    if (look.plate) {
      const [mx, mw] = BAMBOO[look.bamboo][0];
      g.drawImage(get(`p${look.plate}`, () => plateSprite(look.plate)), x + mx + ((mw - PLATE_W) >> 1), bot + 26);
    }
  };
}

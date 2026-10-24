// Static world of Taman Kicau, built from Kenney "Tiny Town" (CC0, see /public/taman/LICENSE.txt).
// 1 tile = 16 px in the sheet = 48 world units (×3, nearest-neighbour).

export const TILE = 48;
const PX = 16;
const P = TILE / PX; // world units per sheet pixel
export const COLS = 42;
export const ROWS = 30;
export const WORLD_W = COLS * TILE;
export const WORLD_H = ROWS * TILE;
export const TILESET = "/taman/tiny-town.png";

export type Rect = { x: number; y: number; w: number; h: number };
export type Label = { x: number; y: number; text: string };

const B = 2; // forest border thickness, tiles
const tr = (c: number, r: number, w: number, h: number): Rect => ({ x: c * TILE, y: r * TILE, w: w * TILE, h: h * TILE });

// layout, in tiles
const YARD = { c: 4, r: 3, w: 12, h: 10 }; // fenced shelter
const GATE = { c: 9, w: 2 };
const HOUSE = { c: 8, r: 4 };
const POND = { cx: 31.5 * TILE, cy: 8 * TILE, rx: 4.2 * TILE, ry: 2.6 * TILE };
const GAZEBO = { c: 19, r: 13 };
const SIGN = { c: 22, r: 20, w: 4 };
const PATH_R = 22; // main path rows 22-23
const BUSHES = [[24, 9], [14, 17], [30, 16], [6, 16], [36, 12], [27, 19], [12, 26], [37, 26], [2 + 3, 25]] as const;
const DECOR = [[104, 17, 15], [106, 23, 16], [107, 16, 4], [94, 13, 20], [95, 37, 20]] as const; // [tile, col, row]
const FLOWERS = [[16, 20], [27, 25], [33, 21], [3, 20], [24, 4], [7, 14], [19, 26], [34, 13]] as const;

/** Tall 2-tile trees, drawn y-sorted with the birds so they can walk behind the canopy. [col,row of trunk tile, green?] */
export const TREES = [
  [18, 4, 1], [21, 6, 0], [25, 6, 1], [37, 5, 1], [38, 15, 0], [33, 25, 1], [26, 26, 0], [7, 19, 1], [10, 25, 0], [4, 26, 1],
  [38, 21, 1], [18, 26, 1], [13, 15, 0], [29, 13, 1], [17, 9, 1], [3, 10, 1], [23, 15, 0],
].map(([c, r, g]) => ({ x: (c + 0.5) * TILE, y: (r + 1) * TILE, green: !!g }));

/** Regions NPCs wander in (world units). */
export const ZONES = {
  shelter: tr(YARD.c + 1.4, 7.4, YARD.w - 2.8, 4.2),
  gazebo: tr(15, 12, 13, 8.5),
  park: tr(B + 0.5, B + 0.5, COLS - 2 * B - 1, ROWS - 2 * B - 1),
} satisfies Record<string, Rect>;

export const SPAWN = { x: 21 * TILE, y: (PATH_R + 1) * TILE };

export const LABELS: Label[] = [
  { x: (SIGN.c + SIGN.w / 2) * TILE, y: (SIGN.r + 0.55) * TILE, text: "KICAU GARDEN" },
  { x: (GATE.c + 3) * TILE, y: (YARD.r + YARD.h + 0.5) * TILE, text: "SHELTER" },
];

const yb = YARD.r + YARD.h - 1; // fence bottom row
const fence = 14;
export const OBSTACLES: Rect[] = [
  tr(0, 0, COLS, B),
  tr(0, ROWS - B, COLS, B),
  tr(0, 0, B, ROWS),
  tr(COLS - B, 0, B, ROWS),
  // shelter fence (gate gap at the bottom)
  { x: YARD.c * TILE, y: YARD.r * TILE + 18, w: YARD.w * TILE, h: fence },
  { x: YARD.c * TILE + 17, y: YARD.r * TILE, w: fence, h: YARD.h * TILE },
  { x: (YARD.c + YARD.w) * TILE - 31, y: YARD.r * TILE, w: fence, h: YARD.h * TILE },
  { x: YARD.c * TILE, y: yb * TILE + 18, w: (GATE.c - YARD.c) * TILE - 12, h: fence },
  { x: (GATE.c + GATE.w) * TILE + 12, y: yb * TILE + 18, w: (YARD.c + YARD.w - GATE.c - GATE.w) * TILE, h: fence },
  tr(HOUSE.c, HOUSE.r, 3, 3),
  tr(GAZEBO.c, GAZEBO.r, 3, 2.6),
  { x: SIGN.c * TILE + 20, y: (SIGN.r + 1) * TILE - 18, w: SIGN.w * TILE - 40, h: 16 },
  ...TREES.map((t) => ({ x: t.x - 10, y: t.y - 16, w: 20, h: 14 })),
  ...BUSHES.map(([c, r]) => ({ x: c * TILE + 6, y: r * TILE + 14, w: TILE - 12, h: TILE - 20 })),
  ...DECOR.map(([, c, r]) => ({ x: c * TILE + 8, y: r * TILE + 16, w: TILE - 16, h: TILE - 22 })),
];

export function hits(x: number, y: number, hw: number, hh: number) {
  // pond is an ellipse: a box collider left invisible walls on the grass at its corners
  const px = (x - POND.cx) / (POND.rx - 24 + hw), py = (y - POND.cy - 3) / (POND.ry - 17 + hh);
  if (px * px + py * py < 1) return true;
  return OBSTACLES.some((o) => x + hw > o.x && x - hw < o.x + o.w && y + hh > o.y && y - hh < o.y + o.h);
}

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function loadTileset() {
  const im = new Image();
  im.src = TILESET;
  return im.decode().then(() => im);
}

const sx = (i: number) => (i % 12) * PX;
const sy = (i: number) => Math.floor(i / 12) * PX;

/** Tall tree (2 tiles) with its trunk tile's bottom at (x, y), into a context already in world units. */
export function drawTree(g: CanvasRenderingContext2D, tiles: HTMLImageElement, x: number, y: number, green: boolean) {
  const [top, bot] = green ? [4, 16] : [3, 15];
  g.drawImage(tiles, sx(top), sy(top), PX, PX, x - TILE / 2, y - 2 * TILE, TILE, TILE);
  g.drawImage(tiles, sx(bot), sy(bot), PX, PX, x - TILE / 2, y - TILE, TILE, TILE);
}

/** Water bounds for the live shimmer overlay. */
export const WATER = POND;

/** Renders the static map once at sheet resolution (1 tile = 16 px). Upscale ×P with smoothing off. */
export function renderMap(tiles: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = COLS * PX;
  c.height = ROWS * PX;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  const rnd = rng(7);
  const put = (i: number, col: number, row: number) => g.drawImage(tiles, sx(i), sy(i), PX, PX, col * PX, row * PX, PX, PX);
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    g.fillStyle = color;
    g.fillRect(Math.round(x / P), Math.round(y / P), Math.max(1, Math.round(w / P)), Math.max(1, Math.round(h / P)));
  };
  const ellipse = (cx: number, cy: number, rx: number, ry: number, color: string) => {
    g.fillStyle = color;
    for (let py = Math.round((cy - ry) / P); py <= Math.round((cy + ry) / P); py++) {
      const dy = (py * P - cy) / ry;
      if (Math.abs(dy) > 1) continue;
      const half = (rx * Math.sqrt(1 - dy * dy)) / P;
      g.fillRect(Math.round(cx / P - half), py, Math.round(half * 2), 1);
    }
  };

  // grass with variants
  for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) put(rnd() < 0.72 ? 0 : rnd() < 0.75 ? 1 : 2, col, r);

  // dirt (autotiled): yard floor + paths
  const dirt = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const fill = (c0: number, r0: number, w: number, h: number) => {
    for (let r = r0; r < r0 + h; r++) for (let col = c0; col < c0 + w; col++) dirt[r][col] = true;
  };
  fill(YARD.c + 1, YARD.r + 1, YARD.w - 2, YARD.h - 1);
  fill(B, PATH_R, COLS - 2 * B, 2);
  fill(GATE.c, yb, GATE.w, PATH_R - yb);
  fill(GAZEBO.c + 1, GAZEBO.r + 3, 2, PATH_R - GAZEBO.r - 3);
  fill(31, Math.ceil((POND.cy + POND.ry) / TILE), 2, PATH_R - Math.ceil((POND.cy + POND.ry) / TILE));
  const D = (col: number, r: number) => dirt[r]?.[col] ?? false;
  for (let r = 0; r < ROWS; r++)
    for (let col = 0; col < COLS; col++) {
      if (!dirt[r][col]) continue;
      const n = D(col, r - 1), s = D(col, r + 1), w = D(col - 1, r), e = D(col + 1, r);
      const row = !n ? 0 : !s ? 2 : 1;
      const cl = !w ? 0 : !e ? 2 : 1;
      put([12, 24, 36][row] + cl, col, r);
    }

  // forest border (9-slice from the forest block 6..32, centre 19)
  for (let r = 0; r < ROWS; r++)
    for (let col = 0; col < COLS; col++) {
      const inBand = r < B || r >= ROWS - B || col < B || col >= COLS - B;
      if (!inBand) continue;
      let t = 19;
      if (r === B - 1 && col >= B - 1 && col <= COLS - B) t = 31;
      if (r === ROWS - B && col >= B - 1 && col <= COLS - B) t = 7;
      if (col === B - 1 && r >= B && r < ROWS - B) t = 20;
      if (col === COLS - B && r >= B && r < ROWS - B) t = 18;
      put(t, col, r);
    }

  // flower patches + sprouts/mushrooms
  for (const [col, r] of FLOWERS) {
    put(2, col, r);
    put(2, col + 1, r);
    put(rnd() < 0.5 ? 17 : 29, col, r + 1);
  }

  // shelter fence (9-slice 44..70, gate = gap with end posts)
  for (let col = YARD.c; col < YARD.c + YARD.w; col++) {
    const first = col === YARD.c, last = col === YARD.c + YARD.w - 1;
    put(first ? 44 : last ? 46 : 45, col, YARD.r);
    if (col >= GATE.c && col < GATE.c + GATE.w) continue;
    put(first ? 68 : last ? 70 : col === GATE.c - 1 ? 82 : col === GATE.c + GATE.w ? 80 : 45, col, yb);
  }
  for (let r = YARD.r + 1; r < yb; r++) {
    put(56, YARD.c, r);
    put(58, YARD.c + YARD.w - 1, r);
  }
  put(83, GATE.c + 2, yb + 1); // signpost by the gate
  // shelter house (grey roof, stone wall, door)
  [[48, 49, 50], [60, 63, 62], [76, 78, 79]].forEach((row, r) => row.forEach((t, k) => put(t, HOUSE.c + k, HOUSE.r + r)));

  // pond, hand-drawn in the sheet's palette (Tiny Town has no water tiles)
  ellipse(POND.cx, POND.cy + 6, POND.rx + 9, POND.ry + 9, "#3e2731");
  ellipse(POND.cx, POND.cy + 3, POND.rx + 3, POND.ry + 3, "#d39a5b");
  ellipse(POND.cx, POND.cy, POND.rx - 6, POND.ry - 6, "#3e8ec7");
  ellipse(POND.cx - 18, POND.cy - 12, POND.rx * 0.7, POND.ry * 0.55, "#58a8dd");
  for (const [dx, dy] of [[-120, 40], [90, -50], [150, 40]]) {
    ellipse(POND.cx + dx, POND.cy + dy, 18, 11, "#3e2731");
    ellipse(POND.cx + dx, POND.cy + dy - 2, 15, 8, "#64b964");
    px(POND.cx + dx + 3, POND.cy + dy - 9, 6, 6, "#f2a0c0");
  }

  // gantangan: red roof on posts with hanging cages over a stone floor
  for (let k = 0; k < 3; k++) put(43, GAZEBO.c + k, GAZEBO.r + 2);
  [[52, 53, 54], [64, 67, 66]].forEach((row, r) => row.forEach((t, k) => put(t, GAZEBO.c + k, GAZEBO.r + r)));
  const gx = GAZEBO.c * TILE, gy = (GAZEBO.r + 2) * TILE;
  for (const x of [gx + 3, gx + 3 * TILE - 12]) {
    px(x - 3, gy, 12, TILE + 6, "#3e2731");
    px(x, gy, 6, TILE, "#b86f50");
  }
  for (let i = 0; i < 3; i++) {
    const x = gx + 24 + i * 36;
    px(x + 9, gy, 3, 9, "#3e2731");
    px(x, gy + 9, 21, 24, "#3e2731");
    px(x + 3, gy + 12, 15, 18, "#f2e3c2");
    for (let b = 0; b < 3; b++) px(x + 6 + b * 4, gy + 12, 1.5, 18, "#b86f50");
    px(x + 6, gy + 18, 9, 6, ["#F4C430", "#4FA35A", "#7D8238"][i]);
  }

  // TAMAN KICAU board (text drawn live for crispness)
  const bx = SIGN.c * TILE, by = SIGN.r * TILE;
  px(bx + 24, by + 30, 9, TILE - 18, "#3e2731");
  px(bx + SIGN.w * TILE - 33, by + 30, 9, TILE - 18, "#3e2731");
  px(bx + 3, by + 3, SIGN.w * TILE - 6, 33, "#3e2731");
  px(bx + 6, by + 6, SIGN.w * TILE - 12, 27, "#e3b26a");
  px(bx + 6, by + 27, SIGN.w * TILE - 12, 6, "#b86f50");

  // bushes, decor props, tree shadows
  for (const [col, r] of BUSHES) put(5, col, r);
  for (const [t, col, r] of DECOR) put(t, col, r);
  g.globalAlpha = 0.28;
  for (const t of TREES) ellipse(t.x + 4, t.y - 3, 22, 7, "#1e2a1f");
  g.globalAlpha = 1;
  return c;
}

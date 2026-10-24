// Off-chain content per speciesId. Price, supply and game stats live in the contract.
// IUCN statuses: verify at iucnredlist.org before the demo.

export type BirdInfo = {
  name: string;
  latin: string;
  iucn: "LC" | "NT" | "VU" | "EN" | "CR";
  rarity: "Common" | "Rare" | "Epic" | "Legendary";
  description: string;
  colors: { body: string; belly: string; head: string; wing: string; beak: string; tail: string };
  // Chirp synth pattern: [startHz, endHz, durationSec] per note.
  song: [number, number, number][];
};

export const BIRDS: BirdInfo[] = [
  {
    name: "Kenari",
    latin: "Serinus canaria",
    iucn: "LC",
    rarity: "Common",
    description:
      "Si kuning mungil yang jadi pintu masuk banyak kicau mania. Lagunya bergulung panjang dan riang. Di game: hitbox kecil, mudah menyelip di celah sempit.",
    colors: { body: "#F4C430", belly: "#FBE38A", head: "#F4C430", wing: "#D9A21B", beak: "#E9895B", tail: "#D9A21B" },
    song: [[2600, 3400, 0.08], [3400, 2800, 0.08], [2800, 3600, 0.08], [3600, 3000, 0.12]],
  },
  {
    name: "Lovebird",
    latin: "Agapornis fischeri",
    iucn: "NT",
    rarity: "Common",
    description:
      "Burung cinta asal Afrika Timur dengan wajah jingga menyala. Populasi liarnya menurun akibat perdagangan. Di game: jatuh lebih pelan, kepakan lembut.",
    colors: { body: "#4FA35A", belly: "#9BD07A", head: "#FF7A3D", wing: "#2F7D3E", beak: "#D7263D", tail: "#3A6EA5" },
    song: [[3800, 4200, 0.05], [4200, 3600, 0.05], [3900, 4400, 0.06]],
  },
  {
    name: "Murai Batu",
    latin: "Copsychus malabaricus",
    iucn: "LC",
    rarity: "Rare",
    description:
      "Raja gantangan dengan ekor panjang dan suara variatif. Status global LC, tapi populasi liar di Sumatra dan Kalimantan terkuras perburuan. Di game: kepakan paling kuat, tapi berat.",
    colors: { body: "#1E1E24", belly: "#B5532A", head: "#1E1E24", wing: "#2A2A33", beak: "#111111", tail: "#1E1E24" },
    song: [[1800, 2600, 0.12], [2600, 1600, 0.1], [2200, 3200, 0.14], [3200, 2000, 0.18]],
  },
  {
    name: "Cucak Rawa",
    latin: "Pycnonotus zeylanicus",
    iucn: "CR",
    rarity: "Epic",
    description:
      "Cucak rawa, pemilik suara bariton paling dicari. Kini kritis di alam karena permintaan pasar burung. Di game: kepakan kuat, tapi badan besar.",
    colors: { body: "#7D8238", belly: "#C7C27A", head: "#E9D27C", wing: "#5E6229", beak: "#2B2B2B", tail: "#5E6229" },
    song: [[900, 1400, 0.16], [1400, 1100, 0.14], [1200, 1700, 0.2]],
  },
  {
    name: "Jalak Bali",
    latin: "Leucopsar rothschildi",
    iucn: "CR",
    rarity: "Legendary",
    description:
      "Jalak Bali, satu-satunya burung endemik Bali, putih bersih dengan topeng biru. Sempat tersisa belasan ekor di alam liar. Di game: paling seimbang.",
    colors: { body: "#F5F5F0", belly: "#FFFFFF", head: "#F5F5F0", wing: "#E6E6DE", beak: "#9C8E6B", tail: "#1E1E24" },
    song: [[2000, 2800, 0.1], [2800, 2400, 0.08], [2400, 3000, 0.1], [3000, 2200, 0.14]],
  },
];

export const IUCN_LABEL: Record<BirdInfo["iucn"], string> = {
  LC: "Least Concern",
  NT: "Near Threatened",
  VU: "Vulnerable",
  EN: "Endangered",
  CR: "Critically Endangered",
};

// ---- Pixel-art renderer: 48x36 grid, no black outline. Each area has 4 flat tones
// (highlight, base, shade, deep); silhouette edges use the area's own deep tone. ----

const hex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
const ch = (s: string, i: number) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);
function mix(a: string, b: string, t: number) {
  return `#${[0, 1, 2].map((i) => hex(ch(a, i) + (ch(b, i) - ch(a, i)) * t)).join("")}`;
}
/** 4 muted tones from one base colour. Dark bases get a cool lift so black birds still read. */
function tones(base: string): string[] {
  const lum = 0.3 * ch(base, 0) + 0.59 * ch(base, 1) + 0.11 * ch(base, 2);
  const g = hex(lum);
  const c = mix(base, `#${g}${g}${g}`, 0.15);
  if (lum < 60) return [mix(c, "#7d8aa3", 0.55), mix(c, "#5a6478", 0.3), c, mix(c, "#000000", 0.45)];
  return [mix(c, "#fffbe8", 0.32), c, mix(c, "#1a1420", 0.25), mix(c, "#1a1420", 0.52)];
}

/** SVG markup for a species. Used by the UI, the game canvas and NFT metadata.
 *  `colors` renders a registered bird: same template (plain Kenari shape), palette taken from its photo. */
export function birdSvg(speciesId: number, wingUp = false, colors?: BirdInfo["colors"]): string {
  const id = colors ? 0 : BIRDS[speciesId] ? speciesId : 0;
  const c = colors ?? BIRDS[id].colors;
  const P: Record<string, string[]> = {
    H: tones(c.head), B: tones(c.body), L: tones(c.belly), W: tones(c.wing), T: tones(c.tail),
    K: tones(c.beak),
    F: id === 2 || id === 4 ? ["#a08a74", "#8a7360", "#6e5a4a", "#55453a"] : ["#e59a9a", "#cf6f78", "#a8505c", "#7e3a46"],
    X: tones("#26262c"), // Jalak Bali black tips
    Z: ["#ffffff", "#ece8dd", "#d4cfc2", "#b8b2a4"], // Murai Batu white tail edge
    V: tones("#e3c34a"), // Cucak Rawa yellow vent
    M: tones("#3d7fc4"), // Jalak Bali bare blue skin
    S: tones("#2b2b2b"), // Cucak Rawa moustache stripe
    E: ["#f4f1e6", "#141414", "#141414", "#141414"],
  };
  const GW = 48, GH = 36;
  const A: string[][] = Array.from({ length: GH }, () => Array(GW).fill(""));
  const T: number[][] = Array.from({ length: GH }, () => Array(GW).fill(1));
  const set = (x: number, y: number, a: string, t: number) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && x < GW && y >= 0 && y < GH) {
      A[y][x] = a;
      T[y][x] = t;
    }
  };
  const ellipse = (cx: number, cy: number, rx: number, ry: number, f: (dx: number, dy: number) => [string, number]) => {
    for (let y = 0; y < GH; y++)
      for (let x = 0; x < GW; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) set(x, y, ...f(dx, dy));
      }
  };
  const tipArea = (k: number, len: number) => (id === 4 && k > len - 5 ? "X" : "W");

  // tail: bundle of 3 tapered feathers trailing down-left, ragged tips (Murai Batu: very long, white edge)
  const longTail = id === 2;
  const L = longTail ? 24 : 13, slope = longTail ? 0.42 : 0.55;
  [2, 0, 3].forEach((cut, i) => {
    const len = L - cut;
    for (let k = 0; k < len; k++) {
      const x = 15 - k, yc = 21 + k * slope + (i - 1) * 1.7;
      const area = id === 4 && k > len - 6 ? "X" : "T";
      set(x, yc, area, i);
      if (k < len - 3) set(x, yc + 1, longTail && i === 2 ? "Z" : area, i + 1);
    }
  });

  // raised wing: solid fan of 6 feathers from the shoulder, drawn behind the body
  if (wingUp) {
    const ox = 26, oy = 16, LEN = [14, 16, 16, 15, 13, 11];
    for (let y = 0; y < GH; y++)
      for (let x = 0; x < GW; x++) {
        const vx = x + 0.5 - ox, vy = y + 0.5 - oy;
        const r = Math.hypot(vx, vy), th = (Math.atan2(-vy, -vx) * 180) / Math.PI; // 0 = pointing back, 90 = up
        if (th < 14 || th >= 98) continue;
        const f = (th - 14) / 14, i = Math.floor(f), fr = f - i;
        const len = LEN[i] - (fr < 0.4 ? 1 : 0); // ragged stepped tips
        if (r > len) continue;
        const tone = r < 6 ? (fr > 0.5 ? 0 : 1) : fr > 0.75 ? 0 : fr < 0.18 ? 3 : r > len - 3 ? 2 : 1;
        set(x, y, tipArea(r, len), tone);
      }
  }

  // body + belly (+ Cucak Rawa yellow vent)
  ellipse(25, 20, 12.5, 7, (dx, dy) => {
    if (id === 3 && dy > 0.35 && dx < -0.35) return ["V", dy > 0.75 ? 2 : 1];
    if (dy > 0.05 && dx > -0.4) return ["L", dy > 0.72 ? 2 : dy < 0.25 ? 0 : 1];
    return ["B", dy < -0.55 ? 0 : dy > 0.5 ? 2 : 1];
  });
  // head
  ellipse(36.5, 12.5, 6.3, 6, (dx, dy) => ["H", dy < -0.45 || (dx < -0.3 && dy < -0.1) ? 0 : dy > 0.5 ? 2 : 1]);
  if (id === 3) {
    // swept-back crest + dark moustache stripe
    ([[7, 31, 36], [6, 30, 35], [5, 29, 33], [4, 29, 31], [3, 29, 29]] as const).forEach(([y, x0, x1]) => {
      for (let x = x0; x <= x1; x++) set(x, y, "H", x > x1 - 2 ? 1 : 0);
    });
    for (let x = 35; x <= 39; x++) set(x, 15, "S", 1);
  }
  if (id === 4) ellipse(39, 11.5, 3.2, 2.2, (_dx, dy) => ["M", dy < -0.3 ? 0 : 1]);

  // folded wing: 4 layered feather rows slanting down-back (light top, mid, deep bottom), stepped tips
  if (!wingUp) {
    ([[14, 31, 18], [16, 31, 14], [18, 29, 10], [20, 26, 7]] as const).forEach(([y0, x1, x0]) => {
      for (let x = x0; x <= x1; x++) {
        const a = tipArea(x1 - x, x1 - x0 + 1), y = y0 + Math.floor((x1 - x) / 6);
        if (x >= x0 + 2) set(x, y, a, 0);
        set(x, y + 1, a, 1);
        if (x >= x0 + 1) set(x, y + 2, a, 3);
      }
    });
  } else {
    for (let x = 22; x <= 30; x++) {
      set(x, 15, "W", 0);
      set(x, 16, "W", 1);
    }
  }

  // silhouette edge = the area's own deep tone (done before eye/beak/legs so those stay crisp)
  const empty = (x: number, y: number) => !A[y]?.[x];
  const edge: [number, number][] = [];
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++)
      if (A[y][x] && (empty(x - 1, y) || empty(x + 1, y) || empty(x, y - 1) || empty(x, y + 1))) edge.push([x, y]);
  edge.forEach(([x, y]) => (T[y][x] = 3));

  // eye: dark dash + one light pixel
  set(39, 11, "E", 1);
  set(40, 11, "E", 1);
  set(39, 10, "E", 0);
  // long thin beak with lighter tip
  for (let x = 42; x <= 47; x++) set(x, 12, "K", x >= 46 ? 0 : 1);
  for (let x = 42; x <= 44; x++) set(x, 13, "K", 2);
  // legs: 2px wide, toes as a short line
  for (const lx of [24, 29]) {
    for (let y = 27; y <= 30; y++) {
      set(lx, y, "F", 1);
      set(lx + 1, y, "F", 2);
    }
    for (let x = lx - 1; x <= lx + 3; x++) set(x, 31, "F", 0);
  }

  // one <rect> per horizontal run of equal colour
  let rects = "";
  const color = (x: number, y: number) => (A[y][x] ? P[A[y][x]][T[y][x]] : "");
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; ) {
      const fill = color(x, y);
      let n = 1;
      while (fill && x + n < GW && color(x + n, y) === fill) n++;
      if (fill) rects += `<rect x="${x}" y="${y}" width="${n}" height="1" fill="${fill}"/>`;
      x += n;
    }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GW} ${GH}" shape-rendering="crispEdges">${rects}</svg>`;
}

export const birdDataUri = (speciesId: number, wingUp = false, colors?: BirdInfo["colors"]) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(birdSvg(speciesId, wingUp, colors))}`;

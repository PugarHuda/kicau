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

/** SVG markup for a species. Used by the UI, the game canvas and NFT metadata. */
export function birdSvg(speciesId: number): string {
  const b = BIRDS[speciesId] ?? BIRDS[0];
  const c = b.colors;
  const longTail = speciesId === 2;
  const mask = speciesId === 4 ? `<circle cx="78" cy="38" r="9" fill="#2E7DD7"/>` : "";
  const crest = speciesId === 3 ? `<path d="M64 22 L72 10 L76 24 Z" fill="${c.head}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100">
<path d="${longTail ? "M30 58 L-2 70 L2 78 L34 66 Z" : "M30 58 L10 66 L14 74 L34 66 Z"}" fill="${c.tail}"/>
<ellipse cx="54" cy="58" rx="30" ry="22" fill="${c.body}"/>
<ellipse cx="60" cy="66" rx="20" ry="13" fill="${c.belly}"/>
<path d="M36 52 Q52 36 66 54 Q52 64 36 52 Z" fill="${c.wing}"/>
${crest}
<circle cx="76" cy="38" r="16" fill="${c.head}"/>
${mask}
<circle cx="80" cy="36" r="4" fill="#fff"/><circle cx="81" cy="36" r="2.2" fill="#111"/>
<path d="M90 38 L104 42 L90 46 Z" fill="${c.beak}"/>
<path d="M48 78 L46 88 M60 78 L60 88" stroke="#8A6A3B" stroke-width="3" stroke-linecap="round"/>
</svg>`;
}

export const birdDataUri = (speciesId: number) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(birdSvg(speciesId))}`;

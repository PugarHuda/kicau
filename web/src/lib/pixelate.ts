// Photo of a real bird → its colour palette, so it can be drawn with the same pixel template as every species.
// ponytail: heuristic background removal (flood fill from the border) + tiny k-means. Works best on plain
// backgrounds; an AI segmentation model is the upgrade path.
import type { BirdInfo } from "./birds";

export type BirdColors = BirdInfo["colors"];

const W = 48;
const H = 40;

export const DEFAULT_TOLERANCE = 60;

type RGB = { r: number; g: number; b: number };
type Px = RGB & { y: number };

export async function extractBirdColors(file: Blob, bgTolerance = DEFAULT_TOLERANCE): Promise<BirdColors> {
  const px = await cutout(file, bgTolerance);
  if (px.length < 40) throw new Error("No bird detected. Try a photo with a plain background or adjust the slider.");

  const lum = (p: { r: number; g: number; b: number }) => 0.3 * p.r + 0.59 * p.g + 0.11 * p.b;
  const clusters = kmeans(px, 4);
  const byCount = [...clusters].sort((a, b) => b.n - a.n);
  const byLum = [...clusters].filter((c) => c.n >= px.length * 0.06).sort((a, b) => lum(a) - lum(b));

  const body = byCount[0];
  const belly = byLum.at(-1)!;
  const tail = byLum[0];
  // head = cluster most common in the top 30% of the bird
  const minY = Math.min(...px.map((p) => p.y));
  const maxY = Math.max(...px.map((p) => p.y));
  const top = px.filter((p) => p.y <= minY + (maxY - minY) * 0.3);
  const headCounts = clusters.map((c) => top.filter((p) => nearest(clusters, p) === c).length);
  const head = clusters[headCounts.indexOf(Math.max(...headCounts))];

  const hexOf = (c: { r: number; g: number; b: number }) => `#${[c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
  const mixC = (a: RGB, b: RGB, t: number) => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });
  const dark = lum(tail) < 70;

  return {
    body: hexOf(body),
    belly: hexOf(belly === body ? mixC(body, { r: 255, g: 250, b: 235 }, 0.35) : belly),
    head: hexOf(head),
    wing: hexOf(mixC(body, tail, 0.45)),
    tail: hexOf(tail === body ? mixC(body, { r: 20, g: 20, b: 30 }, 0.35) : tail),
    beak: dark ? "#d9a441" : "#2b2b2b",
  };
}

/** Bird pixels (background flood-filled away) at sprite resolution. */
async function cutout(file: Blob, bgTolerance: number): Promise<Px[]> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d", { willReadFrequently: true })!;
  g.imageSmoothingQuality = "high";
  const scale = Math.max(W / bitmap.width, H / bitmap.height);
  g.drawImage(bitmap, (W - bitmap.width * scale) / 2, (H - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
  const d = g.getImageData(0, 0, W, H).data;

  const border: [number, number][] = [];
  for (let x = 0; x < W; x++) border.push([x, 0], [x, H - 1]);
  for (let y = 0; y < H; y++) border.push([0, y], [W - 1, y]);
  const bg = [0, 0, 0];
  for (const [x, y] of border) for (let c = 0; c < 3; c++) bg[c] += d[(y * W + x) * 4 + c] / border.length;
  const isBg = (i: number) => Math.hypot(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]) < bgTolerance;

  const removed = new Uint8Array(W * H);
  const seen = new Uint8Array(W * H);
  const stack = [...border];
  while (stack.length) {
    const [x, y] = stack.pop()!;
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const k = y * W + x;
    if (seen[k]) continue;
    seen[k] = 1;
    if (!isBg(k * 4)) continue;
    removed[k] = 1;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  const out: Px[] = [];
  for (let k = 0; k < W * H; k++) if (!removed[k]) out.push({ r: d[k * 4], g: d[k * 4 + 1], b: d[k * 4 + 2], y: Math.floor(k / W) });
  return out;
}

type Cluster = { r: number; g: number; b: number; n: number };

function nearest(cs: Cluster[], p: Px) {
  let best = cs[0], bd = Infinity;
  for (const c of cs) {
    const dd = (c.r - p.r) ** 2 + (c.g - p.g) ** 2 + (c.b - p.b) ** 2;
    if (dd < bd) (bd = dd), (best = c);
  }
  return best;
}

function kmeans(px: Px[], k: number): Cluster[] {
  // init from luminance quantiles so results are deterministic
  const sorted = [...px].sort((a, b) => a.r + a.g + a.b - (b.r + b.g + b.b));
  let cs: Cluster[] = Array.from({ length: k }, (_, i) => ({ ...sorted[Math.floor(((i + 0.5) / k) * sorted.length)], n: 0 }));
  for (let it = 0; it < 8; it++) {
    const acc = cs.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
    for (const p of px) {
      const a = acc[cs.indexOf(nearest(cs, p))];
      a.r += p.r, a.g += p.g, a.b += p.b, a.n++;
    }
    cs = acc.map((a, i) => (a.n ? { r: a.r / a.n, g: a.g / a.n, b: a.b / a.n, n: a.n } : { ...cs[i], n: 0 }));
  }
  return cs;
}

// ---- on-chain encoding (lives in the BirdRegistered event) ----
// v1: "KC" 0x01 + six RGB colours (21 bytes). v2: same palette + UTF-8 JSON profile (pedigree & story).

const ORDER = ["head", "body", "belly", "wing", "tail", "beak"] as const;

export type CertificateType = "breeder_ring" | "bksda_permit" | "contest_certificate" | "other";
export type Certificate = { type: CertificateType; issuer: string; number: string; date: string; note?: string; docHash?: string /* SHA-256 hex of the document; the file itself is never uploaded */ };

/** Organizer attestation title that verifies a certificate (fits the contract's 64-byte title limit). */
export const certAttestTitle = (c: Pick<Certificate, "type" | "number">) => `CERT:${c.type}:${c.number.trim()}`.slice(0, 64);

export async function sha256Hex(file: Blob) {
  const d = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export type Parent = { name?: string; ring?: string };
export type Lineage = { sire?: Parent; dam?: Parent; breeder?: string; breederRing?: string };
export type Win = { event: string; organizer?: string; class?: string; rank?: string; date?: string; location?: string };

export const CERT_LABELS: Record<CertificateType, string> = {
  breeder_ring: "Breeder ring",
  bksda_permit: "BKSDA / captive-breeding permit",
  contest_certificate: "Contest certificate",
  other: "Other",
};

// All claims below are self-declared by the owner. Verified facts come from organizer attestations and on-chain contest results.
export type BirdProfile = {
  owner?: string; // owner's display name; the address comes from ownerOf()
  story?: string;
  species?: string; // AI-identified (or owner-corrected) Indonesian name, e.g. "Murai Batu"
  latin?: string;
  aiConfidence?: number; // 0..1
  speciesSource?: "ai" | "owner";
  certificates?: Certificate[];
  lineage?: Lineage | string; // string = legacy v2 free text
  wins?: Win[];
  // legacy v2 fields (still decoded and shown)
  titles?: string[];
  certificate?: string;
};

/** Drops empty strings / arrays / objects recursively so the on-chain JSON stays small. */
function prune(v: unknown): unknown {
  if (typeof v === "string") return v.trim() ? v.trim() : undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (Array.isArray(v)) {
    const a = v.map(prune).filter((x) => x !== undefined);
    return a.length ? a : undefined;
  }
  if (v && typeof v === "object") {
    const o = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, prune(x)]).filter(([, x]) => x !== undefined));
    return Object.keys(o).length ? o : undefined;
  }
  return undefined;
}

/** Rows that only carry a type/default are not real claims. */
export function cleanProfile(p: BirdProfile): BirdProfile {
  return {
    ...p,
    certificates: p.certificates?.filter((c) => c.issuer?.trim() || c.number?.trim()),
    wins: p.wins?.filter((w) => w.event?.trim()),
  };
}

export function encodeBird(c: BirdColors, profile: BirdProfile = {}): Uint8Array {
  const clean = (prune(cleanProfile(profile)) ?? {}) as Record<string, unknown>;
  const json = Object.keys(clean).length ? new TextEncoder().encode(JSON.stringify(clean)) : new Uint8Array();
  const out = new Uint8Array(21 + json.length);
  out.set([0x4b, 0x43, json.length ? 0x02 : 0x01]);
  ORDER.forEach((key, i) => {
    for (let j = 0; j < 3; j++) out[3 + i * 3 + j] = parseInt(c[key].slice(1 + j * 2, 3 + j * 2), 16);
  });
  out.set(json, 21);
  return out;
}

export type DecodedBird = { colors: BirdColors; profile: BirdProfile } | { png: string; profile: BirdProfile };

const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const rec = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined);
const recs = (v: unknown) => (Array.isArray(v) ? v.map(rec).filter((x): x is Record<string, unknown> => !!x) : undefined);
const parent = (v: unknown): Parent | undefined => {
  const o = rec(v);
  return o && { name: str(o.name), ring: str(o.ring) };
};

/**
 * The profile JSON is written by anyone who pays registerFee, so coerce it to the declared shape once here.
 * Without this, `null`, `{"owner":{}}` or `{"certificates":[null]}` crash every page, the metadata route and the
 * (already paid) certificate render. Well-formed profiles come out unchanged.
 */
export function sanitizeProfile(raw: unknown): BirdProfile {
  const p = rec(raw);
  if (!p) return {};
  const lin = rec(p.lineage);
  const conf = p.aiConfidence;
  return {
    owner: str(p.owner),
    story: str(p.story),
    species: str(p.species),
    latin: str(p.latin),
    aiConfidence: typeof conf === "number" && Number.isFinite(conf) ? conf : undefined,
    speciesSource: p.speciesSource === "ai" || p.speciesSource === "owner" ? p.speciesSource : undefined,
    certificates: recs(p.certificates)?.map((c) => ({
      type: typeof c.type === "string" && Object.keys(CERT_LABELS).includes(c.type) ? (c.type as CertificateType) : "other",
      issuer: str(c.issuer) ?? "",
      number: str(c.number) ?? "",
      date: str(c.date) ?? "",
      note: str(c.note),
      docHash: str(c.docHash),
    })),
    lineage:
      typeof p.lineage === "string"
        ? p.lineage
        : lin && { sire: parent(lin.sire), dam: parent(lin.dam), breeder: str(lin.breeder), breederRing: str(lin.breederRing) },
    wins: recs(p.wins)?.map((w) => ({
      event: str(w.event) ?? "",
      organizer: str(w.organizer),
      class: str(w.class),
      rank: typeof w.rank === "number" && Number.isFinite(w.rank) ? String(w.rank) : str(w.rank),
      date: str(w.date),
      location: str(w.location),
    })),
    titles: Array.isArray(p.titles) ? p.titles.filter((t): t is string => typeof t === "string") : undefined,
    certificate: str(p.certificate),
  };
}

/** Decodes a registered bird's on-chain bytes: palette (+profile) or a legacy PNG sprite. */
export function decodeBirdImage(bytes: Uint8Array): DecodedBird | null {
  if (bytes.length >= 21 && bytes[0] === 0x4b && bytes[1] === 0x43 && (bytes[2] === 0x01 || bytes[2] === 0x02)) {
    const hex = (i: number) => `#${[0, 1, 2].map((j) => bytes[3 + i * 3 + j].toString(16).padStart(2, "0")).join("")}`;
    const colors = Object.fromEntries(ORDER.map((k, i) => [k, hex(i)])) as BirdColors;
    let profile: BirdProfile = {};
    if (bytes[2] === 0x02) {
      try {
        profile = sanitizeProfile(JSON.parse(new TextDecoder().decode(bytes.slice(21))));
      } catch {
        // malformed profile: still show the bird
      }
    }
    return { colors, profile };
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return { png: bytesToDataUrl(bytes), profile: {} };
  return null;
}

export function bytesToDataUrl(bytes: Uint8Array) {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return `data:image/png;base64,${btoa(bin)}`;
}

/** One-line lineage for text outputs (certificate image, NFT metadata). */
export function lineageText(l: BirdProfile["lineage"]): string {
  if (typeof l === "string") return l;
  if (!l || typeof l !== "object") return "";
  const par = (x?: Parent) => [x?.name, x?.ring && `ring ${x.ring}`].filter(Boolean).join(" ");
  const parents = l.sire || l.dam ? `${par(l.sire) || "?"} × ${par(l.dam) || "?"}` : "";
  return [parents, l.breeder && `breeder ${l.breeder}`, l.breederRing && `code ${l.breederRing}`].filter(Boolean).join(" · ");
}

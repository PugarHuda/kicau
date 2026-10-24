// Photo of a real bird → small pixel-art sprite (PNG bytes), entirely in the browser.
// ponytail: heuristic background removal (flood fill from the border). Works best on plain backgrounds;
// an AI segmentation/pixel-art model is the upgrade path.

export const SPRITE_W = 48;
export const SPRITE_H = 40;

export type PixelOptions = {
  bgTolerance: number; // 0..255, how close to the border color counts as background
  levels: number; // colors per channel after posterize (fewer = more retro)
};

export const DEFAULT_PIXEL: PixelOptions = { bgTolerance: 60, levels: 6 };

export async function pixelateBird(file: Blob, opts: PixelOptions = DEFAULT_PIXEL) {
  const bitmap = await createImageBitmap(file);

  // 1. Cover-crop to the sprite aspect, downsample in two steps for a cleaner average.
  const big = document.createElement("canvas");
  big.width = SPRITE_W * 4;
  big.height = SPRITE_H * 4;
  const bg = big.getContext("2d")!;
  bg.imageSmoothingQuality = "high";
  const scale = Math.max(big.width / bitmap.width, big.height / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  bg.drawImage(bitmap, (big.width - w) / 2, (big.height - h) / 2, w, h);

  const out = document.createElement("canvas");
  out.width = SPRITE_W;
  out.height = SPRITE_H;
  const g = out.getContext("2d", { willReadFrequently: true })!;
  g.imageSmoothingQuality = "high";
  g.drawImage(big, 0, 0, SPRITE_W, SPRITE_H);

  const img = g.getImageData(0, 0, SPRITE_W, SPRITE_H);
  const px = img.data;
  const idx = (x: number, y: number) => (y * SPRITE_W + x) * 4;

  // 2. Background = average border color; flood fill from every border pixel that matches it.
  const border: [number, number][] = [];
  for (let x = 0; x < SPRITE_W; x++) border.push([x, 0], [x, SPRITE_H - 1]);
  for (let y = 0; y < SPRITE_H; y++) border.push([0, y], [SPRITE_W - 1, y]);
  const bgc = [0, 0, 0];
  for (const [x, y] of border) for (let c = 0; c < 3; c++) bgc[c] += px[idx(x, y) + c] / border.length;
  const isBg = (i: number) =>
    Math.hypot(px[i] - bgc[0], px[i + 1] - bgc[1], px[i + 2] - bgc[2]) < opts.bgTolerance;

  const seen = new Uint8Array(SPRITE_W * SPRITE_H);
  const stack = [...border];
  while (stack.length) {
    const [x, y] = stack.pop()!;
    if (x < 0 || y < 0 || x >= SPRITE_W || y >= SPRITE_H) continue;
    const k = y * SPRITE_W + x;
    if (seen[k]) continue;
    seen[k] = 1;
    const i = k * 4;
    if (!isBg(i)) continue;
    px[i + 3] = 0;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  // 3. Posterize remaining pixels for a flat, retro palette; drop semi-transparent edges.
  const step = 255 / (opts.levels - 1);
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) {
      px[i + 3] = 0;
      continue;
    }
    px[i] = Math.round(px[i] / step) * step;
    px[i + 1] = Math.round(px[i + 1] / step) * step;
    px[i + 2] = Math.round(px[i + 2] / step) * step;
    px[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);

  const blob = await new Promise<Blob>((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error("PNG gagal"))), "image/png"));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { bytes, dataUrl: bytesToDataUrl(bytes) };
}

export function bytesToDataUrl(bytes: Uint8Array) {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return `data:image/png;base64,${btoa(bin)}`;
}

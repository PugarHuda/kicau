// Tiny QR encoder: byte mode, ECC level L, versions 1-5 (single RS block), fixed mask 0.
// ponytail: no mask-penalty search and max 106 bytes; enough for a URL. Use a real lib if inputs grow.

const L_TOTAL = [0, 26, 44, 70, 100, 134];
const L_EC = [0, 7, 10, 15, 20, 26];
const ALIGN = [0, 0, 18, 22, 26, 30];

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsRemainder(data: number[], degree: number): number[] {
  const div = new Array<number>(degree).fill(0);
  div[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      div[j] = gfMul(div[j], root);
      if (j + 1 < degree) div[j] ^= div[j + 1];
    }
    root = gfMul(root, 2);
  }
  const res = new Array<number>(degree).fill(0);
  for (const b of data) {
    const f = b ^ (res.shift() as number);
    res.push(0);
    div.forEach((c, i) => (res[i] ^= gfMul(c, f)));
  }
  return res;
}

/** Returns a square matrix, true = dark. */
export function qrMatrix(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));
  let ver = 1;
  while (ver <= 5 && L_TOTAL[ver] - L_EC[ver] < bytes.length + 2) ver++;
  if (ver > 5) throw new Error("qr: text too long");
  const dataLen = L_TOTAL[ver] - L_EC[ver];

  const bits: number[] = [];
  const push = (v: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1);
  };
  push(4, 4);
  push(bytes.length, 8);
  bytes.forEach((b) => push(b, 8));
  push(0, Math.min(4, dataLen * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let p = 0xec; data.length < dataLen; p ^= 0xec ^ 0x11) data.push(p);
  const code = data.concat(rsRemainder(data, L_EC[ver]));

  const size = ver * 4 + 17;
  const m = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, d: boolean) => {
    m[y][x] = d;
    fn[y][x] = true;
  };

  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, d !== 2 && d !== 4);
      }
  }
  if (ALIGN[ver]) {
    const a = ALIGN[ver];
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) set(a + dx, a + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }

  // format info: ECC L (01) + mask 0
  const fdata = (1 << 3) | 0;
  let rem = fdata;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const f = ((fdata << 10) | rem) ^ 0x5412;
  const fb = (i: number) => ((f >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) set(8, i, fb(i));
  set(8, 7, fb(6));
  set(8, 8, fb(7));
  set(7, 8, fb(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, fb(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, fb(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, fb(i));
  set(8, size - 8, true);

  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < size; v++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? size - 1 - v : v;
        if (fn[y][x]) continue;
        const bit = k < code.length * 8 ? ((code[k >>> 3] >>> (7 - (k & 7))) & 1) === 1 : false;
        k++;
        m[y][x] = bit !== ((x + y) % 2 === 0); // mask 0
      }
  }
  return m;
}

export function qrSvgPath(text: string): { size: number; d: string } {
  const m = qrMatrix(text);
  let d = "";
  m.forEach((row, y) =>
    row.forEach((on, x) => {
      if (on) d += `M${x + 4} ${y + 4}h1v1h-1z`;
    }),
  );
  return { size: m.length + 8, d };
}

"use client";

import { useEffect, useRef } from "react";
import { BIRDS, birdDataUri } from "@/lib/birds";
import { chirp } from "@/lib/chirp";
import type { GameOver, GameStart } from "@/lib/game";
import {
  BASE,
  BIRD_X,
  CAP_H,
  CAP_OVERHANG,
  GROUND_Y,
  H,
  W,
  gapSize,
  hitsPipe,
  nextGapY,
  passedPipe,
  pipeSpeed,
} from "./game/physics";

export { pipeSpeed };

const SIM_DT = 1 / 120; // fixed physics step: same feel at 30, 60 or 144 Hz
const DEATH_MIN = 0.6; // s before onGameOver, once the bird has hit the ground
const DEATH_MAX = 1.2; // hard cap
const CHIRP_GAP = 250; // ms, throttle point chirps so they don't stack
const INK = "#1e2a1f";
const CREAM = "#fffdf7";
const SKY = ["#9fd3c7", "#b3dccc", "#c6e5d2", "#d8ecd8", "#e8f0dc", "#f6f1e4"];
const CLOUDS = [
  [40, 70, 0.012],
  [230, 130, 0.008],
  [330, 40, 0.015],
  [140, 210, 0.006],
];
const MAX_P = 64;

type Pipe = { x: number; gapY: number; gap: number; passed: boolean };
type State = "ready" | "playing" | "paused" | "dying" | "over";

/** One seamless W-wide strip, pre-rendered once so each frame is just two drawImage calls. */
function layer(draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = GROUND_Y;
  draw(c.getContext("2d")!);
  return c;
}

const farHills = () =>
  layer((g) => {
    for (let x = 0; x < W; x += 4) {
      // periods divide W so the strip tiles
      const h = 70 + 26 * Math.sin((x / W) * Math.PI * 2) + 14 * Math.sin((x / W) * Math.PI * 6 + 1);
      const top = Math.round((GROUND_Y - h) / 4) * 4;
      g.fillStyle = "#c3e0b6";
      g.fillRect(x, top, 4, 4);
      g.fillStyle = "#b0d4a6";
      g.fillRect(x, top + 4, 4, GROUND_Y - top - 4);
    }
  });

const nearTrees = () =>
  layer((g) => {
    const cell = 4;
    const trees = [
      [30, 26],
      [95, 18],
      [150, 30],
      [230, 22],
      [290, 28],
      [360, 20],
    ];
    for (const [tx, r] of trees) {
      const cy = GROUND_Y - 34 - r;
      g.fillStyle = "#7a6a4a";
      g.fillRect(tx - 4, cy, 8, GROUND_Y - cy); // trunk
      for (let dy = -r; dy <= r; dy += cell)
        for (let dx = -r; dx <= r; dx += cell) {
          if (dx * dx + dy * dy > r * r) continue;
          g.fillStyle = dy < -r / 3 && dx < 0 ? "#9fcb8f" : dy > r / 3 ? "#6f9f69" : "#86b77b";
          for (const wrap of [0, -W, W]) g.fillRect(tx + dx + wrap - cell / 2, cy + dy, cell, cell);
        }
    }
    g.fillStyle = "#86b77b"; // bush strip
    for (let x = 0; x < W; x += 4) {
      const top = GROUND_Y - 12 - Math.round(4 * (1 + Math.sin((x / W) * Math.PI * 10))) * 2;
      g.fillRect(x, top, 4, GROUND_Y - top);
    }
  });

export function FlappyGame({ start, onGameOver }: { start: GameStart; onGameOver: (r: GameOver) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onOverRef = useRef(onGameOver);
  onOverRef.current = onGameOver;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const g = canvas.getContext("2d")!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const single = !!start.spriteUrl && !start.spriteUpUrl; // legacy one-frame sprites fake the flap with a squash
    const img = new Image();
    img.src = start.spriteUrl ?? birdDataUri(start.species);
    const imgUp = single ? img : new Image();
    if (!single) imgUp.src = start.spriteUpUrl ?? birdDataUri(start.species, true);

    // canvas can't read CSS vars in `font`, so resolve next/font's hashed family once
    const family = getComputedStyle(canvas).getPropertyValue("--font-display").trim() || "monospace";
    const FONT_BIG = `32px ${family}`;
    const FONT_MD = `16px ${family}`;
    const FONT_SM = `10px ${family}`;

    const hills = farHills();
    const trees = nearTrees();
    const c = BIRDS[start.species]?.colors;
    const featherCols = c ? [c.body, c.wing, c.belly] : [CREAM, "#d8c7a8", "#8a6a3b"];

    const gravity = BASE.gravity * (start.stats.gravity / 100);
    const flapV = BASE.flap * (start.stats.flapPower / 100);
    const radius = BASE.radius * (start.stats.hitbox / 100);

    const bestKey = `kicau:best:${start.tokenId}`;
    let best = 0;
    try {
      best = Number(localStorage.getItem(bestKey)) || 0;
    } catch {}
    let newBest = false;

    let state: State = "ready";
    let y = H / 2;
    let vy = 0;
    let rot = 0;
    const pipes: Pipe[] = [];
    let lastGapY = GROUND_Y / 2;
    let spawnT = 0;
    let score = 0;
    let scoreStr = "0";
    let playTime = 0;
    let deathT = 0;
    let grounded = false;
    let overSent = false;
    let flapAt = -1e9;
    let lastChirp = -1e9;
    let pop = 0; // score pop, 1 -> 0
    let flash = 0;
    let shake = 0;
    let groundX = 0;
    let hillX = 0;
    let treeX = 0;
    let acc = 0;
    let last = performance.now();
    let raf = 0;

    // feather particle pool (no per-frame allocation)
    const px = new Float32Array(MAX_P);
    const py = new Float32Array(MAX_P);
    const pvx = new Float32Array(MAX_P);
    const pvy = new Float32Array(MAX_P);
    const plife = new Float32Array(MAX_P); // remaining s, 0 = dead
    const pcol = new Uint8Array(MAX_P);
    let pNext = 0;
    const feathers = (n: number, spread: number) => {
      for (let k = 0; k < n; k++) {
        const i = pNext;
        pNext = (pNext + 1) % MAX_P;
        px[i] = BIRD_X - 6 + Math.random() * 12;
        py[i] = y - 4 + Math.random() * 8;
        const a = Math.random() * Math.PI * 2;
        const s = spread * (0.4 + Math.random() * 0.6);
        pvx[i] = Math.cos(a) * s - 60;
        pvy[i] = Math.sin(a) * s - 40;
        plife[i] = 0.5 + Math.random() * 0.5;
        pcol[i] = (Math.random() * featherCols.length) | 0;
      }
    };

    const flap = () => {
      if (state === "dying" || state === "over") return;
      if (state === "ready") state = "playing";
      else if (state === "paused") {
        state = "playing";
        acc = 0;
      }
      vy = -flapV;
      flapAt = performance.now();
      feathers(3, 70);
    };

    const die = () => {
      state = "dying";
      deathT = 0;
      grounded = false;
      vy = y - radius <= 0 ? 0 : -180; // little knock-back hop
      flash = 1;
      shake = reduceMotion ? 0 : 1;
      feathers(16, 220);
      if (score > best) {
        best = score;
        newBest = true;
        try {
          localStorage.setItem(bestKey, String(best));
        } catch {}
      }
    };

    const finish = () => {
      state = "over";
      if (overSent) return;
      overSent = true;
      onOverRef.current({ tokenId: start.tokenId, score, durationMs: Math.round(playTime * 1000) });
    };

    const update = (dt: number, now: number) => {
      for (let i = 0; i < MAX_P; i++) {
        if (plife[i] <= 0) continue;
        plife[i] -= dt;
        pvy[i] += 380 * dt; // feathers fall slowly
        pvx[i] *= 1 - 2 * dt; // air drag
        pvy[i] *= 1 - 2 * dt;
        px[i] += pvx[i] * dt;
        py[i] += pvy[i] * dt;
      }
      pop = Math.max(0, pop - dt / 0.18);
      flash = Math.max(0, flash - dt / 0.25);
      shake = Math.max(0, shake - dt / 0.3);

      let target = Math.max(-0.5, Math.min(1.2, vy / 600));
      if (state === "ready") {
        y = H / 2 + Math.sin(now / 250) * 8;
        target = 0;
      }
      if (state === "ready" || state === "playing") {
        const speed = pipeSpeed(score);
        groundX = (groundX + speed * dt) % 16;
        hillX = (hillX + speed * 0.12 * dt) % W;
        treeX = (treeX + speed * 0.35 * dt) % W;
      }

      if (state === "playing") {
        playTime += dt;
        vy += gravity * dt;
        y += vy * dt;
        const speed = pipeSpeed(score);
        spawnT -= dt;
        if (spawnT <= 0) {
          spawnT = BASE.spawnEvery;
          const gap = gapSize(score);
          lastGapY = nextGapY(lastGapY, gap, score, Math.random());
          pipes.push({ x: W + CAP_OVERHANG, gapY: lastGapY, gap, passed: false });
        }
        let hit = y + radius >= GROUND_Y || y - radius <= 0;
        for (const p of pipes) {
          p.x -= speed * dt;
          if (!p.passed && passedPipe(radius, p.x)) {
            p.passed = true;
            score++;
            scoreStr = String(score);
            pop = 1;
            if (now - lastChirp > CHIRP_GAP) {
              lastChirp = now;
              chirp(start.species, 0.06);
            }
          }
          if (!hit && hitsPipe(y, radius, p.x, p.gapY, p.gap)) hit = true;
        }
        while (pipes.length && pipes[0].x + BASE.pipeW + CAP_OVERHANG < 0) pipes.shift();
        if (hit) {
          if (y - radius < 0) y = radius;
          die();
        }
      } else if (state === "dying") {
        deathT += dt;
        if (!grounded) {
          vy += gravity * 2 * dt; // drop fast so it lands within ~600ms
          y += vy * dt;
          if (y + radius >= GROUND_Y) {
            y = GROUND_Y - radius;
            vy = 0;
            grounded = true;
          }
        }
        target = 1.5;
        if ((grounded && deathT >= DEATH_MIN) || deathT >= DEATH_MAX) finish();
      }
      rot += (target - rot) * Math.min(1, dt * 14); // ease toward the velocity-based angle
    };

    const text = (s: string, x: number, ty: number, font: string, col: string, sh: number) => {
      g.font = font;
      g.fillStyle = INK;
      g.fillText(s, x + sh, ty + sh);
      g.fillStyle = col;
      g.fillText(s, x, ty);
    };

    const column = (x: number, cy: number, w: number, h: number) => {
      if (h <= 0) return;
      g.fillStyle = INK;
      g.fillRect(x, cy, w, h);
      g.fillStyle = "#2f6b3a";
      g.fillRect(x + 3, cy, w - 6, h);
      g.fillStyle = "#5a9a5c";
      g.fillRect(x + 7, cy, 6, h);
      g.fillStyle = "#8cc27a";
      g.fillRect(x + 10, cy, 3, h);
      g.fillStyle = "#24552e";
      g.fillRect(x + w - 13, cy, 10, h);
    };

    const render = (now: number) => {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.imageSmoothingEnabled = false;
      if (shake > 0) {
        const m = 6 * shake;
        g.translate(Math.round((Math.random() * 2 - 1) * m), Math.round((Math.random() * 2 - 1) * m));
      }

      // sky (overdrawn by 8px so a shake never shows a blank edge)
      const bandH = Math.ceil(GROUND_Y / SKY.length / 8) * 8;
      for (let i = 0; i < SKY.length; i++) {
        g.fillStyle = SKY[i];
        g.fillRect(-8, i === 0 ? -8 : i * bandH, W + 16, bandH + (i === 0 ? 8 : 0));
      }

      g.fillStyle = CREAM;
      for (const [cx0, cy, sp] of CLOUDS) {
        const cx = Math.round(((((cx0 - now * sp) % (W + 80)) + W + 80) % (W + 80)) / 4) * 4 - 60;
        g.fillRect(cx + 8, cy, 24, 8);
        g.fillRect(cx, cy + 8, 48, 8);
        g.fillRect(cx + 16, cy - 8, 12, 8);
      }

      const hx = Math.round(hillX);
      g.drawImage(hills, -hx, 0);
      g.drawImage(hills, W - hx, 0);
      const tx = Math.round(treeX);
      g.drawImage(trees, -tx, 0);
      g.drawImage(trees, W - tx, 0);

      for (const p of pipes) {
        const x = Math.round(p.x);
        const top = Math.round(p.gapY - p.gap / 2);
        const bot = Math.round(p.gapY + p.gap / 2);
        const cw = BASE.pipeW + CAP_OVERHANG * 2;
        column(x, -8, BASE.pipeW, top - CAP_H + 8);
        column(x, bot + CAP_H, BASE.pipeW, GROUND_Y - bot - CAP_H);
        column(x - CAP_OVERHANG, top - CAP_H, cw, CAP_H);
        column(x - CAP_OVERHANG, bot, cw, CAP_H);
        g.fillStyle = INK;
        g.fillRect(x - CAP_OVERHANG, top - CAP_H, cw, 3);
        g.fillRect(x - CAP_OVERHANG, top - 3, cw, 3);
        g.fillRect(x - CAP_OVERHANG, bot, cw, 3);
        g.fillRect(x - CAP_OVERHANG, bot + CAP_H - 3, cw, 3);
      }

      // tiled ground that scrolls with the pipes
      const gy = GROUND_Y;
      g.fillStyle = INK;
      g.fillRect(-8, gy, W + 16, 3);
      g.fillStyle = "#5a9a5c";
      g.fillRect(-8, gy + 3, W + 16, 9);
      g.fillStyle = "#8a6a3b";
      g.fillRect(-8, gy + 12, W + 16, H - gy - 4);
      const off = Math.round(groundX);
      g.fillStyle = "#2f6b3a";
      for (let x = -off - 16; x < W + 16; x += 16) g.fillRect(x, gy + 9, 8, 3); // grass teeth
      g.fillStyle = "#6f5430";
      for (let x = -off - 16; x < W + 16; x += 16) {
        g.fillRect(x + 4, gy + 18, 6, 6);
        g.fillRect(x + 12, gy + 30, 6, 6);
      }

      // feathers: 3x2 pixel flecks with a dark underside, flutter by swapping orientation
      for (let i = 0; i < MAX_P; i++) {
        if (plife[i] <= 0) continue;
        g.globalAlpha = Math.min(1, plife[i] * 2);
        const fx = Math.round(px[i]);
        const fy = Math.round(py[i]);
        const flip = ((now / 90 + i) | 0) & 1;
        const fw = flip ? 2 : 3;
        const fh = flip ? 3 : 2;
        g.fillStyle = INK;
        g.fillRect(fx, fy + 1, fw, fh);
        g.fillStyle = featherCols[pcol[i]];
        g.fillRect(fx, fy, fw, fh);
      }
      g.globalAlpha = 1;

      // bird: wing-up frame for ~120ms after a flap; single-frame sprites squash instead
      const flapping = now - flapAt < 120 && state === "playing";
      const frame = flapping && !single ? imgUp : img;
      const size = radius * 4;
      g.save();
      g.translate(BIRD_X, Math.round(y));
      g.rotate(rot);
      if (single && flapping) g.scale(1.1, 0.86);
      if (frame.complete && frame.naturalWidth) g.drawImage(frame, -size * 0.6, -size * 0.5, size * 1.2, size);
      g.restore();

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (flash > 0) {
        g.globalAlpha = flash * (reduceMotion ? 0.35 : 0.8);
        g.fillStyle = "#ffffff";
        g.fillRect(0, 0, W, H);
        g.globalAlpha = 1;
      }

      // HUD
      g.textAlign = "center";
      if (state !== "ready") {
        const s = 1 + 0.35 * pop;
        g.save();
        g.translate(W / 2, 68);
        g.scale(s, s);
        text(scoreStr, 0, 0, FONT_BIG, CREAM, 4);
        g.restore();
      }
      g.textAlign = "left";
      text(`BEST ${best}`, 12, 24, FONT_SM, newBest ? "#f4c430" : CREAM, 2);
      g.textAlign = "center";

      if (state === "ready") {
        text("READY?", W / 2, H / 2 - 70, FONT_BIG, CREAM, 4);
        g.font = FONT_SM;
        g.fillStyle = INK;
        g.fillText("TAP / SPACE TO FLY", W / 2, H / 2 + 80);
      } else if (state === "paused") {
        g.globalAlpha = 0.45;
        g.fillStyle = INK;
        g.fillRect(0, 0, W, H);
        g.globalAlpha = 1;
        text("PAUSED", W / 2, H / 2 - 20, FONT_BIG, CREAM, 4);
        text("TAP TO CONTINUE", W / 2, H / 2 + 20, FONT_SM, CREAM, 2);
      } else if ((state === "dying" || state === "over") && newBest) {
        text("NEW BEST!", W / 2, 110, FONT_MD, "#f4c430", 3);
      }
    };

    const loop = (now: number) => {
      const frameDt = Math.min((now - last) / 1000, 0.1); // a long stall can't teleport the bird
      last = now;
      if (state !== "paused" && state !== "over") {
        acc += frameDt;
        while (acc >= SIM_DT) {
          update(SIM_DT, now);
          acc -= SIM_DT;
        }
      }
      render(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.code !== "ArrowUp" && e.code !== "KeyW") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      // something (page.tsx's game-over overlay) covers the canvas: let the key reach it
      const r = canvas.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (top && top !== canvas) return;
      e.preventDefault(); // no page scroll
      if (!e.repeat) flap();
    };
    const onPointer = (e: PointerEvent) => {
      if (e.button > 0) return;
      e.preventDefault();
      flap();
    };
    const onVisibility = () => {
      if (document.hidden && state === "playing") state = "paused";
    };
    canvas.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [start]);

  return (
    <canvas
      ref={canvasRef}
      className="block w-full max-w-[400px] aspect-[2/3] rounded-2xl touch-none select-none cursor-pointer"
      aria-label="Flappy game. Press space or tap to fly."
    />
  );
}

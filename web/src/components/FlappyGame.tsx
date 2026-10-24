"use client";

import { useEffect, useRef } from "react";
import { birdDataUri } from "@/lib/birds";
import { chirp } from "@/lib/chirp";
import type { GameOver, GameStart } from "@/lib/game";

const W = 400;
const H = 600;
const BASE = { gravity: 1500, flap: 450, radius: 14, pipeSpeed: 180, gap: 150, spawnEvery: 1.4, pipeW: 64 };
const BIRD_X = 110;

/** Difficulty ramp: pipes get 5% faster every 10 points. Tune here. */
export function pipeSpeed(score: number) {
  return BASE.pipeSpeed * (1 + 0.05 * Math.floor(score / 10));
}

type Pipe = { x: number; gapY: number; passed: boolean };

export function FlappyGame({ start, onGameOver }: { start: GameStart; onGameOver: (r: GameOver) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onOverRef = useRef(onGameOver);
  onOverRef.current = onGameOver;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const g = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    g.scale(dpr, dpr);
    g.imageSmoothingEnabled = false;

    const img = new Image();
    // Registered birds bring their own sprite (one frame, so the flap frame reuses it).
    img.src = start.spriteUrl ?? birdDataUri(start.species);
    const imgUp = new Image();
    imgUp.src = start.spriteUrl ?? birdDataUri(start.species, true);
    // canvas can't read CSS vars in `font`, so resolve next/font's hashed family once
    const displayFont = getComputedStyle(canvas).getPropertyValue("--font-display").trim() || "monospace";
    let groundX = 0;
    let flapAt = -1e9;
    let prevVy = 0;

    const gravity = BASE.gravity * (start.stats.gravity / 100);
    const flapV = BASE.flap * (start.stats.flapPower / 100);
    const radius = BASE.radius * (start.stats.hitbox / 100);

    let state: "ready" | "playing" | "over" = "ready";
    let y = H / 2;
    let vy = 0;
    let pipes: Pipe[] = [];
    let spawnT = 0;
    let score = 0;
    let startedAt = 0;
    let last = performance.now();
    let raf = 0;

    const flap = () => {
      if (state === "over") return;
      if (state === "ready") {
        state = "playing";
        startedAt = performance.now();
      }
      vy = -flapV;
    };

    const end = () => {
      state = "over";
      onOverRef.current({ tokenId: start.tokenId, score, durationMs: Math.round(performance.now() - startedAt) });
    };

    const hits = (p: Pipe) => {
      // circle vs the two pipe rects
      const nx = Math.max(p.x, Math.min(BIRD_X, p.x + BASE.pipeW));
      if (Math.abs(nx - BIRD_X) > radius) return false;
      const topBottom = p.gapY - BASE.gap / 2;
      const botTop = p.gapY + BASE.gap / 2;
      const dTop = Math.hypot(nx - BIRD_X, Math.min(y, topBottom) - y);
      const dBot = Math.hypot(nx - BIRD_X, Math.max(y, botTop) - y);
      return (y - radius < topBottom && dTop <= radius) || (y + radius > botTop && dBot <= radius);
    };

    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30); // clamp so a tab switch doesn't teleport the bird
      last = now;

      if (state === "playing") {
        vy += gravity * dt;
        y += vy * dt;
        const speed = pipeSpeed(score);
        spawnT -= dt;
        if (spawnT <= 0) {
          spawnT = BASE.spawnEvery;
          pipes.push({ x: W, gapY: 120 + Math.random() * (H - 240), passed: false });
        }
        for (const p of pipes) {
          p.x -= speed * dt;
          if (!p.passed && p.x + BASE.pipeW < BIRD_X - radius) {
            p.passed = true;
            score++;
            chirp(start.species, 0.06);
          }
        }
        pipes = pipes.filter((p) => p.x + BASE.pipeW > 0);
        if (y + radius > H - 40 || y - radius < 0 || pipes.some(hits)) end();
      } else if (state === "ready") {
        y = H / 2 + Math.sin(now / 250) * 8;
      }

      // draw (pixel style: flat bands, hard edges, everything snapped to whole px)
      const SKY = ["#9fd3c7", "#b3dccc", "#c6e5d2", "#d8ecd8", "#e8f0dc", "#f6f1e4"];
      const bandH = Math.ceil((H - 40) / SKY.length / 8) * 8;
      SKY.forEach((col, i) => {
        g.fillStyle = col;
        g.fillRect(0, i * bandH, W, bandH);
      });

      // pixel clouds, slow parallax
      g.fillStyle = "#fffdf7";
      for (const [cx0, cy, sp] of [[40, 70, 0.012], [230, 130, 0.008], [330, 40, 0.015], [140, 210, 0.006]]) {
        const cx = Math.round((((cx0 - now * sp) % (W + 80)) + W + 80) % (W + 80) / 4) * 4 - 60;
        g.fillRect(cx + 8, cy, 24, 8);
        g.fillRect(cx, cy + 8, 48, 8);
        g.fillRect(cx + 16, cy - 8, 12, 8);
      }

      const column = (x: number, y: number, w: number, h: number) => {
        if (h <= 0) return;
        g.fillStyle = "#1e2a1f";
        g.fillRect(x, y, w, h);
        g.fillStyle = "#2f6b3a";
        g.fillRect(x + 3, y, w - 6, h);
        g.fillStyle = "#5a9a5c";
        g.fillRect(x + 7, y, 6, h);
        g.fillStyle = "#8cc27a";
        g.fillRect(x + 10, y, 3, h);
        g.fillStyle = "#24552e";
        g.fillRect(x + w - 13, y, 10, h);
      };
      for (const p of pipes) {
        const x = Math.round(p.x);
        const top = Math.round(p.gapY - BASE.gap / 2);
        const bot = Math.round(p.gapY + BASE.gap / 2);
        column(x, 0, BASE.pipeW, top - 16);
        column(x, bot + 16, BASE.pipeW, H - 40 - bot - 16);
        // caps
        column(x - 4, top - 16, BASE.pipeW + 8, 16);
        column(x - 4, bot, BASE.pipeW + 8, 16);
        g.fillStyle = "#1e2a1f";
        g.fillRect(x - 4, top - 16, BASE.pipeW + 8, 3);
        g.fillRect(x - 4, top - 3, BASE.pipeW + 8, 3);
        g.fillRect(x - 4, bot, BASE.pipeW + 8, 3);
        g.fillRect(x - 4, bot + 13, BASE.pipeW + 8, 3);
      }

      // tiled ground that scrolls with the pipes
      if (state === "playing") groundX = (groundX + pipeSpeed(score) * dt) % 16;
      const gy = H - 40;
      g.fillStyle = "#1e2a1f";
      g.fillRect(0, gy, W, 3);
      g.fillStyle = "#5a9a5c";
      g.fillRect(0, gy + 3, W, 9);
      g.fillStyle = "#8a6a3b";
      g.fillRect(0, gy + 12, W, 28);
      const off = Math.round(groundX);
      for (let x = -off; x < W; x += 16) {
        g.fillStyle = "#2f6b3a";
        g.fillRect(x, gy + 9, 8, 3); // grass teeth
        g.fillStyle = "#6f5430";
        g.fillRect(x + 4, gy + 18, 6, 6);
        g.fillRect(x + 12, gy + 30, 6, 6);
      }

      // wings up for ~120ms after each flap (detected as vy jumping negative)
      if (vy < 0 && prevVy >= 0 && state === "playing") flapAt = now;
      prevVy = vy;
      const frame = now - flapAt < 120 ? imgUp : img;
      const size = radius * 4;
      g.save();
      g.translate(Math.round(BIRD_X), Math.round(y));
      g.rotate(Math.max(-0.5, Math.min(1, vy / 700)));
      if (frame.complete) g.drawImage(frame, -size * 0.6, -size * 0.5, size * 1.2, size);
      g.restore();

      g.textAlign = "center";
      g.font = `32px ${displayFont}`;
      g.fillStyle = "#1e2a1f";
      g.fillText(String(score), W / 2 + 4, 84);
      g.fillStyle = "#fffdf7";
      g.fillText(String(score), W / 2, 80);
      if (state === "ready") {
        g.font = `11px ${displayFont}`;
        g.fillStyle = "#1e2a1f";
        g.fillText("TAP / SPACE UNTUK TERBANG", W / 2, H / 2 + 80);
      }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        flap();
      }
    };
    canvas.addEventListener("pointerdown", flap);
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", flap);
      window.removeEventListener("keydown", onKey);
    };
  }, [start]);

  return (
    <canvas
      ref={canvasRef}
      className="block w-full max-w-[400px] aspect-[2/3] rounded-2xl touch-none select-none cursor-pointer"
      aria-label="Flappy game. Tekan spasi atau tap untuk terbang."
    />
  );
}

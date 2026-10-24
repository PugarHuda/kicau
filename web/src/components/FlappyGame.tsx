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

    const img = new Image();
    img.src = birdDataUri(start.species);

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

      // draw
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#BFE3D0");
      sky.addColorStop(1, "#F6F1E4");
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);

      g.fillStyle = "#2F6B3A";
      for (const p of pipes) {
        g.fillRect(p.x, 0, BASE.pipeW, p.gapY - BASE.gap / 2);
        g.fillRect(p.x, p.gapY + BASE.gap / 2, BASE.pipeW, H);
        g.fillStyle = "#24552E";
        g.fillRect(p.x - 4, p.gapY - BASE.gap / 2 - 16, BASE.pipeW + 8, 16);
        g.fillRect(p.x - 4, p.gapY + BASE.gap / 2, BASE.pipeW + 8, 16);
        g.fillStyle = "#2F6B3A";
      }
      g.fillStyle = "#8A6A3B";
      g.fillRect(0, H - 40, W, 40);

      const size = radius * 4;
      g.save();
      g.translate(BIRD_X, y);
      g.rotate(Math.max(-0.5, Math.min(1, vy / 700)));
      if (img.complete) g.drawImage(img, -size * 0.6, -size * 0.5, size * 1.2, size);
      g.restore();

      g.fillStyle = "#1E2A1F";
      g.font = "bold 44px var(--font-display), sans-serif";
      g.textAlign = "center";
      g.fillText(String(score), W / 2, 80);
      if (state === "ready") {
        g.font = "600 18px sans-serif";
        g.fillText("Tap / Space untuk terbang", W / 2, H / 2 + 80);
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

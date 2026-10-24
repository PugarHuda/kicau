"use client";

import { useEffect, useRef, useState } from "react";
import { LABELS, SPAWN, TREES, WATER, WORLD_H, WORLD_W, ZONES, drawTree, hits, loadTileset, renderMap } from "./map";

export type WorldBird = {
  key: string;
  label: string;
  sublabel?: string;
  sprite: string;
  spriteUp?: string;
  zone: keyof typeof ZONES;
};
export type PlayerBird = { label: string; sprite: string; spriteUp?: string };

type Npc = { x: number; y: number; vx: number; vy: number; t: number; flip: boolean; moving: boolean };

const SPEED = 190; // world units / s
const NPC_SPEED = 34;
const REACH = 70;
const BW = 72, BH = 54; // bird sprite box in world units (48x36 sprite × 1.5)
const FEET = { hw: 14, hh: 8 };

const imgCache = new Map<string, HTMLImageElement>();
function img(src: string) {
  let i = imgCache.get(src);
  if (!i) {
    i = new Image();
    i.src = src;
    imgCache.set(src, i);
  }
  return i.complete && i.naturalWidth ? i : null;
}

function spawnIn(zone: keyof typeof ZONES): Npc {
  const z = ZONES[zone];
  for (let k = 0; k < 40; k++) {
    const x = z.x + Math.random() * z.w, y = z.y + Math.random() * z.h;
    if (!hits(x, y, FEET.hw, FEET.hh)) return { x, y, vx: 0, vy: 0, t: Math.random() * 2, flip: Math.random() < 0.5, moving: false };
  }
  return { x: z.x + z.w / 2, y: z.y + z.h / 2, vx: 0, vy: 0, t: 1, flip: false, moving: false };
}

export function TamanWorld({
  player,
  npcs,
  paused,
  onInteract,
}: {
  player: PlayerBird;
  npcs: WorldBird[];
  paused: boolean;
  onInteract: (key: string) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const keys = useRef(new Set<string>());
  const joy = useRef({ x: 0, y: 0 });
  const nearRef = useRef<string | null>(null);
  const [near, setNear] = useState<string | null>(null);
  const [touch, setTouch] = useState(false);
  const touchRef = useRef(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  // latest props for the rAF loop without restarting it
  const live = useRef({ player, npcs, paused, onInteract });
  live.current = { player, npcs, paused, onInteract };
  const state = useRef(new Map<string, Npc>());
  const camRef = useRef({ x: 0, y: 0, zoom: 1 });

  useEffect(() => {
    touchRef.current = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;
    setTouch(touchRef.current);
  }, []);

  useEffect(() => {
    if (paused) {
      keys.current.clear();
      joy.current = { x: 0, y: 0 };
      setKnob({ x: 0, y: 0 });
    }
  }, [paused]);

  // keyboard
  useEffect(() => {
    const MOVE = new Set(["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"]);
    const down = (e: KeyboardEvent) => {
      if (live.current.paused) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, select, textarea")) return;
      const k = e.key.toLowerCase();
      if (MOVE.has(k)) {
        keys.current.add(k);
        e.preventDefault();
      } else if (k === "e" && nearRef.current) {
        live.current.onInteract(nearRef.current);
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // game loop
  useEffect(() => {
    const cv = canvas.current!, box = wrap.current!;
    const ctx = cv.getContext("2d")!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let map: HTMLCanvasElement | null = null;
    let tiles: HTMLImageElement | null = null;
    let dead = false;
    loadTileset().then((t) => {
      if (dead) return;
      tiles = t;
      map = renderMap(t);
    });
    const font = getComputedStyle(document.body).getPropertyValue("--font-display") || "monospace";
    const me = { x: SPAWN.x, y: SPAWN.y, flip: false, moving: false, t: 0 };
    let cw = 0, ch = 0, dpr = 1;

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cw = box.clientWidth;
      ch = box.clientHeight;
      cv.width = Math.round(cw * dpr);
      cv.height = Math.round(ch * dpr);
      camRef.current.zoom = Math.max(0.55, Math.min(1.6, Math.min(cw, ch) / 520));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);

    const tryMove = (o: { x: number; y: number }, dx: number, dy: number) => {
      if (dx && !hits(o.x + dx, o.y, FEET.hw, FEET.hh)) o.x += dx;
      else if (dx) dx = 0;
      if (dy && !hits(o.x, o.y + dy, FEET.hw, FEET.hh)) o.y += dy;
      else if (dy) dy = 0;
      return dx !== 0 || dy !== 0;
    };

    const drawBird = (src: string, srcUp: string | undefined, x: number, y: number, flip: boolean, moving: boolean, t: number) => {
      const up = moving && srcUp && Math.floor(t * 8) % 2 === 1;
      const im = img(up ? srcUp! : src) ?? img(src);
      const bounce = moving ? Math.abs(Math.sin(t * 12)) * 7 : 0;
      // drop shadow, shrinks while hopping
      ctx.fillStyle = "rgba(30,42,31,0.28)";
      const sw = 20 - bounce;
      ctx.beginPath();
      ctx.ellipse(x, y - 1, sw, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      if (!im) return;
      // fit custom PNGs (any aspect) into the sprite box, feet on the ground
      const s = Math.min(BW / im.naturalWidth, BH / im.naturalHeight);
      const w = im.naturalWidth * s, h = im.naturalHeight * s;
      ctx.save();
      ctx.translate(x, y - bounce);
      if (flip) ctx.scale(-1, 1);
      ctx.drawImage(im, -w / 2, -h, w, h);
      ctx.restore();
    };

    const tag = (sx: number, sy: number, text: string, bg: string, fg: string, size = 8) => {
      ctx.font = `${size}px ${font}`;
      const w = Math.ceil(ctx.measureText(text).width) + 8;
      const x = Math.round(sx - w / 2), y = Math.round(sy - size - 6);
      ctx.fillStyle = "#1e2a1f";
      ctx.fillRect(x - 2, y - 2, w + 4, size + 10);
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, w, size + 6);
      ctx.fillStyle = fg;
      ctx.textBaseline = "top";
      ctx.fillText(text, x + 4, y + 3);
    };

    let raf = 0, last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { player, npcs, paused } = live.current;
      const cam = camRef.current;

      // player
      let ix = joy.current.x, iy = joy.current.y;
      const k = keys.current;
      if (k.has("arrowleft") || k.has("a")) ix -= 1;
      if (k.has("arrowright") || k.has("d")) ix += 1;
      if (k.has("arrowup") || k.has("w")) iy -= 1;
      if (k.has("arrowdown") || k.has("s")) iy += 1;
      const len = Math.hypot(ix, iy);
      if (len > 1) {
        ix /= len;
        iy /= len;
      }
      me.moving = !paused && len > 0.15 && tryMove(me, ix * SPEED * dt, iy * SPEED * dt);
      if (me.moving) {
        me.t += dt;
        if (Math.abs(ix) > 0.1) me.flip = ix < 0;
      } else me.t = 0;

      // npcs: random walk, collide with the map, stay in their zone
      const st = state.current;
      for (const n of npcs) {
        let s = st.get(n.key);
        if (!s) st.set(n.key, (s = spawnIn(n.zone)));
        if (reduced || paused) {
          s.moving = false;
          continue;
        }
        s.t -= dt;
        if (s.t <= 0) {
          const go = Math.random() < 0.55;
          const a = Math.random() * Math.PI * 2;
          s.vx = go ? Math.cos(a) * NPC_SPEED : 0;
          s.vy = go ? Math.sin(a) * NPC_SPEED * 0.7 : 0;
          s.t = go ? 0.8 + Math.random() * 1.6 : 1.5 + Math.random() * 3;
          if (s.vx) s.flip = s.vx < 0;
        }
        const z = ZONES[n.zone];
        const nx = s.x + s.vx * dt, ny = s.y + s.vy * dt;
        const inZone = nx > z.x && nx < z.x + z.w && ny > z.y && ny < z.y + z.h;
        s.moving = (s.vx !== 0 || s.vy !== 0) && inZone && tryMove(s, s.vx * dt, s.vy * dt);
        if (!s.moving && (s.vx || s.vy)) s.t = 0; // bumped into something: re-roll next frame
      }

      // nearest npc in reach
      let best: string | null = null, bd = REACH;
      for (const n of npcs) {
        const s = st.get(n.key)!;
        const d = Math.hypot(s.x - me.x, s.y - me.y);
        if (d < bd) {
          bd = d;
          best = n.key;
        }
      }
      if (best !== nearRef.current) {
        nearRef.current = best;
        setNear(best);
      }

      // camera (clamped; centered if the view is bigger than the world)
      const vw = cw / cam.zoom, vh = ch / cam.zoom;
      cam.x = vw >= WORLD_W ? (WORLD_W - vw) / 2 : Math.max(0, Math.min(WORLD_W - vw, me.x - vw / 2));
      cam.y = vh >= WORLD_H ? (WORLD_H - vh) / 2 : Math.max(0, Math.min(WORLD_H - vh, me.y - 30 - vh / 2));
      const S = cam.zoom * dpr;
      cam.x = Math.round(cam.x * S) / S;
      cam.y = Math.round(cam.y * S) / S;

      // draw
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#24552e";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.setTransform(S, 0, 0, S, -cam.x * S, -cam.y * S);
      ctx.imageSmoothingEnabled = false;
      if (map) ctx.drawImage(map, 0, 0, WORLD_W, WORLD_H);
      // water shimmer (cheap: a few moving highlight dashes)
      ctx.fillStyle = "rgba(220,240,255,0.7)";
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4 + (reduced ? 0 : now / 1400);
        const wx = WATER.cx + Math.cos(a) * WATER.rx * 0.55 * ((i % 3) / 3 + 0.4);
        const wy = WATER.cy + Math.sin(a * 1.3) * WATER.ry * 0.45;
        ctx.fillRect(Math.round(wx / 3) * 3, Math.round(wy / 3) * 3, 18 + (i % 3) * 6, 3);
      }

      type E = { y: number; draw: () => void };
      const ents: E[] = npcs.map((n) => {
        const s = st.get(n.key)!;
        return { y: s.y, draw: () => drawBird(n.sprite, n.spriteUp, s.x, s.y, s.flip, s.moving, now / 1000 + s.x) };
      });
      if (tiles) for (const t of TREES) ents.push({ y: t.y - 6, draw: () => drawTree(ctx, tiles!, t.x, t.y, t.green) });
      ents.push({ y: me.y, draw: () => drawBird(player.sprite, player.spriteUp, me.x, me.y, me.flip, me.moving, me.t) });
      ents.sort((a, b) => a.y - b.y).forEach((e) => e.draw());

      // screen-space text (crisp at any zoom)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const toScreen = (x: number, y: number) => [(x - cam.x) * cam.zoom, (y - cam.y) * cam.zoom] as const;
      const onScreen = (sx: number, sy: number) => sx > -80 && sx < cw + 80 && sy > -40 && sy < ch + 80;
      for (const l of LABELS) {
        const [sx, sy] = toScreen(l.x, l.y);
        if (!onScreen(sx, sy)) continue;
        ctx.font = `${Math.max(8, Math.round(11 * cam.zoom))}px ${font}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#1e2a1f";
        ctx.fillText(l.text, sx, sy);
        ctx.textAlign = "left";
      }
      for (const n of npcs) {
        const s = st.get(n.key)!;
        const [sx, sy] = toScreen(s.x, s.y - BH - 4);
        if (!onScreen(sx, sy)) continue;
        if (n.key === best) {
          tag(sx, sy - 16, touchRef.current ? "View ▸" : "E · View", "#e8a33d", "#1e2a1f", 9);
        } else tag(sx, sy, n.sublabel ? `${n.label} · ${n.sublabel}` : n.label, "rgba(255,253,247,0.92)", "#1e2a1f");
      }
      const [px, py] = toScreen(me.x, me.y - BH - 4);
      tag(px, py, player.label, "#2f6b3a", "#fffdf7");
    };
    raf = requestAnimationFrame(frame);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  // click/tap an NPC directly
  function onCanvasPointer(e: React.PointerEvent) {
    if (paused) return;
    const r = canvas.current!.getBoundingClientRect();
    const cam = camRef.current;
    const wx = cam.x + (e.clientX - r.left) / cam.zoom, wy = cam.y + (e.clientY - r.top) / cam.zoom;
    let hit: string | null = null, hy = -Infinity;
    for (const n of npcs) {
      const s = state.current.get(n.key);
      if (s && wx > s.x - BW / 2 && wx < s.x + BW / 2 && wy > s.y - BH - 8 && wy < s.y + 6 && s.y > hy) {
        hit = n.key;
        hy = s.y;
      }
    }
    if (hit) onInteract(hit);
  }

  // virtual joystick
  const RAD = 44;
  function joyMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!(e.buttons || e.pointerType === "touch") || paused) return;
    const r = e.currentTarget.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > RAD) {
      dx *= RAD / d;
      dy *= RAD / d;
    }
    joy.current = { x: dx / RAD, y: dy / RAD };
    setKnob({ x: dx, y: dy });
  }
  function joyEnd() {
    joy.current = { x: 0, y: 0 };
    setKnob({ x: 0, y: 0 });
  }

  return (
    <div ref={wrap} className="relative h-full w-full touch-none select-none overflow-hidden bg-leaf-dark">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" onPointerDown={onCanvasPointer} aria-label="Kicau Garden" />
      {touch && (
        <>
          <div
            className="absolute bottom-5 left-5 h-32 w-32 border-[3px] border-ink bg-paper/40"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              joyMove(e);
            }}
            onPointerMove={joyMove}
            onPointerUp={joyEnd}
            onPointerCancel={joyEnd}
            aria-label="Joystick"
          >
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 h-14 w-14 border-[3px] border-ink bg-sun"
              style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
            />
          </div>
          <button
            className="btn-primary absolute bottom-8 right-5 h-20 w-20 !p-0 !text-[0.65rem]"
            disabled={!near || paused}
            onClick={() => near && onInteract(near)}
          >
            View
          </button>
        </>
      )}
      {!touch && (
        <div className="pointer-events-none absolute bottom-3 left-3 bg-paper/85 px-2 py-1 text-xs text-ink">
          WASD / arrows to walk · E to view · click a bird
        </div>
      )}
    </div>
  );
}

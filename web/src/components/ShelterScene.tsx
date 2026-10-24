"use client";

import { useEffect, useRef, useState } from "react";
import { birdDataUri } from "@/lib/birds";
import { chirp } from "@/lib/chirp";

type SceneBird = { id: number; name: string; priceLabel: string; soldOut: boolean };
type Spot = { x: number; y: number; perch: boolean };
type Pose = { spot: number; mode: "idle" | "hop" | "fly"; dur: number; flip: boolean };

// Everything is in % of the scene box (x from left, y = where the bird's feet touch), so it scales at any size.
const SPOTS: Spot[] = [
  // branches + perch stand
  { x: 27, y: 41, perch: true },
  { x: 35, y: 41, perch: true },
  { x: 9, y: 53, perch: true },
  { x: 75, y: 46, perch: true },
  { x: 86, y: 46, perch: true },
  // ground
  { x: 22, y: 92, perch: false },
  { x: 32, y: 85, perch: false },
  { x: 42, y: 93, perch: false },
  { x: 53, y: 86, perch: false },
  { x: 64, y: 92, perch: false },
  { x: 74, y: 85, perch: false },
  { x: 88, y: 91, perch: false },
];
const START = [0, 6, 3, 8, 10, 1, 11, 2]; // deterministic so SSR and client agree

// birdSvg is not free and `birds` is a fresh array each parent render, so cache per frame.
const spriteCache = new Map<string, string>();
const sprite = (id: number, up: boolean) => {
  const k = `${id}:${up}`;
  if (!spriteCache.has(k)) spriteCache.set(k, birdDataUri(id, up));
  return spriteCache.get(k)!;
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function ShelterScene({ birds, onSelect }: { birds: SceneBird[]; onSelect: (id: number) => void }) {
  const [poses, setPoses] = useState<Pose[]>(() =>
    birds.map((_, i) => ({ spot: START[i % START.length], mode: "idle", dur: 0, flip: i % 2 === 1 })),
  );
  const posesRef = useRef(poses); // kept in sync by update() below
  const count = birds.length;


  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };
    const update = (i: number, p: Partial<Pose>) => {
      const next = posesRef.current.map((q, k) => (k === i ? { ...q, ...p } : q));
      posesRef.current = next;
      setPoses(next);
    };

    const move = (i: number) => {
      const cur = posesRef.current[i];
      if (!cur) return;
      const from = SPOTS[cur.spot];
      // perched birds mostly stay put; ground birds mostly hop around, sometimes fly up
      if (from.perch && Math.random() < 0.5) return later(() => move(i), rand(2500, 6000));
      const wantPerch = from.perch ? Math.random() < 0.15 : Math.random() < 0.3;
      const taken = new Set(posesRef.current.map((p) => p.spot));
      const free = SPOTS.flatMap((s, k) => (!taken.has(k) && s.perch === wantPerch ? [k] : []));
      if (!free.length) return later(() => move(i), rand(2500, 6000));
      const spot = free[Math.floor(Math.random() * free.length)];
      const to = SPOTS[spot];
      const fly = from.perch || to.perch;
      const d = Math.hypot(to.x - from.x, to.y - from.y);
      const dur = Math.round(fly ? 900 + d * 14 : 400 + d * 32);
      update(i, { spot, mode: fly ? "fly" : "hop", dur, flip: to.x < from.x });
      later(() => {
        update(i, { mode: "idle" });
        later(() => move(i), rand(2500, 6000));
      }, dur);
    };

    for (let i = 0; i < count; i++) later(() => move(i), rand(800, 4000));
    return () => timers.forEach(clearTimeout);
  }, [count]);

  return (
    <div
      className="relative aspect-[4/5] w-full overflow-hidden border-4 border-ink shadow-[6px_6px_0_var(--ink)] select-none sm:aspect-[16/9]"
      style={{
        background:
          "linear-gradient(#8fcfe0 0 14%, #a6d9e6 14% 28%, #bfe4ea 28% 42%, #d8eee9 42% 56%, #eaf3e2 56% 72%, transparent 72%)",
      }}
    >
      <style>{`
        @keyframes kc-bob { 50% { transform: translateY(-4%); } }
        @keyframes kc-hop { 50% { transform: translateY(-22%); } }
        @keyframes kc-flap { 0% { visibility: visible; } 50%, 100% { visibility: hidden; } }
        .kc-bob { animation: kc-bob 1.2s steps(1) infinite; }
        .kc-hop { animation: kc-hop 0.32s steps(2) infinite; }
        .kc-fly .kc-up, .kc-fly .kc-down { animation: kc-flap 0.24s infinite; }
        .kc-fly .kc-down { animation-delay: -0.12s; } /* opposite phase: exactly one frame visible */
        @media (prefers-reduced-motion: reduce) { .kc-bob, .kc-hop { animation: none; } }
      `}</style>

      {/* ---- scenery (decorative) ---- */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* sun + clouds */}
        <div className="absolute left-[82%] top-[6%] aspect-square w-[7%] bg-sun shadow-[0_0_0_4px_#f3c36b]" />
        <div className="absolute left-[46%] top-[10%] h-[4%] w-[14%] bg-paper shadow-[12px_8px_0_#fffdf7]" />
        <div className="absolute left-[60%] top-[24%] h-[3%] w-[9%] bg-paper/80" />
        {/* far hills */}
        <div className="absolute left-0 top-[64%] h-[10%] w-[40%] bg-[#9cc48a]" />
        <div className="absolute left-[34%] top-[60%] h-[14%] w-[36%] bg-[#8bb97a]" />
        <div className="absolute right-0 top-[66%] h-[8%] w-[35%] bg-[#9cc48a]" />

        {/* tree: trunk, branches, canopy */}
        <div className="absolute left-[16%] top-[30%] h-[44%] w-[5%] bg-[#7a5232] shadow-[inset_-6px_0_0_#5e3d24]" />
        <div className="absolute left-[20%] top-[41%] h-[2.2%] w-[19%] bg-[#7a5232] shadow-[0_4px_0_#5e3d24]" />
        <div className="absolute left-[4%] top-[53%] h-[2.2%] w-[13%] bg-[#7a5232] shadow-[0_4px_0_#5e3d24]" />
        <div className="absolute left-[3%] top-[6%] h-[22%] w-[32%] bg-leaf" />
        <div className="absolute left-[8%] top-[2%] h-[12%] w-[20%] bg-[#4f8f4a]" />
        <div className="absolute left-[0%] top-[20%] h-[14%] w-[16%] bg-leaf-dark" />
        <div className="absolute left-[20%] top-[18%] h-[14%] w-[18%] bg-leaf-dark" />
        <div className="absolute left-[12%] top-[10%] h-[5%] w-[8%] bg-[#6aa85e]" />

        {/* perch stand */}
        <div className="absolute left-[79.5%] top-[46%] h-[28%] w-[2.5%] bg-[#7a5232] shadow-[inset_-4px_0_0_#5e3d24]" />
        <div className="absolute left-[70%] top-[46%] h-[2.2%] w-[21%] bg-[#7a5232] shadow-[0_4px_0_#5e3d24]" />

        {/* ground */}
        <div className="absolute inset-x-0 bottom-0 top-[74%] bg-[#6fa854]" />
        <div className="absolute inset-x-0 top-[74%] h-[2%] bg-[#88c063]" />
        <div className="absolute left-[30%] bottom-0 top-[80%] w-[46%] bg-[#d9c08a] shadow-[inset_0_6px_0_#c6a970]" />
        <div className="absolute inset-x-0 bottom-0 h-[3%] bg-[#4f8a3c]" />

        {/* bushes */}
        <div className="absolute left-[-2%] top-[67%] h-[9%] w-[14%] bg-leaf shadow-[inset_0_6px_0_#4f8f4a]" />
        <div className="absolute left-[90%] top-[68%] h-[8%] w-[14%] bg-leaf shadow-[inset_0_6px_0_#4f8f4a]" />
        <div className="absolute left-[60%] top-[70%] h-[6%] w-[9%] bg-leaf-dark" />

        {/* sign */}
        <div className="absolute left-[44.5%] top-[64%] h-[12%] w-[1.5%] bg-[#5e3d24]" />
        <div className="absolute left-[38%] top-[56%] grid w-[15%] min-w-[64px] place-items-center border-[3px] border-ink bg-[#c99a5b] px-1 py-[0.6%] text-center font-display text-[clamp(6px,1.1vw,11px)] leading-tight text-ink shadow-[3px_3px_0_var(--ink)]">
          TAMAN KICAU
        </div>
      </div>

      {/* ---- birds ---- */}
      {birds.map((b, i) => {
        const pose = poses[i] ?? { spot: START[i % START.length], mode: "idle", dur: 0, flip: false };
        const s = SPOTS[pose.spot];
        const align = s.x < 20 ? "left-0" : s.x > 80 ? "right-0" : "left-1/2 -translate-x-1/2";
        return (
          <button
            key={b.id}
            type="button"
            aria-label={`${b.name}, ${b.priceLabel}${b.soldOut ? ", sold out" : ""}`}
            onClick={() => {
              chirp(b.id);
              onSelect(b.id);
            }}
            className="group absolute cursor-pointer outline-offset-2 hover:z-[200]! focus-visible:z-[200]!"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: "clamp(48px, 10%, 112px)",
              zIndex: Math.round(s.y),
              transform: "translate(-50%, -86%)", // feet (sprite row ~31/36) on the spot
              transition:
                pose.mode === "fly"
                  ? `left ${pose.dur}ms linear, top ${pose.dur}ms cubic-bezier(.2,.9,.4,1)`
                  : `left ${pose.dur}ms linear, top ${pose.dur}ms linear`,
            }}
          >
            {/* tags */}
            <span className={`pointer-events-none absolute bottom-full mb-1 flex flex-col items-center gap-1 ${align}`}>
              <span className="hidden whitespace-nowrap border-2 border-ink bg-paper px-1.5 py-1 font-display text-[9px] leading-none text-ink shadow-[2px_2px_0_var(--ink)] group-hover:block group-focus-visible:block">
                {b.name} · {b.priceLabel}
              </span>
              {b.soldOut && (
                <span className="whitespace-nowrap border-2 border-ink bg-clay px-1 py-0.5 font-display text-[7px] leading-none text-paper">
                  SOLD OUT
                </span>
              )}
            </span>
            {/* sprite: flip wrapper > motion wrapper > 2 frames */}
            <span className="block transition-transform duration-100 group-hover:scale-110 group-focus-visible:scale-110">
              <span className="block" style={{ transform: pose.flip ? "scaleX(-1)" : undefined }}>
                <span
                  className={`relative block ${pose.mode === "hop" ? "kc-hop" : pose.mode === "fly" ? "kc-fly" : "kc-bob"}`}
                  style={pose.mode === "idle" ? { animationDelay: `${-i * 0.37}s` } : undefined}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sprite(b.id, false)} alt="" draggable={false} className="kc-down block w-full [image-rendering:pixelated]" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sprite(b.id, true)}
                    alt=""
                    draggable={false}
                    className="kc-up invisible absolute inset-0 block w-full [image-rendering:pixelated]"
                  />
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { formatEther, parseEther } from "viem";
import { BIRDS, IUCN_LABEL, birdDataUri } from "@/lib/birds";
import { chirp } from "@/lib/chirp";
import { EXPLORER } from "@/lib/config";
import { VIDEOS } from "@/lib/videos";

export type Species = {
  name: string;
  price: bigint;
  maxSupply: number;
  minted: number;
  gravity: number;
  flapPower: number;
  hitbox: number;
};

const IUCN_COLOR: Record<string, string> = {
  LC: "bg-leaf/15 text-leaf",
  NT: "bg-sun/20 text-[#8a5a0f]",
  VU: "bg-sun/30 text-[#8a5a0f]",
  EN: "bg-clay/20 text-clay",
  CR: "bg-clay text-paper",
};

export function BirdArt({ id, className = "" }: { id: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={birdDataUri(id)} alt={BIRDS[id]?.name ?? "burung"} className={className} />;
}

export function IucnBadge({ id }: { id: number }) {
  const iucn = BIRDS[id]?.iucn ?? "LC";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${IUCN_COLOR[iucn]}`} title={IUCN_LABEL[iucn]}>
      IUCN {iucn}
    </span>
  );
}

export function StatBar({ label, value }: { label: string; value: number }) {
  // 100 = normal; show 50..150 range
  const pct = Math.max(0, Math.min(100, value - 50));
  return (
    <div className="grid grid-cols-[88px_1fr_36px] items-center gap-2 text-sm">
      <span className="text-muted">{label}</span>
      <div className="h-2 rounded-full bg-line">
        <div className="h-2 rounded-full bg-leaf" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-right tabular-nums font-semibold">{value}</span>
    </div>
  );
}

export function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[1000] grid place-items-center bg-ink/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-paper p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-2xl leading-none text-muted hover:text-ink" aria-label="Tutup">
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

export function BirdCard({
  id,
  species,
  onBuy,
  onSupport,
  supported,
  busy,
  canBuy,
}: {
  id: number;
  species: Species;
  onBuy: () => void;
  onSupport: (amount: bigint) => void;
  supported?: bigint;
  busy: boolean;
  canBuy: boolean;
}) {
  const bird = BIRDS[id];
  const soldOut = species.minted >= species.maxSupply;
  return (
    <div>
      <div className="mb-4 grid place-items-center rounded-2xl bg-cream py-6">
        <BirdArt id={id} className="h-40 w-auto" />
      </div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 className="font-display text-3xl font-bold">{species.name}</h2>
        <IucnBadge id={id} />
      </div>
      <p className="mb-3 text-sm italic text-muted">
        {bird?.latin} · {bird?.rarity}
      </p>
      <BirdVideo id={id} />
      <p className="mb-5 leading-relaxed">{bird?.description}</p>
      <div className="mb-5 space-y-2 rounded-2xl border border-line p-4">
        <StatBar label="Gravitasi" value={species.gravity} />
        <StatBar label="Kepakan" value={species.flapPower} />
        <StatBar label="Hitbox" value={species.hitbox} />
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-display text-2xl font-bold">{formatEther(species.price)} MON</div>
          <div className="text-sm text-muted">
            {species.minted}/{species.maxSupply} terjual · 30% ke konservasi
          </div>
        </div>
        <button onClick={onBuy} disabled={busy || soldOut || !canBuy} className="btn-primary">
          {soldOut ? "Sold out" : busy ? "Memproses…" : "Adopsi NFT"}
        </button>
      </div>
      <div className="mt-5 border-t-[3px] border-dashed border-ink pt-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-display text-xs">Support tanpa adopsi</span>
          <span className="text-sm text-muted">
            Terkumpul {supported !== undefined ? formatEther(supported) : "…"} MON · 100% ke konservasi
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {["0.005", "0.01", "0.05"].map((amt) => (
            <button key={amt} onClick={() => onSupport(parseEther(amt))} disabled={busy || !canBuy} className="btn-ghost !py-2">
              {amt} MON
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Real singing clip of the species (loaded on demand: Commons file or youtube-nocookie embed). */
function BirdVideo({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const v = VIDEOS[id];
  return (
    <div className="mb-4">
      <div className="mb-2 flex flex-wrap gap-2">
        {v && (
          <button onClick={() => setOpen((o) => !o)} className="btn-primary !py-2" aria-expanded={open}>
            {open ? "Tutup video" : "Lihat video asli"}
          </button>
        )}
        <button onClick={() => chirp(id)} className="btn-ghost !py-2">
          Kicau pixel
        </button>
      </div>
      {open && v && (
        <figure>
          <div className="aspect-video w-full border-[3px] border-ink bg-ink">
            {v.kind === "file" ? (
              <video src={v.src} className="h-full w-full" controls autoPlay playsInline />
            ) : (
              <iframe
                className="h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`}
                title="Video kicau burung"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>
          <figcaption className="mt-1 text-xs text-muted">
            Video:{" "}
            <a href={v.page} target="_blank" rel="noreferrer" className="underline">
              {v.author}
            </a>{" "}
            · {v.license}
          </figcaption>
        </figure>
      )}
    </div>
  );
}

export function TxLink({ hash }: { hash?: string }) {
  if (!hash) return null;
  return (
    <a href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-leaf underline">
      Lihat tx di explorer ↗
    </a>
  );
}

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

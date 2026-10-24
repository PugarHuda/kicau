"use client";

import { useEffect, useState } from "react";
import { DEFAULT_PIXEL, pixelateBird } from "@/lib/pixelate";

export function RegisterBird({
  fee,
  busy,
  canRegister,
  onRegister,
}: {
  fee: string;
  busy: boolean;
  canRegister: boolean;
  onRegister: (name: string, image: Uint8Array) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string>();
  const [name, setName] = useState("");
  const [tolerance, setTolerance] = useState(DEFAULT_PIXEL.bgTolerance);
  const [sprite, setSprite] = useState<{ bytes: Uint8Array; dataUrl: string } | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    pixelateBird(file, { ...DEFAULT_PIXEL, bgTolerance: tolerance })
      .then((s) => {
        if (cancelled) return;
        setSprite(s);
        setError(s.bytes.length > 4096 ? "Gambar terlalu detail (>4 KB). Coba foto dengan latar polos." : undefined);
      })
      .catch(() => !cancelled && setError("Foto tidak bisa dibaca"));
    return () => {
      cancelled = true;
    };
  }, [file, tolerance]);

  const nameBytes = new TextEncoder().encode(name.trim()).length;
  const valid = sprite && sprite.bytes.length <= 4096 && nameBytes > 0 && nameBytes <= 32;

  return (
    <div>
      <h2 className="mb-1 font-display text-2xl font-bold">Daftarkan burungmu</h2>
      <p className="mb-4 text-sm text-muted">
        Upload foto burung kicau milikmu. Kami ubah jadi karakter pixel, lalu di-mint sebagai NFT. Gambarnya tersimpan
        on-chain di Monad.
      </p>

      <label className="btn-ghost mb-4 w-full cursor-pointer">
        {file ? "Ganti foto" : "Pilih foto burung"}
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>

      {photoUrl && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <figure className="rounded-2xl border border-line bg-cream p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="Foto asli" className="aspect-[6/5] w-full object-cover" />
            <figcaption className="mt-1 text-center text-xs text-muted">Foto asli</figcaption>
          </figure>
          <figure className="rounded-2xl border border-line bg-cream p-2">
            {sprite && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sprite.dataUrl} alt="Karakter pixel" className="aspect-[6/5] w-full object-contain [image-rendering:pixelated]" />
            )}
            <figcaption className="mt-1 text-center text-xs text-muted">
              Karakter pixel {sprite && `· ${sprite.bytes.length} B`}
            </figcaption>
          </figure>
        </div>
      )}

      {file && (
        <label className="mb-4 block text-sm">
          <span className="text-muted">Hapus latar: {tolerance}</span>
          <input
            type="range"
            min={0}
            max={140}
            value={tolerance}
            onChange={(e) => setTolerance(Number(e.target.value))}
            className="w-full accent-[var(--leaf)]"
          />
        </label>
      )}

      <label className="mb-4 block text-sm">
        <span className="text-muted">Nama burung</span>
        <input
          value={name}
          maxLength={32}
          onChange={(e) => setName(e.target.value)}
          placeholder="contoh: Si Jambul"
          className="mt-1 w-full border-[3px] border-ink bg-paper px-3 py-2"
        />
      </label>

      {error && <p className="mb-3 text-sm text-clay">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted">Biaya {fee} MON · 30% ke konservasi</span>
        <button
          className="btn-primary"
          disabled={!valid || busy || !canRegister}
          onClick={() => sprite && onRegister(name.trim(), sprite.bytes)}
        >
          {busy ? "Memproses…" : "Daftarkan"}
        </button>
      </div>
    </div>
  );
}

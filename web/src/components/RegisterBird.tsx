"use client";

import { useEffect, useState } from "react";
import { birdDataUri } from "@/lib/birds";
import { type BirdColors, DEFAULT_TOLERANCE, encodeBird, extractBirdColors } from "@/lib/pixelate";
import { type IdentifyResult, SpeciesCheck } from "./SpeciesCheck";

const MAX_BYTES = 4096;
const field = "mt-1 w-full border-[3px] border-ink bg-paper px-3 py-2";

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
  const [tolerance, setTolerance] = useState(DEFAULT_TOLERANCE);
  const [colors, setColors] = useState<BirdColors | null>(null);
  const [error, setError] = useState<string>();

  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [story, setStory] = useState("");
  const [titles, setTitles] = useState("");
  const [certificate, setCertificate] = useState("");
  const [lineage, setLineage] = useState("");
  const [species, setSpecies] = useState<IdentifyResult | null>(null);
  const [speciesOverride, setSpeciesOverride] = useState<string>();

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    extractBirdColors(file, tolerance)
      .then((c) => !cancelled && (setColors(c), setError(undefined)))
      .catch((e) => {
        if (cancelled) return;
        setColors(null);
        const msg = (e as Error).message;
        setError(msg.startsWith("No bird") ? msg : "Couldn't read that file as an image. Try a JPG or PNG photo.");
      });
    return () => {
      cancelled = true;
    };
  }, [file, tolerance]);

  const profile = {
    owner: owner.trim(),
    story: story.trim(),
    titles: titles.split("\n").map((t) => t.trim()).filter(Boolean),
    certificate: certificate.trim(),
    lineage: lineage.trim(),
    ...(speciesOverride !== undefined
      ? { species: speciesOverride.trim() }
      : species && { species: species.indonesianName || species.commonName, latin: species.latinName, aiConfidence: Math.round(species.confidence * 100) / 100 }),
  };
  const bytes = colors ? encodeBird(colors, profile) : null;
  const nameBytes = new TextEncoder().encode(name.trim()).length;
  const tooBig = !!bytes && bytes.length > MAX_BYTES;
  const valid = !!bytes && !tooBig && nameBytes > 0 && nameBytes <= 32;

  return (
    <div>
      <h2 className="mb-1 font-display text-2xl font-bold">Register your bird</h2>
      <p className="mb-4 text-sm text-muted">
        Upload a photo of your own songbird. We pick its colors from the photo and redraw it in Kicau pixel style.
        Its character, pedigree, and story are stored on-chain on Monad.
      </p>

      <label className="btn-ghost mb-4 w-full cursor-pointer">
        {file ? "Change photo" : "Choose a bird photo"}
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>

      {photoUrl && (
        <div className="mb-3 grid grid-cols-2 gap-3">
          <figure className="rounded-2xl border border-line bg-cream p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="Original photo" className="aspect-[4/3] w-full object-cover" />
            <figcaption className="mt-1 text-center text-xs text-muted">Original photo</figcaption>
          </figure>
          <figure className="rounded-2xl border border-line bg-cream p-2">
            {colors && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={birdDataUri(0, false, colors)} alt="Pixel character" className="aspect-[4/3] w-full object-contain" />
            )}
            <figcaption className="mt-1 text-center text-xs text-muted">Kicau character</figcaption>
          </figure>
        </div>
      )}

      <SpeciesCheck
        file={file}
        onResult={(r) => {
          setSpecies(r);
          setSpeciesOverride(undefined);
        }}
      />
      {file && (
        <label className="mb-4 block text-sm">
          <span className="text-muted">
            {speciesOverride !== undefined
              ? "Species (entered by owner)"
              : species
                ? "Species (AI-identified) — edit if it's wrong"
                : "Species"}
          </span>
          <input
            value={speciesOverride ?? species?.indonesianName ?? species?.commonName ?? ""}
            maxLength={60}
            placeholder="Murai Batu"
            onChange={(e) => setSpeciesOverride(e.target.value)}
            className={field}
          />
        </label>
      )}

      {colors && (
        <div className="mb-3 flex flex-wrap items-center gap-1" aria-label="Palette from photo">
          {Object.entries(colors).map(([k, v]) => (
            <span key={k} title={`${k} ${v}`} className="h-5 w-5 border-2 border-ink" style={{ background: v }} />
          ))}
          <span className="ml-1 text-xs text-muted">palette from photo</span>
        </div>
      )}

      {file && (
        <label className="mb-4 block text-sm">
          <span className="text-muted">Background cutoff: {tolerance}</span>
          <input
            type="range"
            min={10}
            max={140}
            value={tolerance}
            onChange={(e) => setTolerance(Number(e.target.value))}
            className="w-full accent-[var(--leaf)]"
          />
        </label>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-muted">Bird name *</span>
          <input value={name} maxLength={32} onChange={(e) => setName(e.target.value)} placeholder="Si Jambul" className={field} />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Owner name</span>
          <input value={owner} maxLength={40} onChange={(e) => setOwner(e.target.value)} placeholder="Pak Budi, Yogyakarta" className={field} />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-muted">Titles (one per line)</span>
          <textarea
            value={titles}
            rows={2}
            onChange={(e) => setTitles(e.target.value)}
            placeholder={"Champion — Piala Raja Jogja 2025\n2nd place — Kicau Mania Cup Jogja"}
            className={field}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Certificate / ring number</span>
          <input value={certificate} maxLength={60} onChange={(e) => setCertificate(e.target.value)} placeholder="Ring BF-2024-0187" className={field} />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Lineage</span>
          <input value={lineage} maxLength={80} onChange={(e) => setLineage(e.target.value)} placeholder="Champion bloodline 'Gladiator'" className={field} />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-muted">Story</span>
          <textarea
            value={story}
            rows={3}
            maxLength={600}
            onChange={(e) => setStory(e.target.value)}
            placeholder="Captive-bred since a chick, sings loud (gacor) every morning…"
            className={field}
          />
        </label>
      </div>

      {error && <p className="mb-3 text-sm text-clay">{error}</p>}
      {nameBytes > 32 && <p className="mb-3 text-sm text-clay">Name too long ({nameBytes} bytes, max 32). Emoji and accents take 2–4 bytes each.</p>}
      {tooBig && <p className="mb-3 text-sm text-clay">Too much data ({bytes?.length} B, max {MAX_BYTES} B). Shorten the story.</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted">
          Fee {fee} MON · 30% to conservation{bytes && ` · ${bytes.length} B on-chain`}
        </span>
        <button className="btn-primary" disabled={!valid || busy || !canRegister} onClick={() => bytes && onRegister(name.trim(), bytes)}>
          {busy ? "Processing…" : "Register"}
        </button>
      </div>
    </div>
  );
}

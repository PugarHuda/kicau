"use client";

import { useEffect, useState } from "react";
import type { IdentifyResult } from "@/app/api/identify/route";

export type { IdentifyResult };

const MAX_SIDE = 768;
const pct = (n: number) => `${Math.round(n * 100)}%`;

async function toDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL("image/jpeg", 0.85);
}

export function SpeciesCheck({ file, onResult }: { file: File | null; onResult?: (r: IdentifyResult | null) => void }) {
  const [result, setResult] = useState<IdentifyResult | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setResult(null);
    setError(undefined);
    onResult?.(null);
    if (!file) return;
    const ctrl = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const image = await toDataUrl(file);
        const res = await fetch("/api/identify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ image }),
          signal: ctrl.signal,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Identification failed.");
        setResult(json);
        onResult?.(json.isBird ? json : null);
      } catch (e) {
        if (!ctrl.signal.aborted) setError((e as Error).message || "Identification failed.");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
    // onResult is a state setter from the parent; re-run only for a new file or retry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, attempt]);

  if (!file) return null;

  const panel = "mb-4 border-[3px] border-ink bg-paper p-3 text-sm shadow-[4px_4px_0_var(--ink)]";

  if (loading) return <div className={`${panel} animate-pulse`}>🔎 Identifying species with AI…</div>;

  if (error)
    return (
      <div className={`${panel} flex flex-wrap items-center justify-between gap-2`}>
        <span className="text-clay">⚠️ {error}</span>
        <button className="btn-ghost" onClick={() => setAttempt((a) => a + 1)}>
          Retry
        </button>
      </div>
    );

  if (!result) return null;

  if (!result.isBird)
    return (
      <div className={panel}>
        <p className="font-bold text-clay">🚫 Not a bird</p>
        <p className="mt-1 text-muted">{result.notes || "We couldn't find a bird in this photo. Try a clearer photo of your bird."}</p>
      </div>
    );

  const low = result.confidence < 0.6;
  return (
    <div className={panel} aria-live="polite">
      <p className="font-bold">
        🔎 Identified: {result.indonesianName || result.commonName} — {result.commonName} (<i>{result.latinName}</i>) ·{" "}
        <span className={low ? "text-clay" : "text-leaf"}>{pct(result.confidence)}</span>
      </p>
      {low && <p className="mt-1 text-clay">Low confidence — check the alternatives or correct the species below.</p>}
      <div className="mt-2 flex flex-wrap gap-1">
        {result.iucnStatus && <span className="border-2 border-ink bg-cream px-2 py-0.5 text-xs font-bold">IUCN: {result.iucnStatus}</span>}
        {result.sexAgeHint && <span className="border-2 border-ink bg-cream px-2 py-0.5 text-xs">{result.sexAgeHint}</span>}
        {result.keyFeatures.map((f) => (
          <span key={f} className="border-2 border-line bg-cream px-2 py-0.5 text-xs">
            {f}
          </span>
        ))}
      </div>
      {result.alternatives.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          Alternatives:{" "}
          {result.alternatives.map((a) => `${a.name} (${a.latinName}) ${pct(a.confidence)}`).join(" · ")}
        </p>
      )}
      {result.notes && <p className="mt-1 text-xs text-muted">{result.notes}</p>}
      {result.protectedInIndonesia && (
        <p className="mt-2 border-[3px] border-clay bg-clay/10 p-2 font-bold text-clay" role="alert">
          🛡️ Protected species in Indonesia — Kicau records pedigree only; it never supports trading wild-caught birds.
        </p>
      )}
    </div>
  );
}

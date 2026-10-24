"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePublicClient } from "wagmi";
import { type BirdHistory, type ValuePoint, fetchBirdHistory } from "@/lib/birdHistory";
import { EXPLORER, KICAU_ADDRESS } from "@/lib/config";

/** Shared react-query hook: one scan per bird, reused by BirdProof and OwnerDashboard. */
export function useBirdHistory(tokenId: bigint) {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["birdHistory", KICAU_ADDRESS, String(tokenId)],
    enabled: !!client && !!KICAU_ADDRESS,
    staleTime: 20_000,
    queryFn: () => fetchBirdHistory(client!, tokenId),
  });
}

const ICON: Record<string, string> = { registered: "🐣", updated: "✎", supported: "♥", attested: "🏅", revoked: "✕", run: "✈", contest: "🏆", cancelled: "∅" };
const when = (t: number) => new Date(t * 1000).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

/** Viewer side: Kicau Value over time + clickable on-chain proof of everything that moved it. */
export function BirdProof({ tokenId }: { tokenId: bigint }) {
  const { data: h, isLoading, error } = useBirdHistory(tokenId);
  return (
    <section className="mt-4 border-[3px] border-ink bg-paper p-3 text-sm">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-display text-xs">Proof &amp; value history</span>
        {h && (
          <span className={`text-xs font-bold ${h.matches ? "text-leaf" : "text-clay"}`} title={`Reconstructed ${h.reconstructed} pts vs valueOf ${h.onchain.points} pts at block ${h.headBlock}`}>
            {h.matches ? "✓ matches contract" : `⚠ reconstructed ${h.reconstructed} ≠ contract ${h.onchain.points}`}
          </span>
        )}
      </div>
      {isLoading ? (
        <p className="text-muted">Reading this bird&apos;s events from chain…</p>
      ) : error || !h ? (
        <p className="text-clay">Couldn&apos;t read the history right now ({(error as Error | null)?.message?.slice(0, 80) ?? "RPC"}).</p>
      ) : (
        <>
          <ValueChart h={h} />
          <p className="mb-3 mt-1 text-xs text-muted">
            Kicau Value, reconstructed from on-chain events with the contract&apos;s own formula ({h.chunks} log windows scanned, block{" "}
            {String(h.scannedFrom)} → {String(h.headBlock)}).
          </p>
          <ol className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {[...h.events].reverse().map((e) => (
              <li key={`${e.txHash}-${e.kind}-${e.label}`} className="flex gap-2 border-b border-line pb-1 last:border-0">
                <span aria-hidden className="w-5 shrink-0 text-center">{ICON[e.kind]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <a href={`${EXPLORER}/tx/${e.txHash}`} target="_blank" rel="noreferrer" className="break-words font-semibold underline">
                      {e.label}
                    </a>
                    {e.pointsDelta !== 0 && (
                      <span className={`text-xs font-bold ${e.pointsDelta > 0 ? "text-leaf" : "text-clay"}`}>
                        {e.pointsDelta > 0 ? `▲ +${e.pointsDelta}` : `▼ ${e.pointsDelta}`}
                      </span>
                    )}
                  </div>
                  <div className="break-words text-xs text-muted">
                    {e.details} · {when(e.timestamp)}
                    {e.contestId !== undefined && (
                      <>
                        {" · "}
                        <Link href={`/lomba#${e.contestId}`} className="underline">
                          contest #{e.contestId}
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 border-t-[3px] border-dashed border-ink pt-2 text-xs text-muted">
            <b className="text-ink">Verify yourself:</b> open the{" "}
            <a href={`${EXPLORER}/address/${KICAU_ADDRESS}`} target="_blank" rel="noreferrer" className="font-mono underline">
              Kicau contract
            </a>{" "}
            on MonadVision → Read contract, then call <code>valueBreakdown({String(tokenId)})</code> for the score,{" "}
            <code>attestationsOf({String(tokenId)})</code> for titles, <code>entriesOf(contestId)</code> and{" "}
            <code>judgeScoreOf(contestId, {String(tokenId)}, judge)</code> for contest scores. Every row above links to its transaction.
          </p>
        </>
      )}
    </section>
  );
}

/** Pixel step chart, one step per sample (events + decay days + now), ▲/▼ at events. No chart lib. */
function ValueChart({ h }: { h: BirdHistory }) {
  const pts: ValuePoint[] = h.timeline;
  const W = 320;
  const H = 72;
  const pad = 8;
  const max = Math.max(...pts.map((p) => p.points), 100);
  const step = (W - pad * 2) / Math.max(pts.length - 1, 1);
  const x = (i: number) => pad + i * step;
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2 - 8);
  let d = `M${x(0)},${y(pts[0].points)}`;
  for (let i = 1; i < pts.length; i++) d += ` H${x(i)} V${y(pts[i].points)}`;
  const first = pts[0]?.points ?? 0;
  const last = pts.at(-1)?.points ?? 0;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full border-2 border-ink bg-cream" role="img" aria-label={`Kicau Value from ${first} to ${last} points`} shapeRendering="crispEdges">
        <line x1={pad} x2={W - pad} y1={y(100)} y2={y(100)} stroke="var(--line)" strokeDasharray="4 4" />
        <path d={d} fill="none" stroke="var(--leaf)" strokeWidth={3} />
        {pts.map((p, i) => {
          if (p.event === undefined) return null;
          const delta = h.events[p.event].pointsDelta;
          if (!delta) return <rect key={i} x={x(i) - 2} y={y(p.points) - 2} width={4} height={4} fill="var(--ink)" />;
          return (
            <text key={i} x={x(i)} y={y(p.points) + (delta > 0 ? -4 : 12)} textAnchor="middle" fontSize={10} fill={delta > 0 ? "var(--leaf)" : "var(--clay)"}>
              {delta > 0 ? "▲" : "▼"}
            </text>
          );
        })}
        <text x={W - pad} y={12} textAnchor="end" fontSize={10} fill="var(--ink)" fontWeight="bold">
          {last} pts
        </text>
      </svg>
      <figcaption className="sr-only">Step chart of the bird&apos;s Kicau Value at each on-chain event and now.</figcaption>
    </figure>
  );
}

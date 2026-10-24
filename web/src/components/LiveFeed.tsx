"use client";

import { useEffect, useState } from "react";
import { short } from "@/components/ui";
import { EXPLORER, KICAU_ADDRESS } from "@/lib/config";
import { type LiveItem, type Mode, type Status, startLive } from "@/lib/live";

const ICON: Record<LiveItem["kind"], string> = {
  BirdBought: "🐣",
  Supported: "💚",
  ScoreSubmitted: "🏆",
  BirdRegistered: "📝",
  Attested: "🏅",
  BirdSupported: "💚",
  BirdUpdated: "🖼️",
  AttestationRevoked: "🚫",
  ContestCreated: "🎪",
  ContestEntered: "🐦",
  JudgingStarted: "⚖️",
  Scored: "📋",
  ContestFinalized: "🥇",
  ContestCancelled: "↩️",
  PayoutOwed: "⏳",
};

const BADGE: Record<Status, string> = {
  Proposed: "bg-sun/30 text-ink",
  Voted: "bg-sun text-ink",
  Finalized: "bg-leaf text-paper",
  Verified: "bg-leaf-dark text-paper",
  Abandoned: "bg-clay text-paper line-through",
};

const MODE_LABEL: Record<Mode, string> = {
  connecting: "connecting…",
  monadLogs: "monadLogs · speculative",
  "eth logs": "eth logs",
  polling: "polling",
};

export function LiveFeed() {
  const [items, setItems] = useState<LiveItem[]>([]);
  const [mode, setMode] = useState<Mode>("connecting");

  useEffect(() => {
    if (!KICAU_ADDRESS) return;
    return startLive(KICAU_ADDRESS, (list, m) => {
      setItems(list);
      setMode(m);
    });
  }, []);

  if (!KICAU_ADDRESS) return null;

  return (
    <section className="mb-10 rounded-3xl border border-line bg-paper p-4 sm:p-6" aria-live="polite">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-2xl">
          <span className={`inline-block h-3 w-3 bg-clay ${mode === "connecting" ? "opacity-40" : "animate-pulse"}`} />
          LIVE KICAU
        </h2>
        <span className="border-2 border-ink bg-cream px-2 py-1 font-display text-[0.6rem] uppercase">
          {MODE_LABEL[mode]}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted">Waiting for on-chain chirps… adopt, support, play, register or run a contest to show up here.</p>
      ) : (
        <ul className="grid gap-2">
          {items.map((it) => (
            <li
              key={it.key}
              className={`grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 border-2 border-ink bg-cream px-3 py-2 text-sm ${it.status === "Abandoned" ? "opacity-60" : ""}`}
            >
              <span className="text-lg" aria-hidden>
                {ICON[it.kind]}
              </span>
              <div className="min-w-0">
                <div className="truncate font-semibold">{it.label}</div>
                <div className="flex flex-wrap gap-x-2 text-xs text-muted">
                  {!/^0x0+$/.test(it.actor) && <span className="font-mono">{short(it.actor)}</span>}
                  <span>#{it.blockNumber.toString()}</span>
                  <a href={`${EXPLORER}/tx/${it.txHash}`} target="_blank" rel="noreferrer" className="text-leaf underline">
                    tx ↗
                  </a>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`px-1.5 py-0.5 font-display text-[0.55rem] uppercase ${BADGE[it.status]}`}>
                  {it.status === "Abandoned" ? "reorg" : it.status}
                </span>
                <span className="text-xs tabular-nums text-muted">
                  {it.finalMs !== undefined ? `${it.finalMs} ms` : it.status === "Abandoned" || it.backfill ? "—" : "…"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted">
        Shows up while the block is still <b>Proposed</b>; ms = time until <b>Finalized</b>.
      </p>
    </section>
  );
}

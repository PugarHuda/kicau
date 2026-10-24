"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { useReadContract, useReadContracts } from "wagmi";
import { ContestDetail, StatusChip } from "@/components/lomba/ContestDetail";
import { HostForm } from "@/components/lomba/HostForm";
import { MyBirds } from "@/components/lomba/MyBirds";
import { TxLink, short } from "@/components/ui";
import { KICAU_ADDRESS } from "@/lib/config";
import { NET } from "@/lib/network";
import { NetworkToggle } from "@/components/NetworkToggle";
import { isTestEntity } from "@/lib/customBirds";
import { STATUS } from "@/lib/contestLive";
import { type Kicau, kicau, useKicau } from "@/lib/useKicau";

const enabled = Boolean(KICAU_ADDRESS);

/** On-chain gantangan contests: host, enter, judge live, finalize with automatic payouts. */
export default function Lomba() {
  const k = useKicau();
  const [sel, setSel] = useState<number | null>(null);

  // #<id> deep links (shareable on stage)
  useEffect(() => {
    const read = () => {
      const n = Number(location.hash.slice(1));
      setSel(location.hash.length > 1 && Number.isInteger(n) ? n : null);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const open = (id: number | null) => {
    location.hash = id === null ? "" : String(id);
    setSel(id);
    window.scrollTo({ top: 0 });
  };

  const { data: count } = useReadContract({ ...kicau, functionName: "contestCount", query: { enabled, refetchInterval: 10_000 } });
  const ids = Array.from({ length: Math.min(Number(count ?? 0n), 30) }, (_, i) => BigInt(Number(count) - 1 - i)); // newest 30
  const { data: contests } = useReadContracts({
    contracts: ids.map((id) => ({ ...kicau, functionName: "getContest", args: [id] }) as const),
    query: { enabled: ids.length > 0, refetchInterval: 10_000 },
  });

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-4 sm:py-6">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/" className="btn-ghost !px-2 !py-2 !text-[0.6rem]" aria-label="Home">
          ←<span className="hidden sm:inline"> Home</span>
        </Link>
        {sel !== null && (
          <button className="btn-ghost !px-2 !py-2 !text-[0.6rem]" onClick={() => open(null)}>
            All contests
          </button>
        )}
        <span className="min-w-0 flex-1 truncate font-display text-xs">Contests</span>
        <span className="max-sm:hidden"><NetworkToggle /></span>{/* ponytail: hidden on phones so the header stays one row */}
        <Link href="/me" className="btn-ghost !px-2 !py-2 !text-[0.6rem]" title="My Dashboard" aria-label="My Dashboard">
          <span className="sm:hidden">Me</span><span className="hidden sm:inline">My Dashboard</span>
        </Link>
        {!k.address ? (
          <button className="btn-primary !px-2 !py-2 !text-[0.6rem]" disabled={k.funding} onClick={NET.faucet ? k.quickPlay : k.connectWallet}>
            {NET.faucet ? (k.funding ? "Setting up…" : "⚡ Quick Play") : "Connect wallet"}
          </button>
        ) : (
          <span className="text-xs text-muted" title={k.address}>
            {k.burner ? "⚡ " : ""}
            {short(k.address)}
          </span>
        )}
        {!k.address && NET.faucet && (
          <button className="btn-ghost !px-2 !py-2 !text-[0.6rem]" disabled={k.connecting} onClick={k.connectWallet}>
            Wallet
          </button>
        )}
      </header>

      {(k.error || k.lastTx) && (
        <div className="mb-4 flex flex-wrap items-center gap-2 border-[3px] border-ink bg-paper px-3 py-2 text-sm" role="status">
          {k.error ? (
            <span className="line-clamp-3 text-clay">{k.error}</span>
          ) : (
            <>
              <span className="font-semibold">✓ Confirmed{k.lastMs !== undefined && <span className="tabular-nums"> in {k.lastMs} ms</span>}</span>
              <TxLink hash={k.lastTx} />
            </>
          )}
          {k.error && (
            <button className="ml-auto text-muted" onClick={() => k.setError(undefined)} aria-label="Close">
              ×
            </button>
          )}
        </div>
      )}
      <OwedBanner k={k} />
      {k.wrongChain && !k.burner && (
        <button className="btn-ghost mb-4" onClick={k.switchToMonad}>
          Switch to {NET.label}
        </button>
      )}

      {!enabled ? (
        <p className="text-clay">NEXT_PUBLIC_KICAU_ADDRESS is not set.</p>
      ) : sel !== null ? (
        <ContestDetail key={sel} id={sel} k={k} />
      ) : (
        <div className="space-y-6">
          <section>
            <h1 className="mb-1 font-display text-3xl">Songbird contests</h1>
            <p className="mb-4 text-muted">
              The official record for real-life gantangan contests. Judges score at the venue from their phones; every score per
              aspect is public on-chain the moment it&apos;s cast, the live scoreboard updates for the crowd, and prizes pay out
              automatically to the winners&apos; keepers.
            </p>
            {count === undefined ? (
              <p className="text-muted">Loading from chain…</p>
            ) : !ids.length ? (
              <p className="text-muted">No contests yet. Host the first one below.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {ids.map((id, i) => {
                  const c = contests?.[i]?.result;
                  if (!c) return <li key={String(id)} className="h-28 animate-pulse rounded-3xl border border-line bg-paper" />;
                  // curation: hide QA/test contests from the public list, except the connected wallet's own
                  if (isTestEntity(c.name) && c.host.toLowerCase() !== k.address?.toLowerCase()) return null;
                  const closed = Number(c.entryDeadline) * 1000 < Date.now();
                  return (
                    <li key={String(id)}>
                      <button
                        onClick={() => open(Number(id))}
                        className="w-full rounded-3xl border border-line bg-paper p-4 text-left transition hover:-translate-y-1 hover:shadow-lg"
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <StatusChip status={STATUS[c.status]} />
                          <span className="border-[3px] border-ink bg-cream px-2 py-0.5 text-xs font-bold">{c.class_}</span>
                          <span className="ml-auto text-xs tabular-nums text-muted">#{String(id)}</span>
                        </div>
                        <div className="mb-2 break-words font-display text-sm">{c.name}</div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                          <span>
                            Pool <b className="tabular-nums text-ink">{formatEther(c.status >= 2 ? c.entryFee * c.entryCount : c.pool)} MON</b>
                          </span>
                          <span className="tabular-nums">{String(c.entryCount)} entries</span>
                          <span>Host {short(c.host)}</span>
                          <span className="tabular-nums">
                            {c.status === 0 ? (closed ? "Entries closed" : "Closes ") : "Closed "}
                            {(c.status !== 0 || !closed) &&
                              new Date(Number(c.entryDeadline) * 1000).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <HostForm k={k} onCreated={open} />
          <MyBirds k={k} />
        </div>
      )}
    </main>
  );
}

/** Prizes/refunds whose direct push failed sit in `owed`; this is the claim path (withdrawOwed). */
function OwedBanner({ k }: { k: Kicau }) {
  const { data: owed } = useReadContract({ ...kicau, functionName: "owed", args: k.address ? [k.address] : undefined, query: { enabled: !!k.address, refetchInterval: 15_000 } });
  if (!owed) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 border-[3px] border-ink bg-sun/30 px-3 py-2 text-sm" role="status">
      <span>
        <b className="tabular-nums">{formatEther(owed)} MON</b> in prizes/refunds is waiting for you (the automatic transfer to your address failed).
      </span>
      <button className="btn-primary ml-auto !py-1" disabled={k.txBusy || !k.ready} onClick={() => k.send({ functionName: "withdrawOwed", args: [] })}>
        Claim
      </button>
    </div>
  );
}

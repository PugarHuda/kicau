"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatEther, zeroAddress } from "viem";
import { useBalance, usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { birdHistoryQuery, ValueChart } from "@/components/BirdProof";
import { KicauValue } from "@/components/lomba/KicauValue";
import { NetworkToggle } from "@/components/NetworkToggle";
import { keeperEarned } from "@/components/OwnerDashboard";
import { Badges, BirdProfileCard } from "@/components/RegisteredBirds";
import { type Species, Modal, TxLink, short } from "@/components/ui";
import { type BirdHistory, fmtMon } from "@/lib/birdHistory";
import { EXPLORER, KICAU_ADDRESS } from "@/lib/config";
import { rankEntries, STATUS } from "@/lib/contestLive";
import { CUSTOM_SPECIES, type CustomBird, fetchCustomBird } from "@/lib/customBirds";
import { NET } from "@/lib/network";
import { fmtUsd, useMonUsd } from "@/lib/price";
import { kicau, type Kicau, useKicau } from "@/lib/useKicau";

const SM = "!px-2 !py-2 !text-[0.6rem]";
const MAX_CONTESTS = 30;
const PAST_WEEKS = 12;
const box = "border-[3px] border-ink bg-paper p-3";
const eq = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

function Mon({ wei, usd }: { wei?: bigint; usd?: { usd: number } }) {
  if (wei === undefined) return <span className="tabular-nums">…</span>;
  const u = fmtUsd(Number(formatEther(wei)), usd);
  return (
    <span className="tabular-nums">
      {fmtMon(wei) || "0"} MON{u && <span className="text-xs font-normal text-muted"> {u}</span>}
    </span>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={`${box} min-w-0`}>
      <div className="font-display text-[0.6rem] text-muted">{label}</div>
      <div className="mt-1 break-words text-sm font-bold">{children}</div>
    </div>
  );
}

export default function MyDashboard() {
  const k = useKicau();
  const me = k.address;
  const client = usePublicClient();
  const monUsd = useMonUsd();
  const on = !!me;

  // ---- wallet + NFTs
  const { data: balance } = useBalance({ address: me, query: { enabled: on, refetchInterval: 15_000 } });
  const { data: ids } = useReadContract({ ...kicau, functionName: "tokensOf", args: me ? [me] : undefined, query: { enabled: on } });
  const { data: perToken } = useReadContracts({
    contracts: (ids ?? []).flatMap((t) => [
      { ...kicau, functionName: "speciesOf", args: [t] } as const,
      { ...kicau, functionName: "bestByToken", args: [t] } as const,
      { ...kicau, functionName: "valueOf", args: [t] } as const,
    ]),
    query: { enabled: !!ids?.length },
  });
  const tokens = (ids ?? []).map((t, i) => ({
    id: t,
    species: perToken?.[i * 3]?.result as bigint | undefined,
    best: perToken?.[i * 3 + 1]?.result as bigint | undefined,
    value: (perToken?.[i * 3 + 2]?.result as readonly [bigint, bigint] | undefined)?.[1],
  }));
  const custom = tokens.filter((t) => t.species === BigInt(CUSTOM_SPECIES));
  const adopted = tokens.filter((t) => t.species !== undefined && t.species !== BigInt(CUSTOM_SPECIES));
  const customIds = custom.map((t) => t.id);
  // same key + fn as MyBirds on /lomba → shared cache
  const { data: birds, isLoading: birdsLoading } = useQuery({
    queryKey: ["myBirdsPanel", KICAU_ADDRESS, customIds.map(String)],
    enabled: !!client && customIds.length > 0,
    queryFn: async () => (await Promise.all(customIds.map((t) => fetchCustomBird(client!, KICAU_ADDRESS, t).catch(() => null)))).filter((b) => !!b),
  });
  const { data: speciesRaw } = useReadContract({ ...kicau, functionName: "getAllSpecies" });
  const speciesList = (speciesRaw ?? []) as readonly Species[];

  // ---- per-bird history (shared with BirdProof / OwnerDashboard cache)
  const histories = useQueries({ queries: customIds.map((t) => birdHistoryQuery(client, t)) });
  const hist = new Map<string, BirdHistory>();
  customIds.forEach((t, i) => histories[i]?.data && hist.set(String(t), histories[i].data!));
  const histLoading = histories.some((q) => q.isLoading);
  const meL = me?.toLowerCase() ?? "";
  const earned = [...hist.values()].reduce(
    (a, h) => {
      const e = keeperEarned(h, meL);
      return { support: a.support + e.supportEarned, prize: a.prize + e.prizeEarned };
    },
    { support: 0n, prize: 0n },
  );
  const totalValue = custom.reduce((a, t) => a + (t.value ?? 0n), 0n);

  // ---- claimable + scores + weekly
  const { data: reads } = useReadContracts({
    contracts: [
      { ...kicau, functionName: "owed", args: [me ?? zeroAddress] },
      { ...kicau, functionName: "bestValidatedByPlayer", args: [me ?? zeroAddress] },
      { ...kicau, functionName: "currentWeek" },
      { ...kicau, functionName: "contestCount" },
    ],
    query: { enabled: on, refetchInterval: 15_000 },
  });
  const owed = reads?.[0]?.result as bigint | undefined;
  const bestVerified = reads?.[1]?.result as bigint | undefined;
  const week = reads?.[2]?.result as bigint | undefined;
  const contestCount = reads?.[3]?.result as bigint | undefined;
  const weeks = useMemo(() => (week === undefined ? [] : Array.from({ length: PAST_WEEKS + 1 }, (_, i) => week - BigInt(i)).filter((w) => w > 0n)), [week]);
  const { data: weekRows } = useReadContracts({
    contracts: weeks.flatMap((w) => [
      { ...kicau, functionName: "weeklyLeader", args: [w] } as const,
      { ...kicau, functionName: "weeklyPool", args: [w] } as const,
      { ...kicau, functionName: "weeklyClaimed", args: [w] } as const,
    ]),
    query: { enabled: weeks.length > 0, refetchInterval: 15_000 },
  });
  const weekInfo = weeks.map((w, i) => ({
    week: w,
    leader: (weekRows?.[i * 3]?.result as readonly [string, bigint] | undefined)?.[0],
    pool: weekRows?.[i * 3 + 1]?.result as bigint | undefined,
    claimed: weekRows?.[i * 3 + 2]?.result as boolean | undefined,
  }));
  const { data: board } = useReadContract({ ...kicau, functionName: "getWeeklyLeaderboard", args: [week ?? 0n], query: { enabled: week !== undefined } });
  const weeklyRank = useMemo(() => {
    if (!board || !me) return undefined;
    const rows = board[0].map((p, i) => ({ p, s: board[1][i] })).filter((r) => r.s > 0n);
    rows.sort((a, b) => (b.s > a.s ? 1 : b.s < a.s ? -1 : 0));
    const i = rows.findIndex((r) => eq(r.p, me));
    return { rank: i >= 0 ? i + 1 : null, of: rows.length };
  }, [board, me]);
  const myWins = weekInfo.filter((w) => w.week !== week && eq(w.leader, me));

  // ---- contests (newest MAX_CONTESTS)
  const cids = useMemo(() => {
    const n = Number(contestCount ?? 0n);
    return Array.from({ length: Math.min(n, MAX_CONTESTS) }, (_, i) => BigInt(n - 1 - i));
  }, [contestCount]);
  const { data: cRows } = useReadContracts({
    contracts: cids.flatMap((c) => [
      { ...kicau, functionName: "getContest", args: [c] } as const,
      { ...kicau, functionName: "entriesOf", args: [c] } as const,
      { ...kicau, functionName: "isJudge", args: [c, me ?? zeroAddress] } as const,
    ]),
    query: { enabled: on && cids.length > 0, refetchInterval: 20_000 },
  });
  const contests = cids.map((id, i) => {
    const c = cRows?.[i * 3]?.result as { name: string; host: string; status: number; pool: bigint; entryCount: bigint } | undefined;
    const e = cRows?.[i * 3 + 1]?.result as readonly [readonly bigint[], readonly bigint[]] | undefined;
    return { id, c, tokens: e?.[0] ?? [], totals: e?.[1] ?? [], judge: cRows?.[i * 3 + 2]?.result === true };
  });
  const entryPairs = contests.flatMap((x) => x.tokens.map((t) => [x.id, t] as const));
  const { data: entrants } = useReadContracts({
    contracts: entryPairs.map(([c, t]) => ({ ...kicau, functionName: "entrantOf", args: [c, t] }) as const),
    query: { enabled: entryPairs.length > 0 },
  });
  const mine = contests
    .map((x) => {
      const ranked = rankEntries(x.tokens.map((t, index) => ({ t, total: x.totals[index], index })));
      const myEntries = x.tokens.filter((t) => {
        const j = entryPairs.findIndex(([c, tt]) => c === x.id && tt === t);
        return eq(entrants?.[j]?.result as string | undefined, me);
      });
      const roles = [eq(x.c?.host, me) && "Host", x.judge && "Judge", myEntries.length > 0 && "Entrant"].filter(Boolean) as string[];
      const results = myEntries.map((t) => {
        const rank = ranked.findIndex((r) => r.t === t) + 1;
        // finalize zeroes c.pool → the prize comes from the bird's ContestFinalized log
        const prize = hist.get(String(t))?.events.find((e) => e.kind === "contest" && e.contestId === Number(x.id))?.prizeWei;
        return { t, rank, prize };
      });
      return { ...x, roles, results };
    })
    .filter((x) => x.roles.length > 0);
  const entered = mine.filter((x) => x.roles.includes("Entrant")).length;
  const won = mine.filter((x) => x.c?.status === 2 && x.results.some((r) => r.rank === 1)).length;
  const contestsLoading = contestCount === undefined || (cids.length > 0 && !cRows);

  const [open, setOpen] = useState<CustomBird | null>(null);

  return (
    <main className="mx-auto min-h-screen max-w-5xl overflow-x-hidden px-4 py-4 sm:py-6">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/" className={`btn-ghost ${SM}`} aria-label="Home">
          ←<span className="hidden sm:inline"> Home</span>
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-display text-xs">My Dashboard</h1>
        <NetworkToggle />
        {!me && <ConnectButtons k={k} />}
      </header>

      {k.wrongChain && (
        <button className={`btn-primary mb-3 bg-clay ${SM}`} onClick={k.switchToMonad}>
          Switch to {NET.chain.name}
        </button>
      )}
      {(k.error || k.lastTx) && (
        <div className="mb-4 flex flex-wrap items-center gap-2 border-[3px] border-ink bg-paper px-3 py-2 text-sm" role="status">
          {k.error ? <span className="text-clay">{k.error}</span> : <TxLink hash={k.lastTx} />}
        </div>
      )}

      {!me ? (
        <section className={`${box} text-sm`}>
          <p>Connect to see your birds, earnings, contests and rewards — all read live from the Kicau contract.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ConnectButtons k={k} />
          </div>
        </section>
      ) : (
        <>
          <section className={`${box} mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm`}>
            <a href={`${EXPLORER}/address/${me}`} target="_blank" rel="noreferrer" className="font-mono underline" title={me}>
              {k.burner ? "⚡ " : ""}
              {short(me)} ↗
            </a>
            <span>
              Balance: <b><Mon wei={balance?.value} usd={monUsd} /></b>
            </span>
          </section>

          {/* summary */}
          <section className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Tile label="Kicau Value (my birds)">
              <Mon wei={perToken || !ids?.length ? totalValue : undefined} usd={monUsd} />
              <div className="text-xs font-normal text-muted tabular-nums">{custom.length} registered bird{custom.length === 1 ? "" : "s"}</div>
            </Tile>
            <Tile label="Earned as keeper">
              {histLoading ? "…" : <Mon wei={earned.support + earned.prize} usd={monUsd} />}
              <div className="text-xs font-normal text-muted tabular-nums">
                {fmtMon(earned.support) || "0"} support (70%) + {fmtMon(earned.prize) || "0"} prizes
              </div>
            </Tile>
            <Tile label="Claimable">
              <Mon wei={owed} usd={monUsd} />
              {!!owed && owed > 0n && (
                <button className={`btn-primary mt-1 ${SM}`} disabled={k.txBusy || !k.ready} onClick={() => k.send({ functionName: "withdrawOwed", args: [] })}>
                  {k.txBusy ? "Sending…" : "Withdraw"}
                </button>
              )}
            </Tile>
            <Tile label="Best verified score">
              <span className="tabular-nums">{bestVerified === undefined ? "…" : String(bestVerified)}</span>
              <div className="text-xs font-normal text-muted tabular-nums">
                This week: {weeklyRank?.rank ? `#${weeklyRank.rank} of ${weeklyRank.of}` : "not ranked yet"} · pool{" "}
                {weekInfo[0]?.pool !== undefined ? `${fmtMon(weekInfo[0].pool) || "0"} MON` : "…"}
              </div>
            </Tile>
            <Tile label="Contests">
              <span className="tabular-nums">{contestsLoading ? "…" : `${entered} entered · ${won} won`}</span>
              <div className="text-xs font-normal text-muted">newest {MAX_CONTESTS} contests</div>
            </Tile>
          </section>

          {/* registered birds */}
          <Section title="My registered birds">
            {!ids || (custom.length > 0 && birdsLoading) ? (
              <p className="text-sm text-muted">Reading your birds from chain…</p>
            ) : !custom.length ? (
              <Empty text="No registered birds yet.">
                <Link href="/" className={`btn-primary ${SM}`}>Register your bird</Link>
                <Link href="/lomba" className={`btn-ghost ${SM}`}>Quick-register on Contests</Link>
              </Empty>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {(birds ?? []).map((b) => (
                  <li key={String(b.tokenId)} className={`${box} min-w-0`}>
                    <div className="flex items-start gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.image} alt={b.name} className="h-12 w-14 shrink-0 object-contain [image-rendering:pixelated]" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-display text-xs">
                          {b.name} <span className="tabular-nums">#{String(b.tokenId)}</span>
                        </div>
                        {typeof b.profile.species === "string" && b.profile.species && (
                          <div className="truncate text-xs text-muted">
                            {b.profile.species}
                            {b.profile.speciesSource !== "owner" && typeof b.profile.aiConfidence === "number"
                              ? ` · AI ${Math.round(b.profile.aiConfidence * 100)}%`
                              : " · owner-declared"}
                          </div>
                        )}
                        <KicauValue tokenId={b.tokenId} />
                        <Badges bird={b} />
                      </div>
                    </div>
                    <div className="mt-2">
                      {hist.get(String(b.tokenId)) ? <ValueChart h={hist.get(String(b.tokenId))!} /> : <p className="text-xs text-muted">Loading value history…</p>}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button className={`btn-primary ${SM}`} onClick={() => setOpen(b)}>Open profile</button>
                      <Link href="/lomba#my-birds" className={`btn-ghost ${SM}`}>Update my bird</Link>
                      <Link href="/lomba" className={`btn-ghost ${SM}`}>Enter a contest</Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* adopted species */}
          <Section title="My adopted species NFTs">
            {!ids || (ids.length > 0 && !perToken) ? (
              <p className="text-sm text-muted">Reading…</p>
            ) : !adopted.length ? (
              <Empty text="No adopted species yet.">
                <Link href="/" className={`btn-primary ${SM}`}>Adopt a bird</Link>
              </Empty>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {adopted.map((t) => (
                  <li key={String(t.id)} className={`${box} flex items-center gap-2 text-sm`}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{speciesList[Number(t.species)]?.name ?? `Species ${String(t.species)}`}</div>
                      <div className="text-xs text-muted tabular-nums">
                        NFT #{String(t.id)} · best {t.best === undefined ? "…" : String(t.best)}
                      </div>
                    </div>
                    <Link href="/taman" className={`btn-primary ${SM}`}>Fly</Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* contests */}
          <Section title="My contests">
            {contestsLoading ? (
              <p className="text-sm text-muted">Reading contests…</p>
            ) : !mine.length ? (
              <Empty text="You haven't hosted, judged or entered a contest yet.">
                <Link href="/lomba" className={`btn-primary ${SM}`}>Browse contests</Link>
              </Empty>
            ) : (
              <ul className="space-y-2">
                {mine.map((x) => (
                  <li key={String(x.id)} className={`${box} text-sm`}>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <Link href={`/lomba#${x.id}`} className="min-w-0 break-words font-semibold underline">
                        {x.c?.name ?? `#${x.id}`}
                      </Link>
                      <span className="text-xs tabular-nums text-muted">#{String(x.id)}</span>
                      <span className="border-2 border-ink px-1 text-xs">{STATUS[x.c?.status ?? 0]}</span>
                      <span className="text-xs font-bold">{x.roles.join(" · ")}</span>
                    </div>
                    <div className="mt-1 text-xs tabular-nums text-muted">
                      {String(x.c?.entryCount ?? 0n)} entries
                      {x.c && x.c.status < 2 && <> · pool {fmtMon(x.c.pool) || "0"} MON</>}
                      {x.results.map((r) => (
                        <span key={String(r.t)} className="text-ink">
                          {" · "}bird #{String(r.t)}: {x.c?.status === 3 ? "refunded" : `rank ${r.rank}/${x.tokens.length}`}
                          {x.c?.status === 2 && !!r.prize && <b> · won {fmtMon(r.prize)} MON</b>}
                        </span>
                      ))}
                    </div>
                    {(x.roles.includes("Host") || x.roles.includes("Judge")) && x.c && x.c.status < 2 && (
                      <Link href={`/lomba#${x.id}`} className={`btn-ghost mt-2 inline-block ${SM}`}>
                        {x.roles.includes("Judge") && x.c.status === 1 ? "Score entries" : "Manage contest"}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* weekly rewards */}
          <Section title="Weekly rewards">
            {!weekRows ? (
              <p className="text-sm text-muted">Reading…</p>
            ) : !myWins.length ? (
              <Empty text={`No weekly wins in the last ${PAST_WEEKS} weeks. Top the weekly board with a verified run to win the pool.`}>
                <Link href="/taman" className={`btn-primary ${SM}`}>Fly a verified run</Link>
              </Empty>
            ) : (
              <ul className="space-y-2">
                {myWins.map((w) => (
                  <li key={String(w.week)} className={`${box} flex flex-wrap items-center gap-2 text-sm`}>
                    <span className="flex-1 tabular-nums">
                      Week {String(w.week)} · <Mon wei={w.pool} usd={monUsd} />
                    </span>
                    {w.claimed ? (
                      <span className="text-xs font-bold text-leaf">✓ claimed</span>
                    ) : (
                      <button
                        className={`btn-primary ${SM}`}
                        disabled={k.txBusy || !k.ready}
                        onClick={() => k.send({ functionName: "claimWeeklyReward", args: [w.week] })}
                      >
                        {k.txBusy ? "Sending…" : "Claim"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}

      {open && (
        <Modal onClose={() => setOpen(null)}>
          <BirdProfileCard
            bird={open}
            me={me}
            busy={k.txBusy}
            onSupport={k.ready ? (tokenId, amount) => k.send({ functionName: "supportBird", args: [tokenId], value: amount }) : undefined}
          />
        </Modal>
      )}
    </main>
  );
}

function ConnectButtons({ k }: { k: Kicau }) {
  return (
    <>
      {NET.faucet && (
        <button className={`btn-primary ${SM}`} disabled={k.funding} onClick={k.quickPlay}>
          {k.funding ? "Setting up…" : "⚡ Quick Play"}
        </button>
      )}
      <button className={`btn-ghost ${SM}`} disabled={k.connecting} onClick={k.connectWallet}>
        {k.connecting ? "Connecting…" : "Connect wallet"}
      </button>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 font-display text-xs">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className={`${box} text-sm`}>
      <p className="text-muted">{text}</p>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

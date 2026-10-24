"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEther, parseEther, zeroAddress } from "viem";
import { useReadContract, useReadContracts } from "wagmi";
import { short } from "@/components/ui";
import { kicauAbi } from "@/lib/abi";
import { KICAU_ADDRESS } from "@/lib/config";
import { fmtUsd, useMonUsd } from "@/lib/price";

const kicau = { address: KICAU_ADDRESS, abi: kicauAbi } as const;
const WEEK = 604_800;
// Weeks start Monday 00:00 UTC on-chain: week = (t + 3 days) / 1 weeks
const weekEnd = (w: bigint) => Number(w + 1n) * WEEK - 3 * 86_400;
const FUND_PRESETS = ["0.01", "0.05"] as const;
type Tab = "daily" | "weekly" | "all";
type Row = { player: string; score: number };

function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function countdown(sec: number) {
  if (sec <= 0) return "ended";
  const d = Math.floor(sec / 86_400);
  const h = Math.floor((sec % 86_400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

const top10 = (players: readonly string[], scores: readonly bigint[]): Row[] =>
  players
    .map((p, i) => ({ player: p, score: Number(scores[i]) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

const mon = (wei?: bigint) =>
  wei === undefined
    ? "…"
    : Number(formatEther(wei)).toLocaleString(undefined, {
        maximumFractionDigits: 4,
      });

export function Leaderboards({
  me,
  busy,
  canWrite,
  onFund,
  onClaim,
  onRollover,
  onPlay,
}: {
  me?: string;
  busy?: boolean;
  canWrite?: boolean;
  onFund: (amount: bigint) => unknown;
  onClaim: (week: bigint) => unknown;
  onRollover: (week: bigint) => unknown;
  onPlay?: () => unknown;
}) {
  const [tab, setTab] = useState<Tab>("weekly");
  const enabled = Boolean(KICAU_ADDRESS);
  const now = useNow();
  const price = useMonUsd();
  const poll = { enabled, refetchInterval: 15_000 } as const;

  const { data: periods } = useReadContracts({
    contracts: [
      { ...kicau, functionName: "currentDay" },
      { ...kicau, functionName: "currentWeek" },
    ],
    query: poll,
  });
  const day = periods?.[0]?.result;
  const week = periods?.[1]?.result;
  const has = enabled && day !== undefined && week !== undefined;

  const { data: daily } = useReadContract({
    ...kicau,
    functionName: "getDailyLeaderboard",
    args: [day ?? 0n],
    query: { ...poll, enabled: has },
  });
  const { data: weekly } = useReadContract({
    ...kicau,
    functionName: "getWeeklyLeaderboard",
    args: [week ?? 0n],
    query: { ...poll, enabled: has },
  });
  const { data: all } = useReadContract({
    ...kicau,
    functionName: "getLeaderboardV2",
    query: { ...poll, enabled },
  });

  const past = useMemo(
    () =>
      week === undefined
        ? []
        : [1n, 2n, 3n].filter((k) => week > k).map((k) => week - k),
    [week],
  );
  const { data: info } = useReadContracts({
    contracts: [week ?? 0n, ...past].flatMap((w) => [
      { ...kicau, functionName: "weeklyLeader", args: [w] } as const,
      { ...kicau, functionName: "weeklyPool", args: [w] } as const,
      { ...kicau, functionName: "weeklyClaimed", args: [w] } as const,
    ]),
    query: { ...poll, enabled: has },
  });
  const weekInfo = (i: number) => {
    const leader = info?.[i * 3]?.result as
      readonly [string, bigint] | undefined;
    return {
      leader:
        leader && leader[0] !== zeroAddress
          ? { player: leader[0], score: Number(leader[1]) }
          : null,
      pool: info?.[i * 3 + 1]?.result as bigint | undefined,
      claimed: info?.[i * 3 + 2]?.result as boolean | undefined,
    };
  };
  const cur = weekInfo(0);

  const rows: Row[] =
    tab === "daily"
      ? daily
        ? top10(daily[0], daily[1])
        : []
      : tab === "weekly"
        ? weekly
          ? top10(weekly[0], weekly[1])
          : []
        : all
          ? top10(all[0], all[2])
          : [];
  const allEmpty =
    !!daily &&
    !!weekly &&
    !!all &&
    !top10(daily[0], daily[1]).length &&
    !weekly[0].length &&
    !top10(all[0], all[2]).length;
  const poolMon = cur.pool !== undefined ? mon(cur.pool) : "…";
  const cta = (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-line bg-paper p-4">
      <span className="text-sm">
        This week&apos;s pool: <b className="tabular-nums">{poolMon} MON</b> ·
        play a verified run to take the lead
      </span>
      {onPlay && (
        <button
          className="btn-primary !py-1.5 text-sm"
          onClick={() => onPlay()}
        >
          ▶ Play
        </button>
      )}
    </div>
  );
  const isMe = (p: string) => !!me && p.toLowerCase() === me.toLowerCase();
  const left = week === undefined ? 0 : weekEnd(week) - now;
  const dayLeft = day === undefined ? 0 : Number(day + 1n) * 86_400 - now;

  // nothing anywhere yet: one compact invite instead of an empty board
  if (allEmpty && cur.pool === 0n) return <section>{cta}</section>;

  return (
    <section>
      <h2 className="mb-4 font-display text-3xl font-bold">Leaderboard</h2>
      <div
        role="tablist"
        className="mb-3 grid grid-cols-3 border border-line bg-paper font-display text-[0.65rem] uppercase"
      >
        {(
          [
            ["daily", "Daily"],
            ["weekly", "Weekly"],
            ["all", "All-time"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className={`px-2 py-3 ${tab === k ? "bg-ink text-paper" : "hover:bg-cream"}`}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {(tab === "weekly" || !!cur.pool) && (
        <div className="mb-3 border border-line bg-sun/20 p-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="eyebrow mb-1">Weekly prize pool</p>
              <p className="font-display text-2xl font-bold tabular-nums">
                {mon(cur.pool)} MON
                {cur.pool !== undefined &&
                  fmtUsd(Number(formatEther(cur.pool)), price) && (
                    <span className="ml-2 text-sm font-normal text-muted">
                      {fmtUsd(Number(formatEther(cur.pool)), price)}
                    </span>
                  )}
              </p>
            </div>
            <p className="text-right text-xs text-muted">
              Ends in
              <br />
              <span className="font-display text-sm text-ink tabular-nums">
                {countdown(left)}
              </span>
            </p>
          </div>
          <p className="mt-2 text-sm">
            Leader:{" "}
            {cur.leader ? (
              <span
                className={
                  isMe(cur.leader.player)
                    ? "font-semibold text-leaf"
                    : "font-mono"
                }
              >
                {isMe(cur.leader.player) ? "you" : short(cur.leader.player)} ·{" "}
                {cur.leader.score}
              </span>
            ) : (
              <span className="text-muted">
                nobody yet. Top verified run takes the pool.
              </span>
            )}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">Fund the pool:</span>
            {FUND_PRESETS.map((a) => (
              <button
                key={a}
                className="btn-ghost !py-1.5 text-sm"
                disabled={!canWrite || busy}
                onClick={() => onFund(parseEther(a))}
              >
                +{a} MON
              </button>
            ))}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        cta
      ) : (
        <ol className="divide-y divide-line rounded-3xl border border-line bg-paper">
          {rows.map((r, i) => (
            <li
              key={r.player}
              className={`flex items-center justify-between p-4 ${isMe(r.player) ? "bg-sun/15" : ""}`}
            >
              <span className="flex items-center gap-3">
                <span className="w-6 font-display text-lg font-bold text-muted">
                  {i + 1}
                </span>
                <span className="font-mono text-sm">{short(r.player)}</span>
                {isMe(r.player) && (
                  <span className="text-xs font-semibold text-leaf">you</span>
                )}
              </span>
              <span className="font-display text-xl font-bold tabular-nums">
                {r.score}
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-xs text-muted">
        ✔ verified: only seeded, time-checked on-chain runs count.
        {tab === "daily" &&
          ` Resets 00:00 UTC (in ${countdown(dayLeft).replace(/^0d /, "")}).`}
        {tab === "weekly" && " Weeks run Monday 00:00 UTC to Sunday."}
      </p>

      {tab === "weekly" && past.length > 0 && (
        <div className="mt-4">
          <p className="eyebrow mb-2">Past weeks</p>
          <ul className="divide-y divide-line border border-line bg-paper text-sm">
            {past.map((w, i) => {
              const p = weekInfo(i + 1);
              const mine = !!p.leader && isMe(p.leader.player);
              return (
                <li
                  key={String(w)}
                  className="flex flex-wrap items-center justify-between gap-2 p-3"
                >
                  <span>
                    <span className="text-muted">
                      Week of{" "}
                      {new Date((weekEnd(w) - WEEK) * 1000)
                        .toISOString()
                        .slice(0, 10)}
                    </span>
                    <br />
                    {p.leader ? (
                      <span
                        className={
                          mine ? "font-semibold text-leaf" : "font-mono"
                        }
                      >
                        👑 {mine ? "you" : short(p.leader.player)} ·{" "}
                        {p.leader.score}
                      </span>
                    ) : (
                      <span className="text-muted">no players</span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{mon(p.pool)} MON</span>
                    {p.leader && p.claimed && (
                      <span className="bg-leaf px-1.5 py-0.5 text-xs text-paper">
                        claimed
                      </span>
                    )}
                    {mine && p.claimed === false && (
                      <button
                        className="btn-primary !py-1.5 text-sm"
                        disabled={!canWrite || busy}
                        onClick={() => onClaim(w)}
                      >
                        Claim reward
                      </button>
                    )}
                    {!p.leader && !!p.pool && (
                      <button
                        className="btn-ghost !py-1.5 text-sm"
                        disabled={!canWrite || busy}
                        onClick={() => onRollover(w)}
                      >
                        Roll over →
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

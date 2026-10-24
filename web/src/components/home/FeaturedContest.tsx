"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { kicauAbi } from "@/lib/abi";
import { KICAU_ADDRESS } from "@/lib/config";
import { client, readContest } from "@/lib/publicData";

const base = { address: KICAU_ADDRESS, abi: kicauAbi } as const;

/** Latest contest in Judging (else the newest one), with a live top-3 read straight from chain. */
async function readFeatured() {
  const count = Number(await client.readContract({ ...base, functionName: "contestCount" }));
  if (!count) return null;
  const ids = Array.from({ length: Math.min(count, 20) }, (_, i) => BigInt(count - 1 - i)); // ponytail: newest 20 only
  const res = await client.multicall({ contracts: ids.map((id) => ({ ...base, functionName: "getContest", args: [id] }) as const), allowFailure: true });
  const judging = ids.find((_, i) => res[i].result?.status === 1);
  return readContest(judging ?? ids[0]);
}

const STATUS_STYLE: Record<string, string> = {
  Open: "bg-sun text-ink",
  Judging: "bg-clay text-paper",
  Finalized: "bg-leaf-dark text-paper",
  Cancelled: "bg-line text-ink",
};

export function useFeaturedContest() {
  return useQuery({ queryKey: ["featuredContest", KICAU_ADDRESS], enabled: !!KICAU_ADDRESS, refetchInterval: 10_000, queryFn: readFeatured });
}

export function FeaturedContest() {
  const { data: c, isLoading } = useFeaturedContest();

  return (
    <section className="band band-leaf py-14 text-paper">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr] lg:items-center">
        <div>
          <p className="eyebrow eyebrow-light mb-3">Featured contest</p>
          {c ? (
            <>
              <h2 className="mb-3 font-display text-3xl">{c.name}</h2>
              <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
                <span className={`px-2 py-1 font-display text-[0.55rem] uppercase ${STATUS_STYLE[c.status] ?? ""}`}>
                  {c.status === "Judging" && <span className="mr-1 inline-block h-2 w-2 animate-pulse bg-paper align-middle" />}
                  {c.status}
                </span>
                <span className="border-2 border-paper/40 px-2 py-0.5">{c.class}</span>
                <span className="border-2 border-paper/40 px-2 py-0.5 tabular-nums">{c.judges.length} {c.judges.length === 1 ? "judge" : "judges"}</span>
                <span className="border-2 border-paper/40 px-2 py-0.5 tabular-nums">Pool {Number(c.poolMon).toFixed(3)} MON</span>
              </div>
              <p className="mb-6 max-w-md text-paper/85">
                Each judge scores melody, volume, duration and style. Every score is a transaction, so the ranking below is read live from Monad.
              </p>
              <Link href={`/lomba#${c.id}`} className="btn bg-sun text-ink">
                Watch contest #{c.id} live →
              </Link>
            </>
          ) : (
            <>
              <h2 className="mb-3 font-display text-3xl">Contests on Monad</h2>
              <p className="mb-6 text-paper/85">{isLoading ? "Reading contests from chain…" : "No contest yet. Organizers can host one in Contests."}</p>
              <Link href="/lomba" className="btn bg-sun text-ink">
                Open contests →
              </Link>
            </>
          )}
        </div>

        {/* mini scoreboard */}
        <div className="scoreboard border-[3px] border-ink bg-ink p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between font-display text-[0.55rem] uppercase text-paper/60">
            <span>Top 3 · live</span>
            <span className="tabular-nums">{c ? `max ${c.maxTotal}` : ""}</span>
          </div>
          <ol className="flex flex-col gap-2">
            {(c?.entries.slice(0, 3) ?? []).map((e) => (
              <li key={e.tokenId} className="flex items-center gap-3 bg-[#2a3a2b] p-2">
                <span className={`grid h-8 w-8 shrink-0 place-items-center font-display text-xs text-ink ${["bg-sun", "bg-paper", "bg-[#d9a06b]"][e.rank - 1]}`}>{e.rank}</span>
                {e.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.image} alt="" className="h-9 w-12 shrink-0 object-contain" />
                ) : (
                  <span className="h-9 w-12 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-paper">
                    {e.name} <span className="text-paper/50">#{e.tokenId}</span>
                  </div>
                  <div className="mt-1 h-2 bg-paper/15">
                    <div className="h-full bg-sun" style={{ width: `${c && c.maxTotal ? Math.min(100, (e.total / c.maxTotal) * 100) : 0}%` }} />
                  </div>
                </div>
                <span className="led-num font-display tabular-nums">{e.total}</span>
              </li>
            ))}
            {c && c.entries.length === 0 && <li className="p-3 text-paper/70">No entries yet.</li>}
            {!c && [0, 1, 2].map((i) => <li key={i} className="h-[52px] animate-pulse bg-[#2a3a2b]" />)}
          </ol>
        </div>
      </div>
    </section>
  );
}

/** Hero CTA: deep-links to the contest being judged right now (falls back to the contests page). */
export function WatchLiveLink({ className, children }: { className?: string; children: React.ReactNode }) {
  const { data: c } = useFeaturedContest();
  return (
    <Link href={c ? `/lomba#${c.id}` : "/lomba"} className={className}>
      {children}
    </Link>
  );
}

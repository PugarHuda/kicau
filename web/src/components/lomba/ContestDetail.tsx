"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { formatEther } from "viem";
import { usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { KicauValue } from "@/components/lomba/KicauValue";
import { short } from "@/components/ui";
import { EXPLORER, KICAU_ADDRESS } from "@/lib/config";
import { ASPECTS, payouts, rankEntries, STATUS, watchContest } from "@/lib/contestLive";
import { CUSTOM_SPECIES, type CustomBird, fetchCustomBird } from "@/lib/customBirds";
import type { Mode } from "@/lib/live";
import { type BirdColors, encodeBird } from "@/lib/pixelate";
import { kicau, type Kicau } from "@/lib/useKicau";

type Fresh = { ms?: number; state?: string; label: string };
const MEDAL = ["🥇", "🥈", "🥉"];
const addrLink = (a: string) => `${EXPLORER}/address/${a}`;

export function ContestDetail({ id, k }: { id: number; k: Kicau }) {
  const cid = BigInt(id);
  const client = usePublicClient();
  const qc = useQueryClient();
  const me = k.address?.toLowerCase();

  // ---- live: monadLogs pushes Scored totals straight into the board; reads catch up shortly after
  const [mode, setMode] = useState<Mode>("connecting");
  const [overlay, setOverlay] = useState<Record<string, { total: bigint; at: number }>>({});
  const [fresh, setFresh] = useState<Fresh | null>(null);
  const sentAt = useRef<number | null>(null);
  const meRef = useRef(me);
  meRef.current = me;
  useEffect(() => {
    let refresh: ReturnType<typeof setTimeout>[] = [];
    const stop = watchContest(
      KICAU_ADDRESS,
      cid,
      (e) => {
        let label = e.eventName as string;
        if (e.eventName === "Scored") {
          const t = String(e.args.tokenId);
          setOverlay((o) => ({ ...o, [t]: { total: e.args.total as bigint, at: Date.now() } }));
          label = `#${t} total → ${e.args.total}`;
        }
        const mine = sentAt.current !== null && String(e.args.judge ?? "").toLowerCase() === meRef.current;
        setFresh({ ms: mine ? Math.round(e.at - sentAt.current!) : undefined, state: e.commitState, label });
        if (mine) sentAt.current = null;
        // ponytail: delayed full refreshes; the Proposed log can arrive before `latest` state reflects it.
        // Status changes (entry, judging, podium) also get an early ~1 s one so the crowd sees them fast; Scored is
        // already shown via the overlay, so it skips it (fewer RPC bursts).
        refresh.forEach(clearTimeout);
        refresh = (e.eventName === "Scored" ? [2500] : [1000, 2500]).map((ms) => setTimeout(() => qc.invalidateQueries(), ms));
      },
      setMode,
    );
    return () => {
      refresh.forEach(clearTimeout);
      stop();
    };
  }, [cid, qc]);
  const live = mode === "monadLogs" || mode === "eth logs";
  const poll = live ? 10_000 : 2_000;

  // ---- reads
  const { data: c } = useReadContract({ ...kicau, functionName: "getContest", args: [cid], query: { refetchInterval: poll } });
  const { data: entries, dataUpdatedAt } = useReadContract({ ...kicau, functionName: "entriesOf", args: [cid], query: { refetchInterval: poll } });
  const ids = entries?.[0] ?? [];
  const judges = c?.judges ?? [];
  const { data: owners } = useReadContracts({
    contracts: ids.map((t) => ({ ...kicau, functionName: "ownerOf", args: [t] }) as const),
    query: { enabled: ids.length > 0, refetchInterval: poll },
  });
  const { data: scores } = useReadContracts({
    contracts: ids.flatMap((t) => judges.map((j) => ({ ...kicau, functionName: "judgeScoreOf", args: [cid, t, j] }) as const)),
    query: { enabled: ids.length > 0 && judges.length > 0, refetchInterval: poll },
  });
  const { data: org } = useReadContract({ ...kicau, functionName: "organizers", args: c ? [c.host] : undefined, query: { enabled: !!c } });
  const { data: birds } = useQuery({
    queryKey: ["contestBirds", KICAU_ADDRESS, ids.map(String)],
    enabled: !!client && ids.length > 0,
    staleTime: Infinity,
    queryFn: async () =>
      Object.fromEntries(await Promise.all(ids.map(async (t) => [String(t), await fetchCustomBird(client!, KICAU_ADDRESS, t).catch(() => null)] as const))),
  });

  const totalOf = (t: bigint, i: number) => {
    const o = overlay[String(t)];
    return o && dataUpdatedAt < o.at + 2000 ? o.total : (entries?.[1][i] ?? 0n);
  };
  const scoreOf = (i: number, j: number) => scores?.[i * judges.length + j]?.result;
  const rows = rankEntries(
    ids.map((t, i) => ({
      tokenId: t,
      index: i,
      total: totalOf(t, i),
      keeper: owners?.[i]?.result as `0x${string}` | undefined,
      bird: birds?.[String(t)] as CustomBird | null | undefined,
    })),
  );
  const maxTotal = BigInt(judges.length * 40) || 1n;

  // ---- my birds (to enter)
  const { data: myIds } = useReadContract({ ...kicau, functionName: "tokensOf", args: me ? [k.address!] : undefined, query: { enabled: !!me } });
  const { data: mySpecies } = useReadContracts({
    contracts: (myIds ?? []).map((t) => ({ ...kicau, functionName: "speciesOf", args: [t] }) as const),
    query: { enabled: !!myIds?.length },
  });
  const myCustom = (myIds ?? []).filter((_, i) => mySpecies?.[i]?.result === BigInt(CUSTOM_SPECIES));
  const eligible = myCustom.filter((t) => !ids.includes(t));
  const { data: myNames } = useQuery({
    queryKey: ["myContestBirds", KICAU_ADDRESS, myCustom.map(String)],
    enabled: !!client && myCustom.length > 0,
    staleTime: Infinity,
    queryFn: async () =>
      Object.fromEntries(await Promise.all(myCustom.map(async (t) => [String(t), (await fetchCustomBird(client!, KICAU_ADDRESS, t).catch(() => null))?.name] as const))),
  });
  const { data: registerFee } = useReadContract({ ...kicau, functionName: "registerFee" });
  const [pick, setPick] = useState("");
  const pickId = pick && eligible.some((t) => String(t) === pick) ? BigInt(pick) : eligible[0];

  // ---- judge sliders
  const [draft, setDraft] = useState<Record<string, number[]>>({});
  const myJudgeIdx = judges.findIndex((j) => j.toLowerCase() === me);
  const sliderOf = (t: bigint, i: number) => {
    if (draft[String(t)]) return draft[String(t)];
    const s = myJudgeIdx >= 0 ? scoreOf(i, myJudgeIdx) : undefined;
    return s?.scored ? [s.melody, s.volume, s.duration, s.style] : [5, 5, 5, 5];
  };
  const [openRow, setOpenRow] = useState<string | null>(null);

  // ---- podium (after finalize)
  const status = c ? STATUS[c.status] : undefined;
  const pool = c ? c.entryFee * c.entryCount : 0n; // pool only grows by entryFee per entry; zeroed on-chain at finalize
  const top = rows.slice(0, 3);
  const { prizes, conservation } = payouts(pool, top.length);
  const { data: topAttest } = useReadContracts({
    contracts: top.map((r) => ({ ...kicau, functionName: "attestationsOf", args: [r.tokenId] }) as const),
    query: { enabled: status === "Finalized" && top.length > 0 },
  });

  if (!c) return <p className="text-muted">Loading contest #{id} from chain…</p>;
  const isHost = me === c.host.toLowerCase();
  const isJudge = myJudgeIdx >= 0;
  const busy = k.txBusy || !k.ready;
  const deadline = new Date(Number(c.entryDeadline) * 1000);

  async function enter() {
    if (pickId === undefined) return;
    await k.send({ functionName: "enter", args: [cid, pickId], value: c!.entryFee });
  }
  async function quickRegister() {
    const hex = () => `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")}`;
    const colors: BirdColors = { head: hex(), body: hex(), belly: hex(), wing: hex(), tail: hex(), beak: "#222222" };
    const bytes = encodeBird(colors, { owner: "Demo keeper", story: "Registered from the Contests page." });
    const img = `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}` as `0x${string}`;
    await k.send({ functionName: "registerBird", args: [`Demo Bird ${Math.floor(Math.random() * 900 + 100)}`, img], value: registerFee ?? 0n });
  }
  async function submitScore(t: bigint, i: number) {
    const [m, v, d, s] = sliderOf(t, i);
    sentAt.current = performance.now();
    if (!(await k.send({ functionName: "score", args: [cid, t, m, v, d, s] }))) sentAt.current = null;
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <section className="rounded-3xl border border-line bg-paper p-4 sm:p-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <StatusChip status={status!} />
          <span className="border-[3px] border-ink bg-cream px-2 py-0.5 text-xs font-bold">{c.class_}</span>
          <span className="text-xs text-muted">Contest #{id}</span>
          <ShareLinks id={id} name={c.name} />
        </div>
        <h1 className="mb-3 break-words font-display text-3xl">{c.name}</h1>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <Stat label="Prize pool" value={`${formatEther(status === "Finalized" || status === "Cancelled" ? pool : c.pool)} MON`} />
          <Stat label="Entry fee" value={`${formatEther(c.entryFee)} MON`} />
          <Stat label="Entries" value={`${c.entryCount} / 32`} />
          <Stat label="Entries close" value={deadline.toLocaleString([], { dateStyle: "short", timeStyle: "short" })} />
        </dl>
        <p className="mt-3 break-words text-sm text-muted">
          Host{" "}
          <a className="underline" href={addrLink(c.host)} target="_blank" rel="noreferrer">
            {short(c.host)}
          </a>
          {org?.[1] && <> · verified organizer “{org[0]}”</>}
          {isHost && " (you)"} · Judges:{" "}
          {judges.map((j, i) => (
            <span key={j}>
              {i > 0 && ", "}
              <a className="underline" href={addrLink(j)} target="_blank" rel="noreferrer">
                {short(j)}
              </a>
              {j.toLowerCase() === me && " (you)"}
            </span>
          ))}
        </p>
      </section>

      {/* podium */}
      {status === "Finalized" && top.length > 0 && (
        <section className="rounded-3xl border border-line bg-sun/20 p-4 sm:p-6">
          <h2 className="mb-3 font-display text-2xl">Results</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {top.map((r, place) => {
              const title = `Juara ${place + 1} · ${c.name}`;
              const list = topAttest?.[place]?.result ?? [];
              const attIdx = list.findIndex((a) => !a.revoked && a.title === title && a.organizer.toLowerCase() === c.host.toLowerCase());
              const att = attIdx >= 0;
              return (
                <div key={String(r.tokenId)} className="rounded-2xl border border-line bg-paper p-3 text-center">
                  <div className="text-3xl">{MEDAL[place]}</div>
                  <BirdImg bird={r.bird} className="mx-auto h-16 w-20" />
                  <div className="truncate font-display text-xs">{r.bird?.name ?? `#${r.tokenId}`}</div>
                  <div className="text-sm">{String(r.total)} pts</div>
                  <div className="font-display text-sm text-leaf">+{formatEther(prizes[place])} MON</div>
                  {r.keeper && (
                    <a className="text-xs underline" href={addrLink(r.keeper)} target="_blank" rel="noreferrer">
                      to {short(r.keeper)} ↗
                    </a>
                  )}
                  {att && <div className="mt-1 text-xs font-semibold text-leaf">✓ “{title}” attested by {org?.[0] ?? short(c.host)}</div>}
                  {att && isHost && (
                    <button
                      className="mt-1 text-xs text-clay underline"
                      disabled={busy}
                      onClick={() => confirm(`Revoke the on-chain title “${title}”?`) && k.send({ functionName: "revokeAttestation", args: [r.tokenId, BigInt(attIdx)] })}
                    >
                      Revoke title
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-muted">
            {formatEther(conservation)} MON went to the conservation wallet (10% + rounding{top.length < 3 ? " + unfilled places" : ""}).
          </p>
        </section>
      )}

      {/* scoreboard */}
      <section className="rounded-3xl border border-line bg-paper p-4 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl">Live scoreboard</h2>
          <span className={`text-xs font-semibold ${live ? "text-leaf" : "text-muted"}`}>
            {live ? `● live via ${mode}` : mode === "polling" ? "◌ polling every 2 s" : "◌ connecting…"}
          </span>
        </div>
        {fresh && (
          <p className="mb-3 border-[3px] border-ink bg-cream px-3 py-2 text-sm" aria-live="polite">
            ⚡ {fresh.ms !== undefined ? <b>updated in {fresh.ms} ms</b> : <b>live update</b>} · {fresh.label}
            {fresh.state && <span className="text-muted"> · {fresh.state}</span>}
          </p>
        )}
        {!rows.length ? (
          <p className="text-muted">No entries yet.</p>
        ) : (
          <ol className="space-y-2">
            {rows.map((r, rank) => {
              const key = String(r.tokenId);
              const pct = Number((r.total * 100n) / maxTotal);
              return (
                <li key={key} className="border-[3px] border-ink bg-paper">
                  <button className="flex w-full items-center gap-3 p-2 text-left" onClick={() => setOpenRow(openRow === key ? null : key)} aria-expanded={openRow === key}>
                    <span className="w-7 shrink-0 text-center font-display text-sm">{rank < 3 ? MEDAL[rank] : rank + 1}</span>
                    <BirdImg bird={r.bird} className="h-10 w-12 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-xs">{r.bird?.name ?? `#${key}`}</span>
                      <span className="block truncate text-xs text-muted">
                        {r.bird?.profile.owner ? `${r.bird.profile.owner} · ` : ""}
                        {r.keeper ? short(r.keeper) : "…"}
                        {!!me && r.keeper?.toLowerCase() === me && " (you)"}
                      </span>
                      <KicauValue tokenId={r.tokenId} className="text-muted" />
                      <span className="mt-1 block h-2 bg-line">
                        <span className="block h-2 bg-leaf transition-[width] duration-300" style={{ width: `${pct}%` }} />
                      </span>
                    </span>
                    <span className="shrink-0 text-right font-display text-lg tabular-nums">{String(r.total)}</span>
                  </button>
                  {openRow === key && (
                    <div className="overflow-x-auto border-t-[3px] border-dashed border-ink p-2">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-muted">
                            <th className="pr-2 font-normal">Judge</th>
                            {ASPECTS.map((a) => (
                              <th key={a} className="px-1 font-normal capitalize">
                                {a}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {judges.map((j, ji) => {
                            const s = scoreOf(r.index, ji);
                            return (
                              <tr key={j}>
                                <td className="pr-2">{short(j)}</td>
                                {s?.scored ? (
                                  [s.melody, s.volume, s.duration, s.style].map((v, ai) => (
                                    <td key={ai} className="px-1 tabular-nums">
                                      {v}
                                    </td>
                                  ))
                                ) : (
                                  <td colSpan={4} className="px-1 text-muted">
                                    not scored yet
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* enter */}
      {status === "Open" && (
        <section className="rounded-3xl border border-line bg-paper p-4 sm:p-6">
          <h2 className="mb-2 font-display text-2xl">Enter your bird</h2>
          {!me ? (
            <p className="text-sm text-muted">Use ⚡ Quick Play (top) to get a testnet wallet first.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {eligible.length > 0 && (
                <>
                  <select className="min-w-0 border-[3px] border-ink bg-paper px-2 py-2 text-sm" value={String(pickId)} onChange={(e) => setPick(e.target.value)} aria-label="Choose bird to enter">
                    {eligible.map((t) => (
                      <option key={String(t)} value={String(t)}>
                        {myNames?.[String(t)] ?? "…"} #{String(t)}
                      </option>
                    ))}
                  </select>
                  <button className="btn-primary !py-2" disabled={busy} onClick={enter}>
                    Enter · {formatEther(c.entryFee)} MON
                  </button>
                </>
              )}
              {eligible.length === 0 && <span className="text-sm text-muted">{myCustom.length ? "All your registered birds are entered." : "You have no registered bird yet."}</span>}
              <button className="btn-ghost !py-2" disabled={busy} onClick={quickRegister} title="Registers a bird with a random pixel palette">
                + Quick-register a demo bird{registerFee !== undefined && ` (${formatEther(registerFee)} MON)`}
              </button>
            </div>
          )}
        </section>
      )}

      {/* judge panel */}
      {isJudge && status === "Judging" && (
        <section className="rounded-3xl border border-line bg-paper p-4 sm:p-6">
          <h2 className="mb-1 font-display text-2xl">Judge panel</h2>
          <p className="mb-3 text-sm text-muted">Score each bird 0–10 per aspect. You can re-score until the host finalizes.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {ids.map((t, i) => {
              const vals = sliderOf(t, i);
              const bird = birds?.[String(t)];
              const done = scoreOf(i, myJudgeIdx)?.scored;
              return (
                <div key={String(t)} className="border-[3px] border-ink p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <BirdImg bird={bird} className="h-8 w-10" />
                    <span className="min-w-0 flex-1 truncate font-display text-xs">{bird?.name ?? `#${t}`}</span>
                    <span className="text-sm font-bold tabular-nums">{vals.reduce((a, b) => a + b, 0)}/40</span>
                  </div>
                  {ASPECTS.map((a, ai) => (
                    <label key={a} className="grid grid-cols-[72px_1fr_24px] items-center gap-2 text-sm capitalize">
                      {a}
                      <input
                        type="range"
                        min={0}
                        max={10}
                        value={vals[ai]}
                        onChange={(e) => setDraft((d) => ({ ...d, [String(t)]: vals.map((v, x) => (x === ai ? Number(e.target.value) : v)) }))}
                        className="accent-[var(--leaf)]"
                        aria-label={`${a} for ${bird?.name ?? t}`}
                      />
                      <span className="text-right tabular-nums">{vals[ai]}</span>
                    </label>
                  ))}
                  <button className="btn-primary mt-2 w-full !py-2" disabled={busy} onClick={() => submitScore(t, i)}>
                    {done ? "Update score" : "Submit score"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* host controls */}
      {isHost && (status === "Open" || status === "Judging") && (
        <section className="rounded-3xl border border-line bg-paper p-4 sm:p-6">
          <h2 className="mb-3 font-display text-2xl">Host controls</h2>
          <div className="flex flex-wrap gap-2">
            {status === "Open" && (
              <button className="btn-primary" disabled={busy || c.entryCount < 2n} onClick={() => k.send({ functionName: "startJudging", args: [cid] })}>
                Start judging{c.entryCount < 2n && " (needs 2 entries)"}
              </button>
            )}
            {status === "Judging" && (
              <button className="btn-primary" disabled={busy} onClick={() => k.send({ functionName: "finalize", args: [cid] })}>
                Finalize & pay out
              </button>
            )}
            <button className="btn-ghost" disabled={busy} onClick={() => confirm("Cancel and refund every entrant?") && k.send({ functionName: "cancelContest", args: [cid] })}>
              Cancel & refund
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export function StatusChip({ status }: { status: (typeof STATUS)[number] }) {
  const cls = { Open: "bg-leaf text-paper", Judging: "bg-sun text-ink", Finalized: "bg-ink text-paper", Cancelled: "bg-line text-muted" }[status];
  return <span className={`border-[3px] border-ink px-2 py-0.5 font-display text-[0.6rem] uppercase ${cls}`}>{status}</span>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="truncate font-semibold">{value}</dd>
    </div>
  );
}

function BirdImg({ bird, className }: { bird?: CustomBird | null; className: string }) {
  if (!bird) return <span className={`${className} block bg-cream`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={bird.image} alt={bird.name} className={`${className} object-contain [image-rendering:pixelated]`} />;
}

/** Links to the server-rendered result page (/lomba/<id>), which carries a live OG image for X / WhatsApp previews. */
function ShareLinks({ id, name }: { id: number; name: string }) {
  const url = `${typeof location === "undefined" ? "https://kicau-theta.vercel.app" : location.origin}/lomba/${id}`;
  const text = `${name}: every judge score on-chain on Monad`;
  return (
    <span className="ml-auto flex gap-2 text-xs">
      <a className="underline" href={`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer">
        Share on X
      </a>
      <a className="underline" href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noreferrer">
        WhatsApp
      </a>
      <a className="underline" href={url}>
        Result page
      </a>
    </span>
  );
}

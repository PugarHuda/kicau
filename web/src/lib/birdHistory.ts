import type { PublicClient } from "viem";
import { kicauAbi } from "./abi";
import { KICAU_ADDRESS, KICAU_DEPLOY_BLOCK } from "./config";
import { PRIZE_PCT } from "./contestLive";

const DEPLOY_BLOCK = KICAU_DEPLOY_BLOCK; // ponytail: chunk alignment origin
/**
 * Max eth_getLogs span on the public Monad testnet RPCs (probed 2026-10-24): testnet-rpc.monad.xyz answers
 * "eth_getLogs is limited to a 100 range", drpc / ankr reject 200+ too. to - from <= 100 works, so 101 blocks per chunk.
 */
export const LOG_SPAN = 101n;
const PARALLEL = 8;

const EVENTS = kicauAbi.filter(
  (x) =>
    x.type === "event" &&
    [
      "BirdRegistered",
      "BirdUpdated",
      "BirdSupported",
      "Attested",
      "AttestationRevoked",
      "RunStarted",
      "RunSubmitted",
      "ContestEntered",
      "ContestFinalized",
      "ContestCancelled",
    ].includes(x.name),
) as Extract<(typeof kicauAbi)[number], { type: "event" }>[];

type RawLog = { eventName: string; args: Record<string, unknown>; blockNumber: bigint; blockTimestamp?: bigint; transactionHash: `0x${string}`; logIndex: number };

// Chunks are aligned to DEPLOY_BLOCK so every bird's scan reuses the same finished chunks (session-wide cache).
const chunkCache = new Map<bigint, Promise<RawLog[]>>();

async function getChunk(client: PublicClient, from: bigint, to: bigint, full: boolean): Promise<RawLog[]> {
  const run = async () => {
    for (let i = 0; ; i++) {
      try {
        const logs = await client.getLogs({ address: KICAU_ADDRESS, events: EVENTS, fromBlock: from, toBlock: to });
        return logs as unknown as RawLog[];
      } catch (e) {
        if (i >= 3) throw e;
        await new Promise((r) => setTimeout(r, 400 * 2 ** i));
      }
    }
  };
  if (!full) return run(); // the newest, still-growing chunk is never cached
  let p = chunkCache.get(from);
  if (!p) {
    p = run();
    chunkCache.set(from, p);
    p.catch(() => chunkCache.delete(from));
  }
  return p;
}

async function scan(client: PublicClient, fromBlock: bigint, toBlock: bigint) {
  const starts: bigint[] = [];
  for (let b = DEPLOY_BLOCK + ((fromBlock - DEPLOY_BLOCK) / LOG_SPAN) * LOG_SPAN; b <= toBlock; b += LOG_SPAN) starts.push(b);
  const out: RawLog[][] = new Array(starts.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: PARALLEL }, async () => {
      while (next < starts.length) {
        const i = next++;
        const end = starts[i] + LOG_SPAN - 1n;
        out[i] = await getChunk(client, starts[i], end > toBlock ? toBlock : end, end <= toBlock);
      }
    }),
  );
  return out.flat().filter((l) => l.blockNumber >= fromBlock && l.blockNumber <= toBlock);
}

// ------------------------------------------------------------------ value formula (mirror of Kicau.valueBreakdown)

export type ValueState = { w1: number; w2: number; w3: number; att: number; supporters: number; supportWei: bigint; bestRun: number; lastUpdated: number };

export function freshnessPct(nowSec: number, lastUpdated: number) {
  const days = Math.floor((nowSec - lastUpdated) / 86400);
  return days <= 7 ? 100 : (days - 7) * 5 >= 70 ? 30 : 100 - (days - 7) * 5;
}

export function valuePoints(s: ValueState, nowSec: number) {
  const support = Math.min(Number(s.supportWei / 10n ** 15n / 10n), 500);
  const raw = 100 + s.w1 * 250 + s.w2 * 150 + s.w3 * 100 + s.att * 80 + s.supporters * 10 + support + Math.min(s.bestRun * 2, 500);
  return Math.floor((raw * freshnessPct(nowSec, s.lastUpdated)) / 100);
}

// ------------------------------------------------------------------ history

export type ProofKind = "registered" | "updated" | "supported" | "attested" | "revoked" | "run" | "contest" | "cancelled";

export type ProofEvent = {
  kind: ProofKind;
  label: string;
  blockNumber: bigint;
  timestamp: number; // unix seconds
  txHash: `0x${string}`;
  details: string;
  pointsDelta: number;
  /** points right after this event */
  points: number;
  contestId?: number;
  place?: number; // 1..3
  prizeWei?: bigint; // contest prize to the keeper
  keeper?: `0x${string}`; // support: keeper paid; contest: entrant
  keeperWei?: bigint; // support: 70% keeper share
};

export type ValuePoint = { t: number; points: number; event?: number /* index into events */ };

/** Chronological on-chain proof for one registered bird + a client-side reconstruction of its Kicau Value. */
export async function fetchBirdHistory(client: PublicClient, tokenId: bigint) {
  const head = await client.getBlock();
  const at = { blockNumber: head.number };
  const c = { address: KICAU_ADDRESS, abi: kicauAbi } as const;
  const [registeredAt, onchain, attList] = await Promise.all([
    client.readContract({ ...c, functionName: "registeredAt", args: [tokenId], ...at }),
    client.readContract({ ...c, functionName: "valueBreakdown", args: [tokenId], ...at }),
    client.readContract({ ...c, functionName: "attestationsOf", args: [tokenId], ...at }),
  ]);
  const logs = await scan(client, registeredAt, head.number);
  logs.sort((a, b) => (a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1));

  const id = tokenId;
  const runs = new Set<bigint>(); // runIds started with this bird
  const entered = new Map<bigint, `0x${string}`>(); // contestId → entrant
  const mine = logs.filter((l) => {
    const a = l.args;
    switch (l.eventName) {
      case "RunStarted":
        if (a.tokenId === id) runs.add(a.runId as bigint);
        return false;
      case "RunSubmitted":
        return runs.has(a.runId as bigint);
      case "ContestEntered":
        if (a.tokenId === id) entered.set(a.contestId as bigint, a.entrant as `0x${string}`);
        return false;
      case "ContestFinalized":
      case "ContestCancelled":
        return entered.has(a.contestId as bigint);
      default:
        return a.tokenId === id;
    }
  });

  const contestIds = [...new Set(mine.filter((l) => l.eventName.startsWith("Contest")).map((l) => l.args.contestId as bigint))];
  const orgAddrs = [...new Set(mine.filter((l) => l.eventName === "Attested").map((l) => l.args.organizer as `0x${string}`))];
  const [contests, orgs] = await Promise.all([
    Promise.all(contestIds.map((cid) => client.readContract({ ...c, functionName: "getContest", args: [cid], ...at }))),
    Promise.all(orgAddrs.map((o) => client.readContract({ ...c, functionName: "organizers", args: [o], ...at }))),
  ]);
  const contestName = (cid: bigint) => contests[contestIds.indexOf(cid)]?.name ?? `#${cid}`;
  const orgName = (o: string) => orgs[orgAddrs.indexOf(o as `0x${string}`)]?.[0] || `${o.slice(0, 6)}…${o.slice(-4)}`;

  const s: ValueState = { w1: 0, w2: 0, w3: 0, att: 0, supporters: 0, supportWei: 0n, bestRun: 0, lastUpdated: 0 };
  const events: ProofEvent[] = [];
  const timeline: ValuePoint[] = [];

  /** samples the freshness decay (day boundaries 8..21 after the last update) up to `until` */
  const decaySamples = (from: number, until: number) => {
    if (!s.lastUpdated) return;
    for (let d = 8; d <= 21; d++) {
      const t = s.lastUpdated + d * 86400;
      if (t > from && t < until) timeline.push({ t, points: valuePoints(s, t) });
    }
  };

  for (const l of mine) {
    const a = l.args;
    const t = Number(l.blockTimestamp ?? head.timestamp);
    decaySamples(timeline.at(-1)?.t ?? t, t);
    const before = s.lastUpdated ? valuePoints(s, t) : 0;
    const e: Omit<ProofEvent, "pointsDelta" | "points"> = { kind: "registered", label: "", blockNumber: l.blockNumber, timestamp: t, txHash: l.transactionHash, details: "" };
    switch (l.eventName) {
      case "BirdRegistered":
        s.lastUpdated = t;
        Object.assign(e, { kind: "registered", label: "Registered on-chain", details: `“${a.name}” minted as NFT #${id} to ${short(a.owner as string)}` });
        break;
      case "BirdUpdated":
        s.lastUpdated = t;
        Object.assign(e, { kind: "updated", label: `Profile update v${a.version}`, details: "New sprite/profile published; freshness reset to 100%" });
        break;
      case "BirdSupported": {
        const keeperWei = (a.amount as bigint) - (a.conservation as bigint);
        s.supporters++;
        s.supportWei += a.amount as bigint;
        Object.assign(e, {
          kind: "supported",
          label: `Supported · ${fmtMon(a.amount as bigint)} MON`,
          details: `by ${short(a.supporter as string)} · ${fmtMon(keeperWei)} MON (70%) to keeper ${short(a.keeper as string)}, ${fmtMon(a.conservation as bigint)} to conservation`,
          keeper: a.keeper,
          keeperWei,
        });
        break;
      }
      case "Attested":
        s.att++;
        Object.assign(e, { kind: "attested", label: `Title attested: ${a.title}`, details: `by organizer ${orgName(a.organizer as string)}` });
        break;
      case "AttestationRevoked": {
        s.att--;
        const title = attList[Number(a.index)]?.title ?? `#${a.index}`;
        Object.assign(e, { kind: "revoked", label: `Title revoked: ${title}`, details: `by organizer ${short(a.organizer as string)}` });
        break;
      }
      case "RunSubmitted": {
        const sc = Number(a.score);
        const best = sc > s.bestRun;
        if (best) s.bestRun = sc;
        Object.assign(e, { kind: "run", label: `Verified run · ${sc} pts`, details: best ? "New best seeded, time-checked run" : "Seeded, time-checked run (not a new best)" });
        break;
      }
      case "ContestFinalized": {
        const cid = a.contestId as bigint;
        const top = [a.first, a.second, a.third] as bigint[];
        const k = top.indexOf(id);
        const prizeWei = k >= 0 ? ((a.pool as bigint) * BigInt(PRIZE_PCT[k])) / 100n : 0n;
        if (k === 0) s.w1++;
        if (k === 1) s.w2++;
        if (k === 2) s.w3++;
        Object.assign(e, {
          kind: "contest",
          label: k >= 0 ? `${["1st", "2nd", "3rd"][k]} place · ${contestName(cid)}` : `Competed · ${contestName(cid)}`,
          details: k >= 0 ? `Prize ${fmtMon(prizeWei)} MON paid to the keeper (pool ${fmtMon(a.pool as bigint)})` : "Finished outside the podium",
          contestId: Number(cid),
          place: k >= 0 ? k + 1 : undefined,
          prizeWei,
          keeper: entered.get(cid),
        });
        break;
      }
      case "ContestCancelled": {
        const cid = a.contestId as bigint;
        Object.assign(e, { kind: "cancelled", label: `Contest cancelled · ${contestName(cid)}`, details: "Entry fee refunded", contestId: Number(cid) });
        break;
      }
    }
    const points = valuePoints(s, t);
    events.push({ ...e, pointsDelta: points - before, points });
    timeline.push({ t, points, event: events.length - 1 });
  }
  const now = Number(head.timestamp);
  decaySamples(timeline.at(-1)?.t ?? now, now);
  const nowPoints = valuePoints(s, now);
  timeline.push({ t: now, points: nowPoints });

  return {
    events,
    timeline,
    state: s,
    reconstructed: nowPoints,
    onchain,
    matches: BigInt(nowPoints) === onchain.points,
    headBlock: head.number,
    headTime: now,
    scannedFrom: registeredAt,
    chunks: Number((head.number - registeredAt) / LOG_SPAN) + 1,
  };
}

export type BirdHistory = Awaited<ReturnType<typeof fetchBirdHistory>>;

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
export const fmtMon = (wei: bigint) => (Number(wei) / 1e18).toFixed(5).replace(/0+$/, "").replace(/\.$/, "");

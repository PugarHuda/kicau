// Live contest events over Monad's `monadLogs` WebSocket subscription (see live.ts for the protocol notes).
// One subscription per open contest, filtered by event topics + the indexed contestId.
// Falls back to standard `logs`, and after 3 failed connects reports "polling" (the page then polls reads every 2 s).
import { decodeEventLog, numberToHex, pad, toEventSelector, type Hex } from "viem";
import { kicauAbi } from "./abi";
import { type Mode, WS_URL } from "./live";

const EVENTS = ["Scored", "ContestEntered", "JudgingStarted", "ContestFinalized", "ContestCancelled"] as const;
const TOPICS = kicauAbi
  .filter((x) => x.type === "event" && (EVENTS as readonly string[]).includes(x.name))
  .map((x) => toEventSelector(x as Parameters<typeof toEventSelector>[0]));

export type ContestEvent = {
  key: string;
  eventName: (typeof EVENTS)[number];
  args: Record<string, unknown>;
  txHash: Hex;
  commitState?: string; // Proposed | Voted | Finalized | Verified (monadLogs only)
  at: number; // performance.now() on arrival
};

type RawLog = { topics: Hex[]; data: Hex; transactionHash: Hex; logIndex: Hex | number; commitState?: string; removed?: boolean };

/** Calls `onEvent` once per log (first sighting, usually the Proposed state). Returns a stop function. */
export function watchContest(
  address: Hex,
  contestId: bigint,
  onEvent: (e: ContestEvent) => void,
  onMode: (m: Mode) => void,
): () => void {
  const seen = new Set<string>();
  let ws: WebSocket | null = null;
  let stopped = false;
  let fails = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const filter = { address, topics: [TOPICS, pad(numberToHex(contestId), { size: 32 })] };

  const ingest = (log: RawLog) => {
    const key = `${log.transactionHash}:${Number(log.logIndex)}`;
    if (log.removed || seen.has(key)) return;
    seen.add(key);
    try {
      const ev = decodeEventLog({ abi: kicauAbi, topics: log.topics as [Hex, ...Hex[]], data: log.data });
      onEvent({
        key,
        eventName: ev.eventName as ContestEvent["eventName"],
        args: ev.args as unknown as Record<string, unknown>,
        txHash: log.transactionHash,
        commitState: log.commitState,
        at: performance.now(),
      });
    } catch {}
  };

  const connect = () => {
    if (stopped) return;
    const sock = new WebSocket(WS_URL);
    ws = sock;
    let sub: string | undefined;
    let opened = false;
    const send = (id: number, params: unknown[]) => sock.send(JSON.stringify({ jsonrpc: "2.0", id, method: "eth_subscribe", params }));
    sock.onopen = () => {
      opened = true;
      fails = 0;
      send(1, ["monadLogs", filter]);
    };
    sock.onmessage = (e) => {
      let m: { id?: number; result?: string; error?: unknown; params?: { subscription: string; result: RawLog } };
      try {
        m = JSON.parse(e.data as string);
      } catch {
        return;
      }
      if (m.id) {
        if (m.id === 1 && m.error) send(2, ["logs", filter]);
        if (m.result) {
          sub = m.result;
          onMode(m.id === 1 ? "monadLogs" : "eth logs");
        }
        return;
      }
      if (m.params && m.params.subscription === sub) ingest(m.params.result);
    };
    let dead = false;
    sock.onerror = sock.onclose = () => {
      if (stopped || dead) return;
      dead = true;
      sock.close();
      fails = opened ? 1 : fails + 1;
      onMode(fails >= 3 ? "polling" : "connecting");
      retry = setTimeout(connect, Math.min(30_000, 1000 * 2 ** fails));
    };
  };

  onMode("connecting");
  connect();
  return () => {
    stopped = true;
    clearTimeout(retry);
    ws?.close();
  };
}

export const STATUS = ["Open", "Judging", "Finalized", "Cancelled"] as const;
export const ASPECTS = ["melody", "volume", "duration", "style"] as const;
export const PRIZE_PCT = [50, 25, 15] as const;

/** Same ranking as Kicau.finalize: total desc, ties → earlier entry first. */
export function rankEntries<T extends { total: bigint; index: number }>(entries: T[]) {
  return [...entries].sort((a, b) => (a.total === b.total ? a.index - b.index : a.total > b.total ? -1 : 1));
}

/** Prize per place (wei) for a pool, matching the contract's floor division; rest goes to conservation. */
export function payouts(pool: bigint, places: number) {
  const prizes = PRIZE_PCT.slice(0, places).map((p) => (pool * BigInt(p)) / 100n);
  return { prizes, conservation: pool - prizes.reduce((a, b) => a + b, 0n) };
}

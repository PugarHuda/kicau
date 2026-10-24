// Live Kicau feed over Monad's extended WebSocket subscriptions.
//
// Observed on wss://testnet-rpc.monad.xyz (2026-10-24):
// - `monadLogs` re-emits the SAME log once per commit state, each carrying
//   { blockId, commitState: "Proposed" | "Voted" | "Finalized" | "Verified", ...standard log fields }.
// - `monadNewHeads` emits every block proposal per commit state, same { blockId, commitState } + header.
// - Abandoned proposals get no event: a Finalized head at the same height with another blockId supersedes them.
// Fallbacks: plain `eth_subscribe logs` (if monadLogs is rejected), then HTTP polling.
import { createPublicClient, decodeEventLog, formatEther, http, toEventSelector, type Hex } from "viem";
import { monadTestnet } from "viem/chains";
import { kicauAbi } from "./abi";
import { BIRDS } from "./birds";

export const WS_URL = "wss://testnet-rpc.monad.xyz";
const EVENTS = ["BirdBought", "Supported", "ScoreSubmitted", "BirdRegistered"] as const;
type Kind = (typeof EVENTS)[number];
const TOPICS = kicauAbi
  .filter((x) => x.type === "event" && (EVENTS as readonly string[]).includes(x.name))
  .map((x) => toEventSelector(x as Parameters<typeof toEventSelector>[0]));

export type Mode = "connecting" | "monadLogs" | "eth logs" | "polling";
export type Status = "Proposed" | "Voted" | "Finalized" | "Verified" | "Abandoned";
export type LiveItem = {
  key: string;
  kind: Kind;
  label: string;
  actor: Hex;
  txHash: Hex;
  blockNumber: bigint;
  blockId?: Hex;
  status: Status;
  firstSeen: number; // performance.now() at first sighting
  finalMs?: number; // first seen -> Finalized (unset if it was already final when first seen)
  backfill?: boolean;
};

type RawLog = {
  address: Hex;
  topics: Hex[];
  data: Hex;
  blockNumber: Hex | bigint;
  transactionHash: Hex;
  logIndex: Hex | number;
  removed?: boolean;
  blockId?: Hex;
  commitState?: Status;
};

const RANK: Record<Status, number> = { Abandoned: -1, Proposed: 0, Voted: 1, Finalized: 2, Verified: 3 };
const speciesName = (id: bigint) => (id === 999n ? "burung custom" : (BIRDS[Number(id)]?.name ?? `spesies #${id}`));

export function describe(topics: Hex[], data: Hex): { kind: Kind; label: string; actor: Hex } | null {
  try {
    const ev = decodeEventLog({ abi: kicauAbi, topics: topics as [Hex, ...Hex[]], data });
    switch (ev.eventName) {
      case "BirdBought":
        return { kind: ev.eventName, actor: ev.args.buyer, label: `adopsi ${speciesName(ev.args.speciesId)}` };
      case "Supported":
        return {
          kind: ev.eventName,
          actor: ev.args.supporter,
          label: `support ${formatEther(ev.args.amount)} MON → ${speciesName(ev.args.speciesId)}`,
        };
      case "ScoreSubmitted":
        return { kind: ev.eventName, actor: ev.args.player, label: `skor ${ev.args.score} · ${speciesName(ev.args.speciesId)}` };
      case "BirdRegistered":
        return { kind: ev.eventName, actor: ev.args.owner, label: `daftar burung '${ev.args.name}'` };
    }
  } catch {}
  return null;
}

/** Starts the feed; returns a stop function. `onChange` gets newest-first items (max `limit`). */
export function startLive(
  address: Hex,
  onChange: (items: LiveItem[], mode: Mode) => void,
  limit = 12,
): () => void {
  const client = createPublicClient({ chain: monadTestnet, transport: http() });
  const items = new Map<string, LiveItem>();
  let mode: Mode = "connecting";
  let ws: WebSocket | null = null;
  let stopped = false;
  let fails = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let poll: ReturnType<typeof setInterval> | undefined;
  let finCheck: ReturnType<typeof setInterval> | undefined;
  let lastPolled = 0n;

  const emit = () => {
    const list = [...items.values()].sort((a, b) => b.firstSeen - a.firstSeen);
    for (const old of list.slice(50)) items.delete(old.key); // ponytail: bounded memory, oldest dropped
    onChange(list.slice(0, limit), mode);
  };
  const setMode = (m: Mode) => {
    if (mode !== m) {
      mode = m;
      emit();
    }
  };

  const setStatus = (it: LiveItem, s: Status) => {
    if (it.status === "Abandoned" || RANK[s] <= RANK[it.status]) return false;
    it.status = s;
    if (RANK[s] >= RANK.Finalized && it.finalMs === undefined && !it.backfill)
      it.finalMs = Math.round(performance.now() - it.firstSeen);
    return true;
  };

  const ingest = (log: RawLog, status: Status) => {
    const key = `${log.transactionHash}:${Number(log.logIndex)}`;
    let it = items.get(key);
    if (!it) {
      if (log.removed) return;
      const d = describe(log.topics, log.data);
      if (!d) return;
      it = {
        key,
        ...d,
        txHash: log.transactionHash,
        blockNumber: BigInt(log.blockNumber),
        blockId: log.blockId,
        status,
        firstSeen: performance.now(),
        backfill: RANK[status] >= RANK.Finalized, // already final on first sight: no latency to report
      };
      items.set(key, it);
      return emit();
    }
    if (log.removed) {
      it.status = "Abandoned";
      return emit();
    }
    if (log.blockId && it.blockId !== log.blockId) {
      // Same tx re-included in another proposal: follow the new block.
      Object.assign(it, { blockId: log.blockId, blockNumber: BigInt(log.blockNumber), status: "Proposed" as Status });
    }
    if (setStatus(it, status)) emit();
  };

  // monadNewHeads: a Finalized block at height N supersedes every other proposal at N.
  const onHead = (h: { number: Hex; blockId: Hex; commitState: Status }) => {
    if (h.commitState !== "Finalized" && h.commitState !== "Verified") return;
    const n = BigInt(h.number);
    let changed = false;
    for (const it of items.values()) {
      if (it.blockNumber !== n || !it.blockId) continue;
      if (it.blockId === h.blockId) changed = setStatus(it, h.commitState) || changed;
      else if (RANK[it.status] < RANK.Finalized) {
        it.status = "Abandoned";
        changed = true;
      }
    }
    if (changed) emit();
  };

  // Without commit-state info (eth logs / polling): promote by the `finalized` block tag.
  // ponytail: height-only check, no hash comparison; reorgs only surface via `removed` in eth-logs mode.
  const checkFinalized = async () => {
    const pending = [...items.values()].filter((i) => RANK[i.status] >= 0 && RANK[i.status] < RANK.Finalized);
    if (!pending.length) return;
    try {
      const fin = (await client.getBlock({ blockTag: "finalized" })).number;
      let changed = false;
      for (const it of pending) if (fin !== null && it.blockNumber <= fin) changed = setStatus(it, "Finalized") || changed;
      if (changed) emit();
    } catch {}
  };

  const startPolling = () => {
    if (poll) return;
    setMode("polling");
    const tick = async () => {
      try {
        const [latest, fin] = await Promise.all([
          client.getBlockNumber(),
          client.getBlock({ blockTag: "finalized" }).then((b) => b.number ?? 0n),
        ]);
        const from = lastPolled >= latest - 50n ? lastPolled + 1n : latest - 50n; // public RPC caps getLogs at 100 blocks
        if (from > latest) return;
        const logs = await client.getContractEvents({ address, abi: kicauAbi, fromBlock: from, toBlock: latest });
        lastPolled = latest;
        for (const l of logs) ingest(l as unknown as RawLog, l.blockNumber <= fin ? "Finalized" : "Proposed");
        checkFinalized();
      } catch {}
    };
    tick();
    poll = setInterval(tick, 2000);
  };
  const stopPolling = () => {
    clearInterval(poll);
    poll = undefined;
  };

  const connect = () => {
    if (stopped) return;
    const sock = new WebSocket(WS_URL);
    ws = sock;
    const subs: Record<string, "logs" | "heads"> = {};
    let opened = false;
    const send = (id: number, params: unknown[]) =>
      sock.send(JSON.stringify({ jsonrpc: "2.0", id, method: "eth_subscribe", params }));
    const filter = { address, topics: [TOPICS] };

    sock.onopen = () => {
      opened = true;
      fails = 0;
      stopPolling();
      send(1, ["monadLogs", filter]);
      send(2, ["monadNewHeads"]);
    };
    sock.onmessage = (e) => {
      let m: { id?: number; result?: string; error?: unknown; params?: { subscription: string; result: never } };
      try {
        m = JSON.parse(e.data as string);
      } catch {
        return;
      }
      if (m.id) {
        if (m.id === 1 && m.error) send(3, ["logs", filter]); // no monadLogs here -> standard logs
        if (!m.result) return;
        subs[m.result] = m.id === 2 ? "heads" : "logs";
        if (m.id === 1) setMode("monadLogs");
        if (m.id === 3) {
          setMode("eth logs");
          finCheck ??= setInterval(checkFinalized, 1000);
        }
        return;
      }
      const kind = m.params && subs[m.params.subscription];
      if (kind === "heads") onHead(m.params!.result);
      else if (kind === "logs") {
        const log = m.params!.result as RawLog;
        ingest(log, log.commitState ?? "Proposed");
      }
    };
    let dead = false;
    // Browsers fire close after error; Node's undici sometimes fires only error. Handle whichever comes first, once.
    sock.onerror = sock.onclose = () => {
      if (stopped || dead) return;
      dead = true;
      sock.close();
      clearInterval(finCheck);
      finCheck = undefined;
      fails = opened ? 1 : fails + 1;
      if (fails >= 3) startPolling();
      else setMode("connecting");
      retry = setTimeout(connect, Math.min(30_000, 1000 * 2 ** fails)); // backoff 2s, 4s, 8s ... 30s
    };
  };

  connect();
  return () => {
    stopped = true;
    clearTimeout(retry);
    clearInterval(finCheck);
    stopPolling();
    ws?.close();
  };
}

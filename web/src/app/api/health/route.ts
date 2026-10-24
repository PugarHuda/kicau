// GET /api/health → live status of every piece of Monad infra Kicau depends on, probed on request (no cache layer):
// each testnet RPC (head + latency), the `monadLogs` WebSocket subscription, the Kicau contract, the Chainlink MON/USD
// feed on mainnet, and the x402 facilitator. Every probe has its own timeout, so one dead dependency never hangs the rest.
import { createPublicClient, http, parseAbi } from "viem";
import { monad, monadTestnet } from "viem/chains";
import { kicauAbi } from "@/lib/abi";
import { WS_URL } from "@/lib/live";
import { ADDRESS, client } from "@/lib/publicData";
import { X402_FACILITATOR, X402_NETWORK } from "@/lib/x402";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const RPCS = ["https://testnet-rpc.monad.xyz", "https://monad-testnet.drpc.org", "https://rpc.ankr.com/monad_testnet"]; // = lib/rpc.ts
const FEED = "0xBcD78f76005B7515837af6b50c7C52BCf73822fb" as const; // = lib/price.ts MON_USD_FEED (that file is client-only)
const feedAbi = parseAbi(["function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)"]);
const mainnet = createPublicClient({ chain: monad, transport: http("https://rpc.monad.xyz") });
const TIMEOUT = 5000;

async function probe<T>(fn: () => Promise<T>) {
  const t0 = performance.now();
  try {
    const out = await Promise.race([fn(), new Promise<never>((_, no) => setTimeout(() => no(new Error(`timeout ${TIMEOUT} ms`)), TIMEOUT))]);
    return { ok: true as const, ms: Math.round(performance.now() - t0), ...out };
  } catch (e) {
    const status = (e as { status?: number }).status; // viem HttpRequestError: 429 = public RPC rate limit
    const msg = (e instanceof Error ? e.message : String(e)).split("\n")[0].slice(0, 160);
    return { ok: false as const, ms: Math.round(performance.now() - t0), error: status ? `HTTP ${status}: ${msg}` : msg };
  }
}

/** Opens the same socket the LIVE KICAU feed uses and waits for the monadLogs subscription id. */
function monadLogs() {
  return new Promise<{ subscription: string }>((ok, no) => {
    if (typeof WebSocket === "undefined") return no(new Error("WebSocket unavailable in this runtime"));
    const ws = new WebSocket(WS_URL);
    let finished = false;
    const done = (f: () => void) => {
      if (finished) return; // undici can re-fire onerror from close(): settle once
      finished = true;
      clearTimeout(timer);
      ws.onerror = ws.onmessage = null;
      try {
        ws.close();
      } catch {}
      f();
    };
    const timer = setTimeout(() => done(() => no(new Error("no subscription reply"))), TIMEOUT - 200);
    ws.onopen = () => ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_subscribe", params: ["monadLogs", { address: ADDRESS }] }));
    ws.onmessage = (e) => {
      let m: { id?: number; result?: string; error?: { message?: string } };
      try {
        m = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (m.id !== 1) return;
      done(() => (m.result ? ok({ subscription: m.result }) : no(new Error(m.error?.message ?? "subscribe rejected"))));
    };
    ws.onerror = () => done(() => no(new Error("socket error")));
  });
}

export async function GET() {
  const c = { address: ADDRESS, abi: kicauAbi } as const;
  const [rpcs, websocket, contract, chainlink, x402] = await Promise.all([
    Promise.all(
      RPCS.map(async (url) => ({
        url,
        ...(await probe(async () => ({ head: Number(await createPublicClient({ chain: monadTestnet, transport: http(url, { retryCount: 0 }) }).getBlockNumber()) }))),
      })),
    ),
    probe(async () => ({ url: WS_URL, method: "monadLogs", ...(await monadLogs()) })),
    probe(async () => {
      const [supply, contests, week, conservation] = await Promise.all([
        client.readContract({ ...c, functionName: "totalSupply" }),
        client.readContract({ ...c, functionName: "contestCount" }),
        client.readContract({ ...c, functionName: "currentWeek" }),
        client.readContract({ ...c, functionName: "totalConservation" }),
      ]);
      return { address: ADDRESS, chainId: monadTestnet.id, totalSupply: Number(supply), contests: Number(contests), currentWeek: Number(week), totalConservationWei: String(conservation) };
    }),
    probe(async () => {
      const [, answer, , updatedAt] = await mainnet.readContract({ address: FEED, abi: feedAbi, functionName: "latestRoundData" });
      const age = Math.floor(Date.now() / 1000) - Number(updatedAt);
      // 1 h heartbeat: older than ~2 h means the feed is stale and the UI's USD line is wrong
      if (age > 7200) throw new Error(`stale: updated ${age}s ago`);
      return { feed: FEED, chainId: monad.id, monUsd: Number(answer) / 1e8, ageSec: age };
    }),
    probe(async () => {
      const res = await fetch(`${X402_FACILITATOR}/supported`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { kinds?: { network?: string; scheme?: string }[] };
      const kinds = (body.kinds ?? []).filter((k) => k.network === X402_NETWORK).map((k) => k.scheme);
      if (!kinds.length) throw new Error(`${X402_NETWORK} not supported`);
      return { url: X402_FACILITATOR, network: X402_NETWORK, schemes: kinds };
    }),
  ]);
  const ok = rpcs.some((r) => r.ok) && contract.ok; // the app works while any RPC + the contract answer
  return Response.json(
    { ok, checkedAt: new Date().toISOString(), rpcs, websocket, contract, chainlink, x402 },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30", "Access-Control-Allow-Origin": "*" } },
  );
}

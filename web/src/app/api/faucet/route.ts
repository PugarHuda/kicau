import { isAddress } from "viem";

// ponytail: per-instance in-memory limit (resets on cold start, not shared across instances).
// Generous on purpose: hackathon venues share one NAT IP. Upgrade to Vercel WAF / KV if abused.
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 15;
const hits = new Map<string, number[]>();

function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return true;
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear(); // bound memory
  return false;
}

// Proxies the devnads agent faucet (Monad testnet) so the browser burner can fund itself.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const address = body && typeof body === "object" ? (body as { address?: unknown }).address : undefined;
  if (typeof address !== "string" || !isAddress(address)) {
    return Response.json({ error: "Invalid address" }, { status: 400 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (limited(ip)) {
    return Response.json({ error: "Too many faucet requests, try again in a few minutes" }, { status: 429 });
  }
  const res = await fetch("https://agents.devnads.com/v1/faucet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chainId: 10143, address }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.txHash) {
    return Response.json({ error: out.error ?? out.message ?? `Faucet error ${res.status}` }, { status: 502 });
  }
  return Response.json({ txHash: out.txHash, amount: out.amount });
}

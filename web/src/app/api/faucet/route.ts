import { isAddress } from "viem";

// Proxies the devnads agent faucet (Monad testnet) so the browser burner can fund itself.
export async function POST(req: Request) {
  const { address } = await req.json().catch(() => ({}));
  if (typeof address !== "string" || !isAddress(address)) {
    return Response.json({ error: "Invalid address" }, { status: 400 });
  }
  const res = await fetch("https://agents.devnads.com/v1/faucet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chainId: 10143, address }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.txHash) {
    return Response.json({ error: body.error ?? body.message ?? `Faucet error ${res.status}` }, { status: 502 });
  }
  return Response.json({ txHash: body.txHash, amount: body.amount });
}

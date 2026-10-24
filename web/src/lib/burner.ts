import { createWalletClient, http, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { NET } from "./network";

// ponytail: testnet-only burner kept in localStorage. Anyone with access to this browser can use it; never fund it with real MON.
const KEY = "kicau:burner";

export function loadBurner() {
  if (!NET.faucet) return null; // mainnet: no burner, real wallets only
  try {
    const pk = localStorage.getItem(KEY) as Hex | null;
    return pk ? makeClient(pk) : null;
  } catch {
    return null;
  }
}

export function createBurner() {
  const pk = generatePrivateKey();
  try {
    localStorage.setItem(KEY, pk);
  } catch {
    // private mode: burner lives for this tab only
  }
  return makeClient(pk);
}

export function forgetBurner() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

function makeClient(pk: Hex) {
  // official RPC: supports eth_sendRawTransactionSync. It 429s under shared-IP load (venue NAT), so back off longer than
  // viem's default (3 tries, ~2 s) before showing "HTTP request failed": 5 tries, 0.4→6.4 s, honours Retry-After.
  return createWalletClient({ account: privateKeyToAccount(pk), chain: NET.chain, transport: http(undefined, { retryCount: 5, retryDelay: 200 }) });
}

export type BurnerClient = ReturnType<typeof makeClient>;

export async function fundBurner(address: string) {
  const res = await fetch("/api/faucet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Faucet failed");
  return body as { txHash: string; amount: string };
}

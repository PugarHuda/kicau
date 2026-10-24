import { createWalletClient, http, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";

// ponytail: testnet-only burner kept in localStorage. Anyone with access to this browser can use it; never fund it with real MON.
const KEY = "kicau:burner";

export function loadBurner() {
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
  return createWalletClient({ account: privateKeyToAccount(pk), chain: monadTestnet, transport: http() });
}

export type BurnerClient = ReturnType<typeof makeClient>;

export async function fundBurner(address: string) {
  const res = await fetch("/api/faucet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Faucet gagal");
  return body as { txHash: string; amount: string };
}

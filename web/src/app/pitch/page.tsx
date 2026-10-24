import type { Metadata } from "next";
import { createPublicClient, formatEther } from "viem";
import { monadTestnet } from "viem/chains";
import { kicauAbi } from "@/lib/abi";
import { rpcTransport } from "@/lib/rpc";
import { Deck, type LiveStats } from "./Deck";

export const metadata: Metadata = {
  title: "Kicau — Pitch",
  description: "Kicau pitch deck — Monad Blitz Jogja 2026.",
};

// Re-read chain numbers at most once a minute.
export const revalidate = 60;

const ADDRESS = (process.env.NEXT_PUBLIC_KICAU_ADDRESS ?? "") as `0x${string}`; // same env as the app (no hardcoded fallback: redeploys)

async function readStats(): Promise<LiveStats | null> {
  if (!ADDRESS) return null;
  const client = createPublicClient({ chain: monadTestnet, transport: rpcTransport });
  const base = { address: ADDRESS, abi: kicauAbi } as const;
  const read = Promise.all([
    client.readContract({ ...base, functionName: "totalSupply" }),
    client.readContract({ ...base, functionName: "totalConservation" }),
    client.readContract({ ...base, functionName: "getLeaderboard" }),
  ]);
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), 6000));
  try {
    const res = await Promise.race([read, timeout]);
    if (!res) return null;
    const [supply, conservation, [players]] = res;
    return {
      birds: Number(supply),
      conservation: Number(formatEther(conservation)).toLocaleString("en-US", { maximumFractionDigits: 4 }),
      players: players.length,
    };
  } catch {
    return null; // slides fall back to static proof
  }
}

export default async function PitchPage() {
  return <Deck stats={await readStats()} />;
}

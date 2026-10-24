"use client";

import { useQuery } from "@tanstack/react-query";
import { createPublicClient, fallback, http, parseAbi } from "viem";
import { monad } from "viem/chains";

// Chainlink MON/USD push feed on Monad MAINNET (chain 143): 0.02% deviation / 1h heartbeat.
// Source: https://docs.chain.link/data-feeds/price-feeds/addresses?network=monad · monad-crypto/protocols mainnet/chainlink.jsonc
// Testnet has no MON/USD Chainlink feed (and testnet MON has no market price), so we read the real price from mainnet.
export const MON_USD_FEED = "0xBcD78f76005B7515837af6b50c7C52BCf73822fb" as const;
const abi = parseAbi(["function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)"]);
const mainnet = createPublicClient({ chain: monad, transport: fallback([http("https://rpc.monad.xyz"), http("https://rpc1.monad.xyz")]) });

export async function fetchMonUsd() {
  const [, answer, , updatedAt] = await mainnet.readContract({ address: MON_USD_FEED, abi, functionName: "latestRoundData" });
  return { usd: Number(answer) / 1e8, updatedAt: Number(updatedAt) }; // feed has 8 decimals
}

/** Live MON/USD from Chainlink; undefined while loading or if the read fails (callers just hide the USD value). */
export function useMonUsd() {
  return useQuery({ queryKey: ["monUsd"], queryFn: fetchMonUsd, refetchInterval: 60_000, staleTime: 30_000 }).data;
}

export function fmtUsd(mon: number, price?: { usd: number }) {
  if (!price) return null;
  const v = mon * price.usd;
  return `≈ $${v < 1 ? v.toFixed(4) : v.toFixed(2)}`;
}

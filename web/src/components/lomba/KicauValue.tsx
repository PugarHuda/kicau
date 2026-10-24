"use client";

import { formatEther } from "viem";
import { useReadContract } from "wagmi";
import { fmtUsd, useMonUsd } from "@/lib/price";
import { kicau } from "@/lib/useKicau";

/** Reputation-driven sponsorship value of a registered bird (Kicau.valueBreakdown), with breakdown tooltip. */
export function KicauValue({ tokenId, className = "" }: { tokenId: bigint | number; className?: string }) {
  const { data: v } = useReadContract({ ...kicau, functionName: "valueBreakdown", args: [BigInt(tokenId)], query: { refetchInterval: 30_000 } });
  const monUsd = useMonUsd();
  if (!v) return <span className={`text-xs text-muted ${className}`}>Kicau Value …</span>;
  const raw = v.base + v.wins + v.attestations + v.supporters + v.support + v.runs;
  const stale = v.freshnessPct < 100n;
  const trend = stale ? "▼" : raw > v.base ? "▲" : "";
  const tip = [
    `Base ${v.base}`,
    `Contest wins +${v.wins}`,
    `Organizer attestations (titles + certificates) +${v.attestations}`,
    `Supporters +${v.supporters}`,
    `Support raised +${v.support}`,
    `Best verified run +${v.runs}`,
    `Freshness ×${v.freshnessPct}%${stale ? " (not updated for over 7 days)" : ""}`,
    `= ${v.points} pts × 0.0001 MON`,
    ...(monUsd ? ["USD (Chainlink MON/USD)"] : []),
  ].join("\n");
  const usd = fmtUsd(Number(formatEther(v.priceWei)), monUsd);
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 text-xs ${className}`} title={tip}>
      <span className="font-semibold">
        Kicau Value <span className="tabular-nums">{Number(v.points).toLocaleString("en-US")}</span> pts · ≈{" "}
        <span className="tabular-nums">{formatEther(v.priceWei)}</span> MON
        {usd && <span className="tabular-nums"> · {usd}</span>}
      </span>
      {trend && <span className={stale ? "text-clay" : "text-leaf"}>{trend}</span>}
      {stale && <span className="border-2 border-clay px-1 font-bold text-clay">⚠ update due</span>}
    </span>
  );
}

"use client";

import { formatEther } from "viem";
import { useReadContract } from "wagmi";
import { kicau } from "@/lib/useKicau";

/** Reputation-driven sponsorship value of a registered bird (Kicau.valueBreakdown), with breakdown tooltip. */
export function KicauValue({ tokenId, className = "" }: { tokenId: bigint | number; className?: string }) {
  const { data: v } = useReadContract({ ...kicau, functionName: "valueBreakdown", args: [BigInt(tokenId)], query: { refetchInterval: 30_000 } });
  if (!v) return <span className={`text-xs text-muted ${className}`}>Kicau Value …</span>;
  const raw = v.base + v.wins + v.attestations + v.supporters + v.support + v.runs;
  const stale = v.freshnessPct < 100n;
  const trend = stale ? "▼" : raw > v.base ? "▲" : "";
  const tip = [
    `Base ${v.base}`,
    `Contest wins +${v.wins}`,
    `Organizer titles +${v.attestations}`,
    `Supporters +${v.supporters}`,
    `Support raised +${v.support}`,
    `Best verified run +${v.runs}`,
    `Freshness ×${v.freshnessPct}%${stale ? " (not updated for over 7 days)" : ""}`,
    `= ${v.points} pts × 0.0001 MON`,
  ].join("\n");
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 text-xs ${className}`} title={tip}>
      <span className="font-semibold">
        Kicau Value {Number(v.points).toLocaleString("en-US")} pts · ≈ {formatEther(v.priceWei)} MON
      </span>
      {trend && <span className={stale ? "text-clay" : "text-leaf"}>{trend}</span>}
      {stale && <span className="border-2 border-clay px-1 font-bold text-clay">⚠ update due</span>}
    </span>
  );
}

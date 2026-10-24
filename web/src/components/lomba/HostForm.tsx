"use client";

import { useState } from "react";
import { isAddress, parseEther, parseEventLogs } from "viem";
import { kicauAbi } from "@/lib/abi";
import type { Kicau } from "@/lib/useKicau";

const field = "mt-1 w-full border-[3px] border-ink bg-paper px-3 py-2";

/** Host a contest: permissionless, the sender becomes host. */
export function HostForm({ k, onCreated }: { k: Kicau; onCreated: (id: number) => void }) {
  const [name, setName] = useState("");
  const [cls, setCls] = useState("Murai Batu");
  const [fee, setFee] = useState("0.001");
  const [judges, setJudges] = useState("");
  const [minutes, setMinutes] = useState("60");

  const judgeList = judges.split(/[\s,]+/).filter(Boolean);
  const badJudge = judgeList.find((j) => !isAddress(j));
  const bytes = (s: string) => new TextEncoder().encode(s.trim()).length;
  let feeWei: bigint | null = null;
  try {
    feeWei = parseEther(fee || "0");
  } catch {}
  const valid =
    bytes(name) > 0 && bytes(name) <= 64 && bytes(cls) > 0 && bytes(cls) <= 32 && feeWei !== null &&
    judgeList.length >= 1 && judgeList.length <= 5 && !badJudge && Number(minutes) > 0;

  async function submit() {
    if (!valid || feeWei === null) return;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + Math.round(Number(minutes) * 60));
    const receipt = await k.sendTx({
      functionName: "createContest",
      args: [name.trim(), cls.trim(), feeWei, judgeList as `0x${string}`[], deadline],
    });
    if (!receipt) return;
    const [log] = parseEventLogs({ abi: kicauAbi, eventName: "ContestCreated", logs: receipt.logs });
    if (log) onCreated(Number(log.args.contestId));
  }

  return (
    <div className="rounded-3xl border border-line bg-paper p-4 sm:p-6">
      <h2 className="mb-1 font-display text-2xl">Host a contest</h2>
      <p className="mb-4 text-sm text-muted">Anyone can host. Entry fees form the prize pool: 50 / 25 / 15% to the top 3, 10% to conservation.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold sm:col-span-2">
          Contest name
          <input className={field} value={name} maxLength={64} onChange={(e) => setName(e.target.value)} placeholder="Piala Kicau Jogja" />
        </label>
        <label className="text-sm font-semibold">
          Class
          <input className={field} value={cls} maxLength={32} onChange={(e) => setCls(e.target.value)} placeholder="Murai Batu" />
        </label>
        <label className="text-sm font-semibold">
          Entry fee (MON)
          <input className={field} value={fee} inputMode="decimal" onChange={(e) => setFee(e.target.value)} />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Judges (1–5 addresses, comma-separated)
          <textarea className={`${field} font-mono text-xs`} rows={2} value={judges} onChange={(e) => setJudges(e.target.value)} placeholder="0x…, 0x…" />
        </label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <button
            type="button"
            className="btn-ghost !py-2"
            disabled={!k.address || judgeList.some((j) => j.toLowerCase() === k.address?.toLowerCase())}
            onClick={() => setJudges((j) => [...j.split(/[\s,]+/).filter(Boolean), k.address!].join(", "))}
          >
            + Add me
          </button>
          {badJudge && <span className="text-sm text-clay">Not an address: {badJudge.slice(0, 14)}…</span>}
        </div>
        <label className="text-sm font-semibold">
          Entries close in (minutes)
          <input className={field} value={minutes} inputMode="numeric" onChange={(e) => setMinutes(e.target.value)} />
        </label>
        <div className="flex items-end">
          <button className="btn-primary w-full" disabled={!valid || !k.ready || k.txBusy} onClick={submit}>
            {k.txBusy ? "Sending…" : "Create contest"}
          </button>
        </div>
      </div>
    </div>
  );
}

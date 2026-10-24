"use client";

import Link from "next/link";
import { formatEther } from "viem";
import { useReadContract } from "wagmi";
import { useBirdHistory } from "@/components/BirdProof";
import { TxLink } from "@/components/ui";
import { fmtMon, freshnessPct } from "@/lib/birdHistory";
import { kicau, useKicau } from "@/lib/useKicau";

const DAY = 86400;

/** Owner side of a bird profile: what makes up its value, how to raise it, what it earned, what's claimable. */
export function OwnerDashboard({ tokenId }: { tokenId: bigint }) {
  const k = useKicau();
  const { data: owner } = useReadContract({ ...kicau, functionName: "ownerOf", args: [tokenId] });
  const isOwner = !!k.address && !!owner && owner.toLowerCase() === k.address.toLowerCase();
  const { data: owed } = useReadContract({ ...kicau, functionName: "owed", args: k.address ? [k.address] : undefined, query: { enabled: isOwner } });
  const { data: h } = useBirdHistory(tokenId);
  if (!isOwner) return null;

  const me = k.address!.toLowerCase();
  const v = h?.onchain;
  const s = h?.state;
  const supportsToMe = h?.events.filter((e) => e.kind === "supported" && e.keeper?.toLowerCase() === me) ?? [];
  const supportEarned = supportsToMe.reduce((a, e) => a + (e.keeperWei ?? 0n), 0n);
  const results = h?.events.filter((e) => e.kind === "contest" || e.kind === "cancelled") ?? [];
  const prizeEarned = results.reduce((a, e) => a + (e.keeper?.toLowerCase() === me ? (e.prizeWei ?? 0n) : 0n), 0n);

  const tips: string[] = [];
  if (h && v && s) {
    const fresh = freshnessPct(h.headTime, s.lastUpdated);
    if (fresh < 100) tips.push(`Value decaying ${100 - fresh}% — update your bird now to restore 100%.`);
    else {
      const left = s.lastUpdated + 8 * DAY - h.headTime; // decay starts once 8 whole days have passed
      tips.push(left < DAY ? "Update due today — value starts decaying tomorrow." : `Update due in ${Math.floor(left / DAY)} days — value starts decaying after that (−5%/day).`);
    }
    tips.push(
      s.w1 + s.w2 + s.w3 === 0
        ? "Enter a contest — a 1st place adds +250 (2nd +150, 3rd +100)."
        : `Defend the title — another 1st place adds +250 (podiums so far: ${s.w1}× 1st, ${s.w2}× 2nd, ${s.w3}× 3rd).`,
    );
    tips.push(`Ask an organizer to attest your title: +80 each (${s.att} active now).`);
    if (v.runs < 500n) tips.push(`Fly a verified run: +2 per point of your best run (best ${s.bestRun}, cap 250 points).`);
    if (v.support < 500n) tips.push("Share your bird: each supporter adds +10, and every 0.01 MON raised +1 (cap +500).");
  }

  return (
    <section className="mt-4 border-[3px] border-ink bg-sun/15 p-3 text-sm">
      <div className="mb-2 font-display text-xs">Owner dashboard — you keep this bird</div>
      {!h || !v ? (
        <p className="text-muted">Loading your bird&apos;s numbers…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="font-semibold">Value breakdown</div>
            <table className="mt-1 w-full text-xs tabular-nums">
              <tbody>
                {(
                  [
                    ["Base", v.base],
                    ["Contest wins", v.wins],
                    ["Organizer titles", v.attestations],
                    ["Supporters", v.supporters],
                    ["Support raised", v.support],
                    ["Best verified run", v.runs],
                  ] as const
                ).map(([l, n]) => (
                  <tr key={l}>
                    <td>{l}</td>
                    <td className="text-right">+{String(n)}</td>
                  </tr>
                ))}
                <tr>
                  <td>Freshness</td>
                  <td className={`text-right ${v.freshnessPct < 100n ? "font-bold text-clay" : ""}`}>×{String(v.freshnessPct)}%</td>
                </tr>
                <tr className="border-t-2 border-ink font-bold">
                  <td>Kicau Value</td>
                  <td className="text-right">
                    {String(v.points)} pts ≈ {formatEther(v.priceWei)} MON
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <div className="font-semibold">How to raise it</div>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
              {tips.map((t) => (
                <li key={t} className={t.startsWith("Value decaying") ? "font-bold text-clay" : ""}>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-semibold">Earned as keeper</div>
            <p className="text-xs">
              <b>{fmtMon(supportEarned + prizeEarned)} MON</b> — {fmtMon(supportEarned)} from {supportsToMe.length} support
              {supportsToMe.length === 1 ? "" : "s"} (70% share) + {fmtMon(prizeEarned)} in contest prizes. Paid straight to your
              address in the same tx.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span>Claimable (failed pushes): {owed !== undefined ? formatEther(owed) : "…"} MON</span>
              {!!owed && owed > 0n && (
                <button className="btn-primary !px-2 !py-1 !text-[0.6rem]" disabled={k.txBusy || !k.ready} onClick={() => k.send({ functionName: "withdrawOwed", args: [] })}>
                  {k.txBusy ? "Sending…" : "Withdraw"}
                </button>
              )}
            </div>
            {k.error && <p className="mt-1 text-xs text-clay">{k.error}</p>}
            <TxLink hash={k.lastTx} />
          </div>
          <div>
            <div className="font-semibold">Contest history</div>
            {!results.length ? (
              <p className="text-xs text-muted">No finished contests yet.</p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-xs">
                {results.map((e) => (
                  <li key={e.txHash}>
                    <Link href={`/lomba#${e.contestId}`} className="underline">
                      {e.label}
                    </Link>
                    {!!e.prizeWei && ` · +${fmtMon(e.prizeWei)} MON`}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Link href="/lomba#my-birds" className="btn-ghost !px-2 !py-2 !text-[0.6rem]">
              Update my bird
            </Link>
            <Link href="/lomba" className="btn-ghost !px-2 !py-2 !text-[0.6rem]">
              Enter a contest
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

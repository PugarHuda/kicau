"use client";

import { useQuery } from "@tanstack/react-query";
import { formatEther } from "viem";
import { usePublicClient, useReadContract } from "wagmi";
import { kicauAbi } from "@/lib/abi";
import { KICAU_ADDRESS } from "@/lib/config";
import { CUSTOM_SPECIES } from "@/lib/customBirds";
import { fmtUsd, useMonUsd } from "@/lib/price";

const kicau = { address: KICAU_ADDRESS, abi: kicauAbi } as const;

/** Venue-style LED scoreboard: live contract reads ("—" until they land), plus Monad's documented finality. */
export function ChainStats() {
  const enabled = Boolean(KICAU_ADDRESS);
  const client = usePublicClient();
  const live = { enabled, refetchInterval: 15_000 };
  const { data: contests } = useReadContract({ ...kicau, functionName: "contestCount", query: live });
  const { data: supply } = useReadContract({ ...kicau, functionName: "totalSupply", query: live });
  const { data: raised } = useReadContract({ ...kicau, functionName: "totalConservation", query: live });
  const monUsd = useMonUsd();
  // one multicall over speciesOf: how many of the NFTs are real, registered birds
  const { data: realBirds } = useQuery({
    queryKey: ["realBirdCount", KICAU_ADDRESS, String(supply)],
    enabled: !!client && supply !== undefined,
    staleTime: 15_000,
    queryFn: async () => {
      const res = await client!.multicall({
        contracts: Array.from({ length: Number(supply) }, (_, i) => ({ ...kicau, functionName: "speciesOf", args: [BigInt(i)] }) as const),
        allowFailure: true,
      });
      return res.filter((r) => r.result === BigInt(CUSTOM_SPECIES)).length;
    },
  });

  const mon = raised !== undefined ? Number(formatEther(raised)) : undefined;
  const cells = [
    { label: "Contests on-chain", value: contests?.toString(), note: "created by organizers" },
    {
      label: "Birds on-chain",
      value: supply?.toString(),
      note: realBirds !== undefined ? `${realBirds} real birds registered` : "NFTs minted",
    },
    {
      label: "To conservation",
      value: mon !== undefined ? `${mon.toFixed(3)}` : undefined,
      unit: "MON",
      note: mon !== undefined && monUsd ? `${fmtUsd(mon, monUsd)} · Chainlink MON/USD` : "forwarded with every tx",
    },
    // spec value, not measured: Monad docs list 400 ms blocks and 800 ms finality
    { label: "Finality · spec", value: "~0.8", unit: "s", note: "Monad docs value, not a live read" },
  ];

  return (
    <section className="led-board bleed" aria-label="Live on-chain stats">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 sm:px-6 lg:grid-cols-4">
        {cells.map((c) => (
          <div key={c.label} className="led-cell px-3 py-5 sm:px-5">
            <div className="mb-2 font-display text-[0.55rem] uppercase text-paper/60">{c.label}</div>
            <div className="led-num font-display tabular-nums">
              {c.value ?? "—"}
              {c.unit && c.value && <span className="ml-1 text-[0.6rem] text-paper/70">{c.unit}</span>}
            </div>
            <div className="mt-2 text-xs text-paper/70">{c.note}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

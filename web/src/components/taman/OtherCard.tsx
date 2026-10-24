"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient, useReadContract } from "wagmi";
import { BirdArt, short } from "@/components/ui";
import { BIRDS } from "@/lib/birds";
import { EXPLORER, KICAU_ADDRESS } from "@/lib/config";
import { CUSTOM_SPECIES } from "@/lib/customBirds";
import { kicau } from "@/lib/useKicau";

export type Other = { tokenId: number; owner: `0x${string}`; species: number };

/** Newest species NFTs (not registered birds) not owned by `me`: one multicall for owner + species. */
export function useOtherNfts(me?: string, scan = 20) {
  const client = usePublicClient();
  const { data } = useQuery({
    queryKey: ["otherNfts", KICAU_ADDRESS, scan],
    enabled: !!client && !!KICAU_ADDRESS,
    refetchInterval: 30_000,
    queryFn: async () => {
      const total = Number(await client!.readContract({ ...kicau, functionName: "totalSupply" }));
      const ids = Array.from({ length: Math.min(total, scan) }, (_, i) => BigInt(total - 1 - i));
      const res = await client!.multicall({
        contracts: ids.flatMap((id) => [
          { ...kicau, functionName: "ownerOf", args: [id] } as const,
          { ...kicau, functionName: "speciesOf", args: [id] } as const,
        ]),
        allowFailure: true,
      });
      return ids.flatMap((id, i): Other[] => {
        const owner = res[i * 2].result as `0x${string}` | undefined;
        const sp = res[i * 2 + 1].result as bigint | undefined;
        return owner && sp !== undefined && sp !== BigInt(CUSTOM_SPECIES) ? [{ tokenId: Number(id), owner, species: Number(sp) }] : [];
      });
    },
  });
  return (data ?? []).filter((n) => n.owner.toLowerCase() !== me?.toLowerCase());
}

/** Another player's species NFT: art, owner, best score (used in /taman and the home Kicau Garden). */
export function OtherCard({ nft }: { nft: Other }) {
  const { data: best } = useReadContract({ ...kicau, functionName: "bestByToken", args: [BigInt(nft.tokenId)] });
  const { data: verified } = useReadContract({ ...kicau, functionName: "bestValidatedByPlayer", args: [nft.owner] });
  return (
    <div>
      <div className="mb-4 grid place-items-center bg-cream py-6">
        <BirdArt id={nft.species} className="h-32 w-auto" />
      </div>
      <h2 className="mb-1 font-display text-2xl">
        {BIRDS[nft.species]?.name ?? "Bird"} <span className="text-muted">#{nft.tokenId}</span>
      </h2>
      <p className="mb-3 text-sm text-muted">
        Owned by{" "}
        <a href={`${EXPLORER}/address/${nft.owner}`} target="_blank" rel="noreferrer" className="font-mono underline">
          {short(nft.owner)}
        </a>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="border-[3px] border-ink p-3">
          <div className="font-display text-xs">Best score</div>
          <div className="font-display text-2xl tabular-nums">{best !== undefined ? String(best) : "…"}</div>
        </div>
        <div className="border-[3px] border-ink p-3">
          <div className="font-display text-xs">Owner&apos;s verified best</div>
          <div className="font-display text-2xl tabular-nums">
            {verified !== undefined ? String(verified) : "…"}
            {!!verified && <span className="ml-1 align-middle text-xs text-leaf">✔ verified</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

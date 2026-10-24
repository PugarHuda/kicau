import type { PublicClient } from "viem";
import { kicauAbi } from "./abi";
import { bytesToDataUrl } from "./pixelate";
import { hexToBytes } from "viem";

export const CUSTOM_SPECIES = 999;

/** Reads a registered bird's pixel sprite from its BirdRegistered log, querying only the block it was minted in. */
export async function fetchCustomBird(client: PublicClient, address: `0x${string}`, tokenId: bigint) {
  const block = await client.readContract({ address, abi: kicauAbi, functionName: "registeredAt", args: [tokenId] });
  const [log] = await client.getContractEvents({
    address,
    abi: kicauAbi,
    eventName: "BirdRegistered",
    args: { tokenId },
    fromBlock: block,
    toBlock: block,
  });
  if (!log) return null;
  return { name: log.args.name ?? "", image: bytesToDataUrl(hexToBytes(log.args.image ?? "0x")) };
}

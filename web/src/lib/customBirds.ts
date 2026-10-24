import { hexToBytes, type PublicClient } from "viem";
import { kicauAbi } from "./abi";
import { birdDataUri } from "./birds";
import { decodeBirdImage } from "./pixelate";

export const CUSTOM_SPECIES = 999;

/** Reads a registered bird from its BirdRegistered log, querying only the block it was minted in. */
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
  const decoded = decodeBirdImage(hexToBytes(log.args.image ?? "0x"));
  if (!decoded) return null;
  const name = log.args.name ?? "";
  const owner = log.args.owner ?? "0x";
  const { profile } = decoded;
  if ("png" in decoded) return { tokenId, name, owner, profile, image: decoded.png, imageUp: undefined };
  return {
    tokenId,
    name,
    owner,
    profile,
    image: birdDataUri(0, false, decoded.colors),
    imageUp: birdDataUri(0, true, decoded.colors),
  };
}

export type CustomBird = NonNullable<Awaited<ReturnType<typeof fetchCustomBird>>>;

/** All registered birds, newest first, via ERC721Enumerable (no indexer, no wide getLogs). */
export async function fetchRegisteredBirds(client: PublicClient, address: `0x${string}`, limit = 12) {
  const total = await client.readContract({ address, abi: kicauAbi, functionName: "totalSupply" });
  const ids = Array.from({ length: Number(total) }, (_, i) => BigInt(Number(total) - 1 - i));
  const species = await client.multicall({
    contracts: ids.map((id) => ({ address, abi: kicauAbi, functionName: "speciesOf", args: [id] }) as const),
    allowFailure: true,
  });
  const custom = ids.filter((_, i) => species[i].result === BigInt(CUSTOM_SPECIES)).slice(0, limit);
  const birds = await Promise.all(custom.map((id) => fetchCustomBird(client, address, id).catch(() => null)));
  return birds.filter((b): b is CustomBird => !!b);
}

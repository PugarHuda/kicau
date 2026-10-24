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
  // v6: the keeper may have published newer bytes via updateBird; read the latest BirdUpdated log.
  const upBlock = await client
    .readContract({ address, abi: kicauAbi, functionName: "updatedAtBlock", args: [tokenId] })
    .catch(() => 0n);
  const updates = upBlock
    ? await client
        .getContractEvents({ address, abi: kicauAbi, eventName: "BirdUpdated", args: { tokenId }, fromBlock: upBlock, toBlock: upBlock })
        .catch(() => [])
    : [];
  const latestImage = updates.at(-1)?.args.image ?? log.args.image;
  const decoded = decodeBirdImage(hexToBytes(latestImage ?? "0x"));
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
    colors: decoded.colors,
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

/** A registered bird is worth showing publicly if its card has real content (the owner name alone doesn't count). */
export function hasProfile(b: CustomBird, attestations = 0) {
  const p = b.profile;
  const str = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  const arr = (v: unknown) => Array.isArray(v) && v.length > 0;
  return attestations > 0 || str(p.story) || arr(p.titles) || arr(p.certificates) || arr(p.wins) || str(p.species) || str(p.latin) || str(p.certificate) || !!p.lineage;
}

/** Display curation for the home page: no empty profiles, no same-owner duplicate names (newest kept), sorted by Kicau Value. */
export async function fetchCommunityBirds(client: PublicClient, address: `0x${string}`) {
  const birds = await fetchRegisteredBirds(client, address, 24); // newest first
  const res = await client.multicall({
    contracts: birds.flatMap((b) => [
      { address, abi: kicauAbi, functionName: "valueOf", args: [b.tokenId] } as const,
      { address, abi: kicauAbi, functionName: "attestationsOf", args: [b.tokenId] } as const,
    ]),
    allowFailure: true,
  });
  const seen = new Set<string>();
  return birds
    .map((b, i) => {
      const value = (res[i * 2].result as readonly [bigint, bigint] | undefined)?.[1] ?? 0n;
      const att = (res[i * 2 + 1].result as readonly { revoked: boolean }[] | undefined)?.filter((a) => !a.revoked).length ?? 0;
      return { bird: b, value, att };
    })
    .filter(({ bird, att }) => hasProfile(bird, att) && !isTestEntity(bird.name))
    .filter(({ bird }) => {
      const k = `${bird.owner.toLowerCase()}:${bird.name.trim().toLowerCase()}`;
      if (seen.has(k)) return false; // newest of each owner+name already kept
      seen.add(k);
      return true;
    })
    .sort((a, b) => (b.value > a.value ? 1 : b.value < a.value ? -1 : 0))
    .map(({ bird }) => bird);
}

/** Display curation: QA/test contests and demo/QA birds stay on-chain but are hidden from public lists (owners still see their own). */
export const isTestEntity = (name: string | undefined) => /^\s*(qa\b|proof cup|test|demo bird)/i.test(name ?? "");

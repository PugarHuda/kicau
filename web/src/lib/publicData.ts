// Server-side reads behind the public JSON API, share pages and OG images. Live chain data, no cache layer.
import { createPublicClient, formatEther } from "viem";
import { NET } from "./network";
import { kicauAbi } from "./abi";
import { STATUS, payouts, rankEntries } from "./contestLive";
import { CUSTOM_SPECIES, fetchCustomBird } from "./customBirds";
import { rpcTransport } from "./rpc";

export const ADDRESS = NET.address;
export const SITE = NET.site;
export const client = createPublicClient({ chain: NET.chain, transport: rpcTransport });
const base = { address: ADDRESS, abi: kicauAbi } as const;

export const parseId = (raw: string) => (/^\d{1,10}$/.test(raw) ? BigInt(raw) : null);

export async function readContest(id: bigint) {
  if (!ADDRESS) return null;
  const count = await client.readContract({ ...base, functionName: "contestCount" });
  if (id >= count) return null;
  const [c, [ids, totals]] = await Promise.all([
    client.readContract({ ...base, functionName: "getContest", args: [id] }),
    client.readContract({ ...base, functionName: "entriesOf", args: [id] }),
  ]);
  const [org, owners, birds] = await Promise.all([
    client.readContract({ ...base, functionName: "organizers", args: [c.host] }),
    client.multicall({ contracts: ids.map((t) => ({ ...base, functionName: "ownerOf", args: [t] }) as const), allowFailure: true }),
    Promise.all(ids.map((t) => fetchCustomBird(client, ADDRESS, t).catch(() => null))),
  ]);
  const status = STATUS[c.status];
  const pool = status === "Finalized" ? c.entryFee * c.entryCount : c.pool; // pool is zeroed on-chain at finalize
  const ranked = rankEntries(ids.map((t, i) => ({ tokenId: t, index: i, total: totals[i], keeper: owners[i]?.result, bird: birds[i] })));
  const { prizes } = payouts(pool, Math.min(3, ranked.length));
  return {
    id: Number(id),
    name: c.name,
    class: c.class_,
    status,
    host: c.host,
    verifiedOrganizer: org[1] ? org[0] : null,
    judges: c.judges,
    entryFeeMon: formatEther(c.entryFee),
    poolMon: formatEther(pool),
    entryDeadline: new Date(Number(c.entryDeadline) * 1000).toISOString(),
    maxTotal: c.judges.length * 40,
    entries: ranked.map((r, rank) => ({
      rank: rank + 1,
      tokenId: Number(r.tokenId),
      name: r.bird?.name ?? `#${r.tokenId}`,
      keeper: r.keeper ?? null,
      total: Number(r.total),
      prizeMon: status === "Finalized" && rank < 3 ? formatEther(prizes[rank]) : null,
      image: r.bird?.image ?? null,
    })),
  };
}

export async function readBird(id: bigint) {
  if (!ADDRESS) return null;
  const species = await client.readContract({ ...base, functionName: "speciesOf", args: [id] }).catch(() => null);
  if (species !== BigInt(CUSTOM_SPECIES)) return null;
  const [bird, owner, registeredAt, version, wins, att, v] = await Promise.all([
    fetchCustomBird(client, ADDRESS, id),
    client.readContract({ ...base, functionName: "ownerOf", args: [id] }),
    client.readContract({ ...base, functionName: "registeredAt", args: [id] }),
    client.readContract({ ...base, functionName: "profileVersion", args: [id] }),
    client.readContract({ ...base, functionName: "winsOf", args: [id] }),
    client.readContract({ ...base, functionName: "attestationsOf", args: [id] }),
    client.readContract({ ...base, functionName: "valueBreakdown", args: [id] }),
  ]);
  if (!bird) return null;
  const orgs = [...new Set(att.map((a) => a.organizer))];
  const orgNames = await Promise.all(orgs.map((o) => client.readContract({ ...base, functionName: "organizers", args: [o] })));
  const orgName = Object.fromEntries(orgs.map((o, i) => [o, orgNames[i][0]]));
  return {
    tokenId: Number(id),
    name: bird.name,
    keeper: owner, // current NFT holder
    registeredBy: bird.owner,
    registeredAtBlock: Number(registeredAt),
    profileVersion: Number(version),
    selfDeclared: bird.profile, // keeper-supplied, unverified
    contestWins: { first: Number(wins[0]), second: Number(wins[1]), third: Number(wins[2]) },
    verifiedTitles: att.map((a, index) => ({
      index,
      title: a.title,
      organizer: a.organizer,
      organizerName: orgName[a.organizer] ?? "",
      timestamp: new Date(Number(a.timestamp) * 1000).toISOString(),
      revoked: a.revoked,
    })),
    kicauValue: { points: Number(v.points), priceMon: formatEther(v.priceWei), freshnessPct: Number(v.freshnessPct) },
    image: bird.image,
  };
}

export const proof = (path: string) => ({
  chainId: NET.chainId,
  contract: ADDRESS,
  explorer: `${NET.explorer}/address/${ADDRESS}`,
  readAt: new Date().toISOString(),
  page: `${SITE}${path}`,
});

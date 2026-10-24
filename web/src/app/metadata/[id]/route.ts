import { createPublicClient } from "viem";
import { monadTestnet } from "viem/chains";
import { kicauAbi } from "@/lib/abi";
import { BIRDS, birdDataUri } from "@/lib/birds";
import { fetchCustomBird } from "@/lib/customBirds";
import { CERT_LABELS, lineageText } from "@/lib/pixelate";
import { rpcTransport } from "@/lib/rpc";

const KICAU_ADDRESS = (process.env.NEXT_PUBLIC_KICAU_ADDRESS ?? "") as `0x${string}`;

const client = createPublicClient({ chain: monadTestnet, transport: rpcTransport });

// tokenURI = <baseURI><speciesId>.json, or <baseURI>c<tokenId>.json for registered birds.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const raw = (await params).id.replace(/\.json$/, "");

  if (raw.startsWith("c")) {
    const tokenId = /^c\d+$/.test(raw) ? BigInt(raw.slice(1)) : null;
    const bird = tokenId !== null && KICAU_ADDRESS ? await fetchCustomBird(client, KICAU_ADDRESS, tokenId).catch(() => null) : null;
    if (!bird) return Response.json({ error: "unknown bird" }, { status: 404 });
    const verified = await client
      .readContract({ address: KICAU_ADDRESS, abi: kicauAbi, functionName: "attestationsOf", args: [tokenId!] })
      .catch(() => []);
    return Response.json(
      {
        name: `Kicau · ${bird.name}`,
        description:
          bird.profile.story ||
          "A real songbird owned by its keeper, redrawn in Kicau pixel style. Its character and pedigree are stored on-chain on Monad.",
        image: bird.image,
        attributes: [
          { trait_type: "Type", value: "Registered" },
          ...(bird.profile.owner ? [{ trait_type: "Owner", value: bird.profile.owner }] : []),
          ...(bird.profile.certificate ? [{ trait_type: "Certificate", value: bird.profile.certificate }] : []),
          ...(lineageText(bird.profile.lineage) ? [{ trait_type: "Lineage (self-declared)", value: lineageText(bird.profile.lineage) }] : []),
          ...(bird.profile.species ? [{ trait_type: "Species", value: bird.profile.species }] : []),
          ...(Array.isArray(bird.profile.certificates) ? bird.profile.certificates : []).map((c) => ({
            trait_type: `${CERT_LABELS[c.type] ?? "Certificate"} (self-declared)`,
            value: [c.issuer, c.number].filter(Boolean).join(" "),
          })),
          ...(Array.isArray(bird.profile.wins) ? bird.profile.wins : []).map((w) => ({ trait_type: "Win (self-declared)", value: [w.rank && `#${w.rank}`, w.event].filter(Boolean).join(" ") })),
          ...(bird.profile.titles ?? []).map((t) => ({ trait_type: "Title (self-declared)", value: t })),
          ...verified.filter((a) => !a.revoked).map((a) => ({ trait_type: "Verified title", value: a.title })),
        ],
      },
      // Not immutable: updateBird publishes new versions and organizers attest/revoke titles.
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=600" } },
    );
  }

  const bird = /^\d+$/.test(raw) ? BIRDS[Number(raw)] : undefined;
  if (!bird) return Response.json({ error: "unknown species" }, { status: 404 });
  const id = Number(raw);
  return Response.json({
    name: `Kicau · ${bird.name}`,
    description: bird.description,
    image: birdDataUri(id),
    attributes: [
      { trait_type: "Latin", value: bird.latin },
      { trait_type: "IUCN", value: bird.iucn },
      { trait_type: "Rarity", value: bird.rarity },
    ],
  }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
}

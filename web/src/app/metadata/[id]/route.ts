import { createPublicClient, http } from "viem";
import { monadTestnet } from "viem/chains";
import { BIRDS, birdDataUri } from "@/lib/birds";
import { fetchCustomBird } from "@/lib/customBirds";

const KICAU_ADDRESS = (process.env.NEXT_PUBLIC_KICAU_ADDRESS ?? "") as `0x${string}`;

const client = createPublicClient({ chain: monadTestnet, transport: http() });

// tokenURI = <baseURI><speciesId>.json, or <baseURI>c<tokenId>.json for registered birds.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const raw = (await params).id.replace(/\.json$/, "");

  if (raw.startsWith("c")) {
    const tokenId = /^c\d+$/.test(raw) ? BigInt(raw.slice(1)) : null;
    const bird = tokenId !== null && KICAU_ADDRESS ? await fetchCustomBird(client, KICAU_ADDRESS, tokenId).catch(() => null) : null;
    if (!bird) return Response.json({ error: "unknown bird" }, { status: 404 });
    return Response.json(
      {
        name: `Kicau · ${bird.name}`,
        description:
          bird.profile.story ||
          "Burung kicau asli milik pemiliknya, digambar ulang dengan gaya pixel Kicau. Karakter dan silsilahnya tersimpan on-chain di Monad.",
        image: bird.image,
        attributes: [
          { trait_type: "Type", value: "Registered" },
          ...(bird.profile.owner ? [{ trait_type: "Pemilik", value: bird.profile.owner }] : []),
          ...(bird.profile.certificate ? [{ trait_type: "Sertifikat", value: bird.profile.certificate }] : []),
          ...(bird.profile.lineage ? [{ trait_type: "Keturunan", value: bird.profile.lineage }] : []),
          ...(bird.profile.titles ?? []).map((t) => ({ trait_type: "Prestasi", value: t })),
        ],
      },
      { headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
    );
  }

  const id = Number.parseInt(raw, 10);
  const bird = BIRDS[id];
  if (!bird) return Response.json({ error: "unknown species" }, { status: 404 });
  return Response.json({
    name: `Kicau · ${bird.name}`,
    description: bird.description,
    image: birdDataUri(id),
    attributes: [
      { trait_type: "Latin", value: bird.latin },
      { trait_type: "IUCN", value: bird.iucn },
      { trait_type: "Rarity", value: bird.rarity },
    ],
  });
}

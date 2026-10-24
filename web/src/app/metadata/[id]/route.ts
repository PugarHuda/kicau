import { BIRDS, birdDataUri } from "@/lib/birds";

// tokenURI = <baseURI><speciesId>.json → set baseURI to https://<host>/metadata/
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number.parseInt((await params).id, 10);
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

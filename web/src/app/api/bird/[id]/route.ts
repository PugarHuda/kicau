import { SITE, parseId, proof, readBird } from "@/lib/publicData";

// Public read-only API: GET /api/bird/<tokenId> → registered bird, current keeper, contest wins, organizer-attested titles.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const raw = (await params).id;
  const id = parseId(raw);
  if (id === null) return Response.json({ error: "Invalid token id" }, { status: 400 });
  try {
    const bird = await readBird(id);
    if (!bird) return Response.json({ error: "Not a registered bird" }, { status: 404 });
    return Response.json(
      { bird: { ...bird, image: undefined, metadata: `${SITE}/metadata/c${raw}.json` }, proof: proof(`/api/bird/${raw}`) },
      { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=60", "Access-Control-Allow-Origin": "*" } },
    );
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "RPC error" }, { status: 502 });
  }
}

import { SITE, parseId, proof, readContest } from "@/lib/publicData";

// Public read-only API for organizers/apps: GET /api/contest/<id> → live on-chain contest + ranked scoreboard.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const raw = (await params).id;
  const id = parseId(raw);
  if (id === null) return Response.json({ error: "Invalid contest id" }, { status: 400 });
  try {
    const contest = await readContest(id);
    if (!contest) return Response.json({ error: "Unknown contest" }, { status: 404 });
    return Response.json(
      {
        // images are large data URIs; the NFT metadata endpoint carries them
        contest: { ...contest, entries: contest.entries.map((e) => ({ ...e, image: undefined, metadata: `${SITE}/metadata/c${e.tokenId}.json` })) },
        proof: proof(`/lomba/${raw}`),
      },
      { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=30", "Access-Control-Allow-Origin": "*" } },
    );
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "RPC error" }, { status: 502 });
  }
}

// Asserts the client-side mirrors equal the live contract (Monad testnet, real data, no mocks):
//  1. lib/birdHistory: Kicau Value replayed from every log of a registered bird == Kicau.valueBreakdown at the same block
//  2. lib/contestLive: rankEntries()/payouts() == winsOf + the ContestFinalized event of each finalized contest
//  3. lib/pixelate: sanitizeProfile() keeps hostile on-chain profile JSON from crashing renderers
// Run from web/:  node scripts/check-onchain.mjs [newestBirds=4]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti"; // already installed (tailwind); runs the app's TS lib files as-is

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const jiti = createJiti(import.meta.url, { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } });
const { createPublicClient } = await import("viem");
const { monadTestnet } = await import("viem/chains");
const { kicauAbi } = await jiti.import("../src/lib/abi.ts");
const { rpcTransport } = await jiti.import("../src/lib/rpc.ts");
const { fetchBirdHistory } = await jiti.import("../src/lib/birdHistory.ts");
const { rankEntries, payouts, PRIZE_PCT } = await jiti.import("../src/lib/contestLive.ts");
const { sanitizeProfile, encodeBird, decodeBirdImage } = await jiti.import("../src/lib/pixelate.ts");

const address = process.env.NEXT_PUBLIC_KICAU_ADDRESS;
assert.ok(address, "NEXT_PUBLIC_KICAU_ADDRESS missing");
const client = createPublicClient({ chain: monadTestnet, transport: rpcTransport });
const c = { address, abi: kicauAbi };
let fails = 0;
const check = async (name, fn) => {
  try {
    const extra = await fn();
    console.log(`  ok   ${name}${extra ? ` ${extra}` : ""}`);
  } catch (e) {
    fails++;
    console.log(`  FAIL ${name}: ${String(e.message).split("\n")[0]}`);
  }
};

// ---- 3. profile sanitizer (pure)
console.log("sanitizeProfile");
const colors = { head: "#111111", body: "#222222", belly: "#333333", wing: "#444444", tail: "#555555", beak: "#666666" };
const withJson = (json) => {
  const j = new TextEncoder().encode(json);
  const out = new Uint8Array(21 + j.length);
  out.set(encodeBird(colors));
  out[2] = 2;
  out.set(j, 21);
  return out;
};
const hostile = ["null", "42", '"x"', "[1]", '{"owner":{}}', '{"certificates":[null,1,{"type":"__proto__","issuer":{}}]}', '{"titles":"abc","wins":{"a":1},"lineage":[]}'];
for (const json of hostile) {
  await check(`hostile ${json}`, () => {
    const p = decodeBirdImage(withJson(json)).profile;
    assert.equal(typeof p, "object");
    for (const k of ["owner", "story", "species", "certificate"]) assert.ok(p[k] === undefined || typeof p[k] === "string");
    assert.ok(p.titles === undefined || p.titles.every((t) => typeof t === "string"));
    assert.ok((p.certificates ?? []).every((x) => typeof x.issuer === "string" && typeof x.number === "string" && x.type !== "__proto__"));
    assert.ok(p.wins === undefined || Array.isArray(p.wins));
  });
}
const good = {
  owner: "Huda",
  story: "s",
  certificates: [{ type: "breeder_ring", issuer: "BF", number: "1", date: "2026-01-01", docHash: "ab" }],
  lineage: { sire: { name: "A", ring: "R1" } },
  wins: [{ event: "Cup", rank: "1" }],
  titles: ["t"],
};
await check("well-formed profile round-trips unchanged", () => {
  const p = decodeBirdImage(encodeBird(colors, good)).profile;
  assert.deepEqual(JSON.parse(JSON.stringify(p)), JSON.parse(JSON.stringify(sanitizeProfile(good))));
  assert.equal(p.certificates[0].docHash, "ab");
  assert.equal(p.lineage.sire.ring, "R1");
  assert.equal(p.wins[0].rank, "1");
});

// ---- 1. Kicau Value replay vs valueBreakdown
const newest = Number(process.argv[2] ?? 4);
const total = await client.readContract({ ...c, functionName: "totalSupply" });
const ids = Array.from({ length: Number(total) }, (_, i) => BigInt(i));
const species = await client.multicall({ contracts: ids.map((id) => ({ ...c, functionName: "speciesOf", args: [id] })), allowFailure: true });
const custom = ids.filter((_, i) => species[i].result === 999n);
const meta = await client.multicall({
  contracts: custom.flatMap((id) => [
    { ...c, functionName: "winsOf", args: [id] },
    { ...c, functionName: "attestationCount", args: [id] },
    { ...c, functionName: "birdSupporters", args: [id] },
  ]),
  allowFailure: true,
});
// every bird with wins / titles / supporters (the interesting cases) + the newest few
const rich = custom.filter((_, i) => (meta[i * 3].result ?? []).some((x) => x > 0n) || (meta[i * 3 + 1].result ?? 0n) > 0n || (meta[i * 3 + 2].result ?? 0n) > 0n);
const pick = [...new Set([...rich, ...custom.slice(-newest)])];
console.log(`\nKicau Value replay: ${pick.length} of ${custom.length} registered birds (${rich.length} with wins/titles/supporters)`);
const histories = new Map();
for (const id of pick) {
  const t0 = Date.now();
  let h;
  await check(`bird #${id}`, async () => {
    h = await fetchBirdHistory(client, id);
    histories.set(id, h);
    const o = h.onchain;
    const s = h.state;
    assert.equal(BigInt(h.reconstructed), o.points, `client ${h.reconstructed} != contract ${o.points}`);
    assert.equal(BigInt(s.w1 * 250 + s.w2 * 150 + s.w3 * 100), o.wins, "wins component");
    assert.equal(BigInt(s.att * 80), o.attestations, "attestations component");
    assert.equal(BigInt(s.supporters * 10), o.supporters, "supporters component");
    assert.equal(BigInt(Math.min(s.bestRun * 2, 500)), o.runs, "runs component");
    assert.equal(o.priceWei, o.points * 10n ** 14n, "priceWei");
    return `${h.reconstructed} pts == valueBreakdown (wins ${o.wins}, att ${o.attestations}, supporters ${o.supporters}, support ${o.support}, runs ${o.runs}, fresh ${o.freshnessPct}%; ${h.events.length} events, ${h.chunks} getLogs chunks, ${Date.now() - t0} ms)`;
  });
}

// ---- 2. contest ranking + payouts vs the contract
const count = await client.readContract({ ...c, functionName: "contestCount" });
console.log(`\nContests: ${count}`);
for (let i = 0n; i < count; i++) {
  const ct = await client.readContract({ ...c, functionName: "getContest", args: [i] });
  if (ct.status !== 2) continue; // Finalized only (pool is zeroed on-chain; entryFee * entryCount is what was split)
  const [tids, totals] = await client.readContract({ ...c, functionName: "entriesOf", args: [i] });
  const ranked = rankEntries(tids.map((t, k) => ({ tokenId: t, total: totals[k], index: k })));
  const pool = ct.entryFee * BigInt(ct.entryCount);
  const places = Math.min(3, ranked.length);
  const { prizes, conservation } = payouts(pool, places);
  await check(`contest #${i} "${ct.name}"`, async () => {
    let paid = 0n;
    for (let k = 0; k < places; k++) paid += (pool * BigInt(PRIZE_PCT[k])) / 100n;
    assert.equal(prizes.reduce((a, b) => a + b, 0n), paid, "prizes");
    assert.equal(conservation, pool - paid, "conservation share (10% + dust + unfilled places)");
    const wins = await client.multicall({ contracts: ranked.slice(0, 3).map((r) => ({ ...c, functionName: "winsOf", args: [r.tokenId] })), allowFailure: false });
    ranked.slice(0, 3).forEach((r, k) => assert.ok(wins[k][k] > 0n, `#${r.tokenId} has no place-${k + 1} win on-chain`));
    // exact: the ContestFinalized event (found in the winner's history scan) names the same podium + pool
    const h = histories.get(ranked[0].tokenId) ?? (await fetchBirdHistory(client, ranked[0].tokenId));
    const ev = h.events.find((e) => e.kind === "contest" && e.contestId === Number(i));
    assert.ok(ev, "ContestFinalized not found in the winner's log scan");
    assert.equal(ev.place, 1, "event's first != client rank 1");
    assert.equal(ev.prizeWei, prizes[0], "1st prize");
    for (const [k, r] of ranked.slice(1, 3).entries()) {
      const hk = histories.get(r.tokenId) ?? (await fetchBirdHistory(client, r.tokenId));
      const e2 = hk.events.find((e) => e.kind === "contest" && e.contestId === Number(i));
      assert.equal(e2?.place, k + 2, `#${r.tokenId} place`);
    }
    return `podium ${ranked.slice(0, 3).map((r) => `#${r.tokenId}(${r.total})`).join(" ")} · pool ${pool} wei · prizes ${prizes.join("/")} · conservation ${conservation}`;
  });
}

console.log(fails ? `\n${fails} check(s) FAILED` : "\nall checks passed");
process.exit(fails ? 1 : 0);

"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { bytesToHex } from "viem";
import { usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { KicauValue } from "@/components/lomba/KicauValue";
import { BirdProfileCard } from "@/components/RegisteredBirds";
import { emptyPedigree, PedigreeFields, pedigreeFrom } from "@/components/PedigreeFields";
import { Modal } from "@/components/ui";
import { birdDataUri } from "@/lib/birds";
import { KICAU_ADDRESS } from "@/lib/config";
import { CUSTOM_SPECIES, fetchCustomBird } from "@/lib/customBirds";
import { type BirdColors, encodeBird, extractBirdColors } from "@/lib/pixelate";
import { kicau, type Kicau } from "@/lib/useKicau";

const field = "mt-1 w-full border-[3px] border-ink bg-paper px-3 py-2";

/** "My birds": Kicau Value per bird + publish a new sprite/profile version (updateBird keeps the value fresh). */
export function MyBirds({ k }: { k: Kicau }) {
  const client = usePublicClient();
  const { data: ids } = useReadContract({ ...kicau, functionName: "tokensOf", args: k.address ? [k.address] : undefined, query: { enabled: !!k.address } });
  const { data: sp } = useReadContracts({
    contracts: (ids ?? []).map((t) => ({ ...kicau, functionName: "speciesOf", args: [t] }) as const),
    query: { enabled: !!ids?.length },
  });
  const custom = (ids ?? []).filter((_, i) => sp?.[i]?.result === BigInt(CUSTOM_SPECIES));
  const { data: birds } = useQuery({
    queryKey: ["myBirdsPanel", KICAU_ADDRESS, custom.map(String)],
    enabled: !!client && custom.length > 0,
    queryFn: async () => (await Promise.all(custom.map((t) => fetchCustomBird(client!, KICAU_ADDRESS, t).catch(() => null)))).filter((b) => !!b),
  });

  const [sel, setSel] = useState<string | null>(null);
  const bird = birds?.find((b) => String(b.tokenId) === sel);
  const [file, setFile] = useState<File | null>(null);
  const [colors, setColors] = useState<BirdColors | null>(null);
  const [err, setErr] = useState<string>();
  const [owner, setOwner] = useState("");
  const [story, setStory] = useState("");
  const [species, setSpecies] = useState("");
  const [pedigree, setPedigree] = useState(emptyPedigree);
  const [proof, setProof] = useState<string | null>(null);
  const proofBird = birds?.find((b) => String(b.tokenId) === proof);

  // /lomba#my-birds deep link (from the owner dashboard): the list renders after the chain read, so scroll then
  useEffect(() => {
    if (birds?.length && location.hash === "#my-birds") document.getElementById("my-birds")?.scrollIntoView();
  }, [birds?.length]);

  // start the form from the bird's current on-chain profile so an update never wipes its pedigree
  useEffect(() => {
    if (!bird) return;
    setOwner(bird.profile.owner ?? "");
    setStory(bird.profile.story ?? "");
    setSpecies(bird.profile.species ?? "");
    setPedigree(pedigreeFrom(bird.profile));
    setFile(null);
    setColors(null);
  }, [bird]);
  useEffect(() => {
    if (!file) return;
    let off = false;
    extractBirdColors(file)
      .then((c) => !off && (setColors(c), setErr(undefined)))
      .catch((e) => !off && (setColors(null), setErr((e as Error).message)));
    return () => {
      off = true;
    };
  }, [file]);

  if (!k.address || !custom.length) return null;

  async function publish() {
    const pal = colors ?? (bird && "colors" in bird ? bird.colors : null);
    if (!bird || !pal) return setErr("Upload a photo first (this bird has no palette on-chain).");
    const p = bird.profile;
    const speciesChanged = species.trim() !== (p.species ?? "");
    const bytes = encodeBird(pal, {
      ...p,
      ...pedigree,
      owner: owner.trim(),
      story: story.trim(),
      species: species.trim(),
      ...(speciesChanged && { speciesSource: "owner" as const, aiConfidence: undefined }),
    });
    if (bytes.length > 4096) return setErr("Profile too long (max 4096 bytes).");
    if (await k.send({ functionName: "updateBird", args: [bird.tokenId, bytesToHex(bytes)] })) setSel(null);
  }

  return (
    <section id="my-birds" className="rounded-3xl border border-line bg-paper p-4 sm:p-6">
      <h2 className="mb-1 font-display text-2xl">My birds</h2>
      <p className="mb-3 text-sm text-muted">Kicau Value rises with wins, titles and support, and slowly drops if you don&apos;t update your bird for over 7 days.</p>
      <ul className="space-y-2">
        {(birds ?? []).map((b) => (
          <li key={String(b.tokenId)} className="flex flex-wrap items-center gap-3 border-[3px] border-ink p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.image} alt={b.name} className="h-10 w-12 object-contain [image-rendering:pixelated]" />
            <div className="min-w-[10rem] flex-1">
              <div className="truncate font-display text-xs">
                {b.name} #{String(b.tokenId)}
              </div>
              <KicauValue tokenId={b.tokenId} />
            </div>
            <button className="btn-ghost !py-2 max-sm:w-full" onClick={() => setSel(sel === String(b.tokenId) ? null : String(b.tokenId))}>
              {sel === String(b.tokenId) ? "Close" : "Update my bird"}
            </button>
            <button className="btn-ghost !py-2 max-sm:w-full" onClick={() => setProof(String(b.tokenId))}>
              Proof &amp; dashboard
            </button>
          </li>
        ))}
      </ul>
      {bird && (
        <div className="mt-4 grid gap-3 border-t-[3px] border-dashed border-ink pt-4 sm:grid-cols-2">
          <label className="text-sm font-semibold sm:col-span-2">
            New photo of {bird.name}
            <input className={field} type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          {colors && (
            <div className="flex items-center gap-3 sm:col-span-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bird.image} alt="current" className="h-12 w-14 object-contain opacity-60 [image-rendering:pixelated]" />
              →{/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={birdDataUri(0, false, colors)} alt="new sprite" className="h-16 w-20 object-contain [image-rendering:pixelated]" />
            </div>
          )}
          {err && <p className="text-sm text-clay sm:col-span-2">{err}</p>}
          <label className="text-sm font-semibold">
            Keeper name
            <input className={field} value={owner} onChange={(e) => setOwner(e.target.value)} />
          </label>
          <label className="text-sm font-semibold">
            Species {bird.profile.speciesSource === "owner" || species.trim() !== (bird.profile.species ?? "") ? "(set by owner)" : "(AI analysis)"}
            <input className={field} value={species} maxLength={60} onChange={(e) => setSpecies(e.target.value)} />
          </label>
          <div className="sm:col-span-2">
            <PedigreeFields value={pedigree} onChange={setPedigree} />
            {!!bird.profile.titles?.length && <p className="text-xs text-muted">Older titles are kept as-is.</p>}
          </div>
          <label className="text-sm font-semibold sm:col-span-2">
            Story
            <textarea className={field} rows={2} value={story} onChange={(e) => setStory(e.target.value)} />
          </label>
          <button className="btn-primary sm:col-span-2" disabled={!k.ready || k.txBusy} onClick={publish}>
            {k.txBusy ? "Sending…" : "Publish new version on-chain"}
          </button>
        </div>
      )}
      {proofBird && (
        <Modal onClose={() => setProof(null)}>
          <BirdProfileCard
            bird={proofBird}
            me={k.address}
            busy={k.txBusy}
            onSupport={k.ready ? (tokenId, amount) => k.send({ functionName: "supportBird", args: [tokenId], value: amount }) : undefined}
          />
        </Modal>
      )}
    </section>
  );
}

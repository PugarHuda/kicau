"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatEther } from "viem";
import { usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { FlappyGame } from "@/components/FlappyGame";
import { BirdProfileCard } from "@/components/RegisteredBirds";
import { type PlayerBird, TamanWorld, type WorldBird } from "@/components/taman/TamanWorld";
import { BirdArt, BirdCard, Modal, TxLink, short, type Species } from "@/components/ui";
import { BIRDS, birdDataUri } from "@/lib/birds";
import { chirp } from "@/lib/chirp";
import { EXPLORER, KICAU_ADDRESS } from "@/lib/config";
import { CUSTOM_SPECIES, type CustomBird, fetchCustomBird, fetchRegisteredBirds } from "@/lib/customBirds";
import { GAME_VERSION_CANVAS, type GameOver, type GameStart } from "@/lib/game";
import { kicau, useKicau } from "@/lib/useKicau";

type Other = { tokenId: number; owner: `0x${string}`; species: number };
type Open = { kind: "shelter"; id: number } | { kind: "registered"; bird: CustomBird } | { kind: "other"; nft: Other };

const enabled = Boolean(KICAU_ADDRESS);

export default function Taman() {
  const k = useKicau();
  const { address, ready, txBusy, send } = k;
  const client = usePublicClient();

  // ---- reads
  const { data: speciesRaw } = useReadContract({ ...kicau, functionName: "getAllSpecies", query: { enabled } });
  const species = useMemo(() => (speciesRaw ?? []) as readonly Species[], [speciesRaw]);
  const { data: tokenIds } = useReadContract({
    ...kicau,
    functionName: "tokensOf",
    args: address ? [address] : undefined,
    query: { enabled: enabled && !!address },
  });
  const { data: speciesOfMine } = useReadContracts({
    contracts: (tokenIds ?? []).map((id) => ({ ...kicau, functionName: "speciesOf", args: [id] }) as const),
    query: { enabled: !!tokenIds?.length },
  });
  const baseBirds = (tokenIds ?? []).map((id, i) => ({ tokenId: Number(id), species: Number(speciesOfMine?.[i]?.result ?? 0n) }));
  const customIds = baseBirds.filter((b) => b.species === CUSTOM_SPECIES).map((b) => b.tokenId);
  const { data: customBirds } = useQuery({
    queryKey: ["customBirds", KICAU_ADDRESS, customIds],
    enabled: !!client && customIds.length > 0,
    staleTime: Infinity,
    queryFn: async () =>
      Object.fromEntries(await Promise.all(customIds.map(async (id) => [id, await fetchCustomBird(client!, KICAU_ADDRESS, BigInt(id))] as const))),
  });
  const myBirds = speciesOfMine
    ? baseBirds.map((b) => ({ ...b, custom: b.species === CUSTOM_SPECIES ? (customBirds?.[b.tokenId] ?? null) : undefined }))
    : [];
  const { data: registered } = useQuery({
    queryKey: ["registeredBirds", KICAU_ADDRESS],
    enabled: !!client && enabled,
    refetchInterval: 15_000,
    queryFn: () => fetchRegisteredBirds(client!, KICAU_ADDRESS),
  });
  // Other players' species NFTs: tokens are never burned, so ids are 0..totalSupply-1. Newest first.
  const { data: allNfts } = useQuery({
    queryKey: ["tamanNfts", KICAU_ADDRESS],
    enabled: !!client && enabled,
    refetchInterval: 30_000,
    queryFn: async () => {
      const total = Number(await client!.readContract({ ...kicau, functionName: "totalSupply" }));
      const ids = Array.from({ length: Math.min(total, 120) }, (_, i) => BigInt(total - 1 - i)); // ponytail: newest 120 scanned
      const res = await client!.multicall({
        contracts: ids.flatMap((id) => [
          { ...kicau, functionName: "ownerOf", args: [id] } as const,
          { ...kicau, functionName: "speciesOf", args: [id] } as const,
        ]),
        allowFailure: true,
      });
      return ids.flatMap((id, i) => {
        const owner = res[i * 2].result as `0x${string}` | undefined;
        const sp = res[i * 2 + 1].result as bigint | undefined;
        return owner && sp !== undefined && sp !== BigInt(CUSTOM_SPECIES) ? [{ tokenId: Number(id), owner, species: Number(sp) }] : [];
      });
    },
  });

  // ---- player
  const [sel, setSel] = useState<number | null>(null);
  const current = myBirds.find((b) => b.tokenId === sel) ?? myBirds[0];
  const nameOf = (b: (typeof myBirds)[number]) => (b.custom ? b.custom.name : b.species === CUSTOM_SPECIES ? "…" : BIRDS[b.species]?.name);
  const guest = !current;
  const player: PlayerBird = useMemo(() => {
    if (!current) return { label: "Guest", sprite: birdDataUri(0), spriteUp: birdDataUri(0, true) };
    const label = `${nameOf(current) ?? "…"} #${current.tokenId}`;
    if (current.custom) return { label, sprite: current.custom.image, spriteUp: current.custom.imageUp };
    const sp = current.species === CUSTOM_SPECIES ? 0 : current.species;
    return { label, sprite: birdDataUri(sp), spriteUp: birdDataUri(sp, true) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.tokenId, current?.species, current?.custom]);

  // ---- npcs
  const me = address?.toLowerCase();
  const others = useMemo(() => (allNfts ?? []).filter((n) => n.owner.toLowerCase() !== me).slice(0, 30), [allNfts, me]);
  const npcs: WorldBird[] = useMemo(
    () => [
      ...BIRDS.map((b, id) => ({
        key: `s${id}`,
        label: b.name,
        sublabel: species[id] ? `${formatEther(species[id].price)} MON` : undefined,
        sprite: birdDataUri(id),
        spriteUp: birdDataUri(id, true),
        zone: "shelter" as const,
      })),
      ...(registered ?? [])
        .filter((b) => Number(b.tokenId) !== current?.tokenId)
        .map((b) => ({
          key: `r${b.tokenId}`,
          label: b.name,
          sublabel: b.profile.owner || short(b.owner),
          sprite: b.image,
          spriteUp: b.imageUp,
          zone: "gazebo" as const,
        })),
      ...others.map((n) => ({
        key: `o${n.tokenId}`,
        label: BIRDS[n.species]?.name ?? `#${n.tokenId}`,
        sublabel: short(n.owner),
        sprite: birdDataUri(n.species),
        spriteUp: birdDataUri(n.species, true),
        zone: "park" as const,
      })),
    ],
    [species, registered, others, current?.tokenId],
  );

  // ---- modals
  const [open, setOpen] = useState<Open | null>(null);
  const [game, setGame] = useState<GameStart | null>(null);
  const [result, setResult] = useState<GameOver | null>(null);
  const { data: supported } = useReadContract({
    ...kicau,
    functionName: "supportOf",
    args: [BigInt(open?.kind === "shelter" ? open.id : 0)],
    query: { enabled: enabled && open?.kind === "shelter" },
  });

  function interact(key: string) {
    const id = Number(key.slice(1));
    if (key[0] === "s") {
      if (!species[id]) return;
      setOpen({ kind: "shelter", id });
      chirp(id);
    } else if (key[0] === "r") {
      const bird = registered?.find((b) => Number(b.tokenId) === id);
      if (!bird) return;
      setOpen({ kind: "registered", bird });
      chirp(0);
    } else {
      const nft = others.find((n) => n.tokenId === id);
      if (!nft) return;
      setOpen({ kind: "other", nft });
      chirp(nft.species);
    }
  }

  async function buy(id: number) {
    if (await send({ functionName: "buy", args: [BigInt(id)], value: species[id].price })) setOpen(null);
  }

  function fly() {
    if (!current) return;
    const s = species[current.species];
    if (!s && !current.custom) return;
    setResult(null);
    setGame({
      tokenId: current.tokenId,
      species: current.species,
      stats: s ? { gravity: s.gravity, flapPower: s.flapPower, hitbox: s.hitbox } : { gravity: 100, flapPower: 100, hitbox: 100 },
      gameVersion: GAME_VERSION_CANVAS,
      spriteUrl: current.custom?.image,
      spriteUpUrl: current.custom?.imageUp,
    });
  }

  async function submitScore(r: GameOver) {
    if (await send({ functionName: "submitScore", args: [BigInt(r.tokenId), BigInt(r.score), GAME_VERSION_CANVAS] })) {
      setResult(null);
      setGame(null);
    }
  }

  const notReady = !ready && <p className="mt-3 text-sm text-clay">Tap ⚡ Quick Play above or connect a wallet on Monad Testnet.</p>;

  return (
    <main className="fixed inset-0 flex flex-col overflow-hidden">
      {/* HUD */}
      <header className="z-10 flex flex-wrap items-center gap-2 border-b-[3px] border-ink bg-paper px-3 py-2">
        <Link href="/" className="btn-ghost !px-2 !py-2 !text-[0.6rem]">
          ← Home
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="hidden font-display text-[0.6rem] sm:inline">Kicau Garden</span>
          {myBirds.length > 1 ? (
            <select
              className="min-w-0 max-w-[11rem] border-[3px] border-ink bg-paper px-1 py-1 text-sm"
              value={current?.tokenId}
              onChange={(e) => setSel(Number(e.target.value))}
              aria-label="Choose bird"
            >
              {myBirds.map((b) => (
                <option key={b.tokenId} value={b.tokenId}>
                  {nameOf(b) ?? "…"} #{b.tokenId}
                </option>
              ))}
            </select>
          ) : (
            <span className="truncate text-sm font-semibold">{player.label}</span>
          )}
        </div>
        {!address ? (
          <button className="btn-primary !px-2 !py-2 !text-[0.6rem]" disabled={k.funding} onClick={k.quickPlay}>
            {k.funding ? "Setting up…" : "⚡ Quick Play"}
          </button>
        ) : (
          <button className="btn-primary !px-2 !py-2 !text-[0.6rem]" disabled={guest || !ready} onClick={fly}>
            <span className="hidden sm:inline">Fly in</span> Flappy
          </button>
        )}
      </header>

      <div className="relative min-h-0 flex-1">
        <TamanWorld player={player} npcs={npcs} paused={!!open || !!game} onInteract={interact} />

        {/* overlays */}
        <div className="pointer-events-none absolute inset-x-0 top-2 flex flex-col items-center gap-2 px-3">
          {guest && (
            <div className="pointer-events-auto max-w-md border-[3px] border-ink bg-sun px-3 py-2 text-center text-sm text-ink">
              You&apos;re walking as a <b>Guest</b>.{" "}
              <Link href="/" className="font-semibold underline">
                Adopt a bird at the Shelter to play with your own bird
              </Link>
            </div>
          )}
          {(k.error || k.lastTx) && (
            <div className="pointer-events-auto flex max-w-md flex-wrap items-center gap-2 border-[3px] border-ink bg-paper px-3 py-2 text-sm">
              {k.error ? (
                <span className="line-clamp-3 text-clay">{k.error}</span>
              ) : (
                <>
                  <span className="font-semibold">✓ Confirmed{k.lastMs !== undefined && ` in ${k.lastMs} ms`}</span>
                  <TxLink hash={k.lastTx} />
                </>
              )}
              <button className="ml-auto text-muted" onClick={() => k.setError(undefined)} aria-label="Close" hidden={!k.error}>
                ×
              </button>
            </div>
          )}
        </div>
      </div>

      {open?.kind === "shelter" && species[open.id] && (
        <Modal onClose={() => setOpen(null)}>
          <BirdCard
            id={open.id}
            species={species[open.id]}
            busy={txBusy}
            canBuy={ready}
            onBuy={() => buy(open.id)}
            onSupport={(amount) => send({ functionName: "support", args: [BigInt(open.id)], value: amount })}
            supported={supported}
          />
          {notReady}
        </Modal>
      )}
      {open?.kind === "registered" && (
        <Modal onClose={() => setOpen(null)}>
          <BirdProfileCard bird={open.bird} />
        </Modal>
      )}
      {open?.kind === "other" && (
        <Modal onClose={() => setOpen(null)}>
          <OtherCard nft={open.nft} />
        </Modal>
      )}

      {game && (
        <Modal onClose={() => setGame(null)}>
          <div className="mb-3 font-display text-xl font-bold">{player.label}</div>
          <div className="relative">
            <FlappyGame key={result ? "over" : "play"} start={game} onGameOver={setResult} />
            {result && (
              <div className="absolute inset-0 grid place-items-center rounded-2xl bg-ink/60 p-6 text-center text-paper">
                <div>
                  <div className="text-sm uppercase tracking-wider text-paper/70">Score</div>
                  <div className="mb-4 font-display text-6xl font-extrabold">{result.score}</div>
                  <div className="flex flex-col gap-2">
                    <button className="btn bg-sun text-ink" disabled={txBusy || !ready} onClick={() => submitScore(result)}>
                      {txBusy ? "Sending…" : "Submit score on-chain"}
                    </button>
                    <button className="btn border border-paper/40" onClick={() => setResult(null)}>
                      Play again
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          {k.error && <p className="mt-3 text-sm text-clay">{k.error}</p>}
        </Modal>
      )}
    </main>
  );
}

function OtherCard({ nft }: { nft: Other }) {
  const { data: best } = useReadContract({ ...kicau, functionName: "bestByToken", args: [BigInt(nft.tokenId)] });
  return (
    <div>
      <div className="mb-4 grid place-items-center bg-cream py-6">
        <BirdArt id={nft.species} className="h-32 w-auto" />
      </div>
      <h2 className="mb-1 font-display text-2xl">
        {BIRDS[nft.species]?.name ?? "Bird"} <span className="text-muted">#{nft.tokenId}</span>
      </h2>
      <p className="mb-3 text-sm text-muted">
        Owned by{" "}
        <a href={`${EXPLORER}/address/${nft.owner}`} target="_blank" rel="noreferrer" className="font-mono underline">
          {short(nft.owner)}
        </a>
      </p>
      <div className="border-[3px] border-ink p-3">
        <div className="font-display text-xs">Best score</div>
        <div className="font-display text-2xl tabular-nums">{best !== undefined ? String(best) : "…"}</div>
      </div>
    </div>
  );
}

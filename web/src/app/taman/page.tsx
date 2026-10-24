"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatEther } from "viem";
import { usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { FlappyGame } from "@/components/FlappyGame";
import { type Other, OtherCard } from "@/components/taman/OtherCard";
import { BirdProfileCard } from "@/components/RegisteredBirds";
import { type PlayerBird, TamanWorld, type WorldBird } from "@/components/taman/TamanWorld";
import { BirdCard, Modal, TxLink, short, type Species } from "@/components/ui";
import { BIRDS, birdDataUri } from "@/lib/birds";
import { chirp } from "@/lib/chirp";
import { KICAU_ADDRESS } from "@/lib/config";
import { CUSTOM_SPECIES, type CustomBird, fetchCustomBird, fetchRegisteredBirds, isTestEntity } from "@/lib/customBirds";
import { GAME_VERSION_CANVAS, GAME_VERSION_RUN, type GameOver, type GameStart } from "@/lib/game";
import { useMusic } from "@/lib/music";
import { kicau, useKicau } from "@/lib/useKicau";

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
        .filter((b) => Number(b.tokenId) !== current?.tokenId && (!isTestEntity(b.name) || b.owner.toLowerCase() === me))
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
    [species, registered, others, current?.tokenId, me],
  );

  // ---- modals
  const [open, setOpen] = useState<Open | null>(null);
  const [game, setGame] = useState<GameStart | null>(null);
  const [result, setResult] = useState<GameOver | null>(null);
  const [run, setRun] = useState<{ runId: bigint } | null>(null); // null while playing = practice (guest)
  const [starting, setStarting] = useState(false);
  const [muted, toggleMusic] = useMusic(game ? "flappy" : "garden");
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

  /** Owner: startRun on-chain -> seeded game -> submitRun. Guest: practice with Kenari, nothing on-chain. */
  async function fly() {
    const s = species[current?.species ?? 0];
    const stats = s ? { gravity: s.gravity, flapPower: s.flapPower, hitbox: s.hitbox } : { gravity: 100, flapPower: 100, hitbox: 100 };
    setResult(null);
    if (!current) {
      setRun(null);
      setGame({ tokenId: -1, species: 0, stats, gameVersion: GAME_VERSION_CANVAS }); // -1: own local-best slot
      return;
    }
    if ((!species[current.species] && !current.custom) || !ready) return;
    setStarting(true);
    const r = await k.startVerifiedRun(BigInt(current.tokenId));
    setStarting(false);
    if (!r) return;
    setRun({ runId: r.runId });
    setGame({
      tokenId: current.tokenId,
      species: current.species,
      stats,
      gameVersion: GAME_VERSION_RUN,
      spriteUrl: current.custom?.image,
      spriteUpUrl: current.custom?.imageUp,
      seed: r.seed.toString(),
    });
  }

  async function submitScore(r: GameOver) {
    if (!run) return;
    if (await send({ functionName: "submitRun", args: [run.runId, BigInt(r.score)] })) {
      setRun(null);
      setResult(null);
      setGame(null);
    }
  }

  function closeGame() {
    setGame(null);
    setResult(null);
    k.setError(undefined);
  }

  const notReady = !ready && (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-clay">
      <button className="btn-primary !px-2 !py-2 !text-[0.6rem]" disabled={k.funding} onClick={k.quickPlay}>
        {k.funding ? "Setting up…" : "⚡ Quick Play"}
      </button>
      to adopt or support with a free testnet wallet.
    </div>
  );

  return (
    <main className="fixed inset-0 flex flex-col overflow-hidden">
      {/* HUD */}
      <header className="z-10 flex flex-wrap items-center gap-2 border-b-[3px] border-ink bg-paper px-3 py-2">
        <Link href="/" className="btn-ghost !px-2 !py-2 !text-[0.6rem]" aria-label="Home">
          ←<span className="hidden sm:inline"> Home</span>
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="hidden font-display text-[0.6rem] sm:inline">Kicau Garden</span>
          {myBirds.length > 1 ? (
            <select
              className="min-w-0 max-w-[11rem] border-[3px] border-ink bg-paper px-1 py-1 text-sm"
              value={current?.tokenId}
              onChange={(e) => {
                setSel(Number(e.target.value));
                e.currentTarget.blur(); // hand the keyboard back to the garden
              }}
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
        <button className="btn-ghost !px-2 !py-1" onClick={toggleMusic} aria-label={muted ? "Unmute music" : "Mute music"}>
          {muted ? "🔇" : "🎵"}
        </button>
        {guest && (
          <button
            className={`btn-ghost !px-2 !py-2 !text-[0.6rem] ${address ? "" : "max-sm:!hidden"}`}
            onClick={fly}
            title="Practice run, not recorded on-chain"
          >
            Practice
          </button>
        )}
        {!address ? (
          <button className="btn-primary !px-2 !py-2 !text-[0.6rem]" disabled={k.funding} onClick={k.quickPlay}>
            {k.funding ? "Setting up…" : "⚡ Quick Play"}
          </button>
        ) : (
          !guest && (
            <button className="btn-primary !px-2 !py-2 !text-[0.6rem]" disabled={!ready || starting || txBusy} onClick={fly}>
              {starting ? (
                "Starting…"
              ) : (
                <>
                  <span className="hidden sm:inline">Fly in</span> Flappy
                </>
              )}
            </button>
          )
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
            // while a card/game modal is open, float above it at the bottom (like the home toast) so the result is visible
            <div
              className={`pointer-events-auto flex max-w-md flex-wrap items-center gap-2 border-[3px] border-ink bg-paper px-3 py-2 text-sm ${open || game ? "fixed inset-x-4 bottom-4 z-[1100] mx-auto" : ""}`}
              role="status"
            >
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
        <Modal onClose={closeGame}>
          <div className="mb-3 font-display text-xl font-bold">
            {guest ? "Kenari" : player.label}
            <span className="ml-2 align-middle text-xs font-normal text-muted">{run ? "✔ verified run" : "practice"}</span>
          </div>
          <div className="relative">
            <FlappyGame key={result ? "over" : "play"} start={game} onGameOver={setResult} />
            {result && (
              <div className="absolute inset-0 grid place-items-center rounded-2xl bg-ink/60 p-6 text-center text-paper">
                <div>
                  <div className="text-sm uppercase tracking-wider text-paper/70">Score</div>
                  <div className="mb-4 font-display text-6xl font-extrabold">{result.score}</div>
                  <div className="flex flex-col gap-2">
                    {run ? (
                      <button className="btn bg-sun text-ink" disabled={txBusy || !ready} onClick={() => submitScore(result)}>
                        {txBusy ? "Sending…" : "Submit verified score"}
                      </button>
                    ) : (
                      <p className="text-sm text-paper/80">Practice run. Adopt a bird to record verified scores on-chain.</p>
                    )}
                    <button className="btn border border-paper/40" disabled={starting || txBusy} onClick={() => (run ? fly() : setResult(null))}>
                      {starting ? "Starting…" : "Play again"}
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

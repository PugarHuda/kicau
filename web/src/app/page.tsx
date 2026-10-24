"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BaseError,
  ContractFunctionRevertedError,
  bytesToHex,
  formatEther,
  parseEventLogs,
  type TransactionReceipt,
} from "viem";
import { writeContractSync } from "viem/actions";
import {
  useAccount,
  useBalance,
  useConnect,
  useDisconnect,
  useReadContract,
  useReadContracts,
  useSwitchChain,
  usePublicClient,
  useWriteContractSync,
} from "wagmi";
import { NET } from "@/lib/network";
import { NetworkToggle } from "@/components/NetworkToggle";
import { FlappyGame } from "@/components/FlappyGame";
import { ChainStats } from "@/components/home/ChainStats";
import { FeaturedContest, WatchLiveLink } from "@/components/home/FeaturedContest";
import { HeroScene } from "@/components/home/HeroScene";
import { HowItWorks } from "@/components/home/HowItWorks";
import { Leaderboards } from "@/components/Leaderboards";
import { LiveFeed } from "@/components/LiveFeed";
import { RegisterBird } from "@/components/RegisterBird";
import { Badges, BirdProfileCard, NftChip, RegisteredBirds, useCommunityBirds } from "@/components/RegisteredBirds";
import { MAX_SCENE_BIRDS, type SceneBird, ShelterScene } from "@/components/ShelterScene";
import { type Other, OtherCard, useOtherNfts } from "@/components/taman/OtherCard";
import { BirdArt, BirdCard, Modal, TxLink, short, type Species } from "@/components/ui";
import { kicauAbi } from "@/lib/abi";
import { BIRDS } from "@/lib/birds";
import { type BurnerClient, createBurner, forgetBurner, fundBurner, loadBurner } from "@/lib/burner";
import { KICAU_ADDRESS } from "@/lib/config";
import { CUSTOM_SPECIES, type CustomBird, fetchCustomBird } from "@/lib/customBirds";
import { GAME_VERSION_CANVAS, GAME_VERSION_RUN, type GameOver, type GameStart } from "@/lib/game";
import { useMusic } from "@/lib/music";
import { retry429 } from "@/lib/useKicau";

const kicau = { address: KICAU_ADDRESS, abi: kicauAbi } as const;
const GUEST_TOKEN = -1;
const CHIP = "max-sm:!px-2.5 max-sm:!py-2 max-sm:!text-[0.6rem]"; // compact buttons on phones

const REVERT_MSG: Record<string, string> = {
  ScoreTooFast: "Score rejected: a run can't score faster than 1 point per second. Play again for a fair run.",
  RunExpired: "This run is older than 1 hour. Start a new game.",
  RunNotActive: "This run was already submitted or replaced by a newer one. Start a new game.",
  NotRunPlayer: "This run belongs to another player.",
  NotBirdOwner: "Only this bird's owner can do that.",
  NotOrganizer: "Only an active contest organizer can attest titles.",
  NotCustomBird: "Titles can only be attested to registered birds.",
  InvalidTitle: "Title must be 1–64 bytes.",
  TooManyAttestations: "This bird already has the maximum of 32 attestations.",
  SoldOut: "Sold out.",
  WrongPayment: "Wrong payment amount. Reload the page and try again.",
  InvalidBird: "Name must be 1–32 bytes and the bird data at most 4096 bytes.",
  InvalidWeek: "That week has already ended. Fund the current week instead.",
  WeekNotEnded: "This week isn't over yet. Claim after Monday 00:00 UTC.",
  NotWinner: "Only the week's top verified scorer can claim this prize.",
  AlreadyClaimed: "This week's prize was already claimed.",
  HasPlayers: "This week had players, so its winner claims the pool (no rollover).",
};

/** Contract reverts and common RPC failures → one readable line. */
function txError(e: unknown) {
  const rev = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null;
  const name = rev instanceof ContractFunctionRevertedError ? rev.data?.errorName : undefined;
  if (name && REVERT_MSG[name]) return REVERT_MSG[name];
  const err = e as { shortMessage?: string; message?: string };
  const msg = err.shortMessage ?? err.message ?? "Transaction failed";
  if (/insufficient (funds|balance)|reserve balance/i.test(`${msg} ${err.message}`)) return "Not enough MON for this transaction. Hit + Faucet to top up.";
  return msg;
}

export default function Home() {
  const qc = useQueryClient();
  const { address: walletAddress, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const wrongChain = isConnected && chainId !== NET.chainId;

  // Quick Play: local burner signs in-browser → eth_sendRawTransactionSync, no wallet popup.
  const [burner, setBurner] = useState<BurnerClient | null>(null);
  const [funding, setFunding] = useState(false);
  useEffect(() => setBurner(loadBurner()), []);
  const address = burner?.account.address ?? walletAddress;
  const { data: balance } = useBalance({ address, query: { enabled: !!address, refetchInterval: 15_000 } });

  const { writeContractSyncAsync, isPending: walletBusy } = useWriteContractSync();
  const [burnerBusy, setBurnerBusy] = useState(false);
  const txBusy = walletBusy || burnerBusy;
  const [lastTx, setLastTx] = useState<string>();
  const [lastMs, setLastMs] = useState<number>();
  const [error, setError] = useState<string>();
  // toast sits above modals: auto-hide so it can't cover their bottom buttons for good
  useEffect(() => {
    if (!error && !lastTx) return;
    const t = setTimeout(() => (setError(undefined), setLastTx(undefined)), error ? 12_000 : 6_000);
    return () => clearTimeout(t);
  }, [error, lastTx]);

  const [openSpecies, setOpenSpecies] = useState<number | null>(null);
  const [registering, setRegistering] = useState(false);
  const [managing, setManaging] = useState<number | null>(null); // tokenId of the owner-view profile modal
  const [gardenOpen, setGardenOpen] = useState<{ kind: "registered"; bird: CustomBird } | { kind: "player"; nft: Other } | null>(null);
  const { data: community } = useCommunityBirds();
  const otherNfts = useOtherNfts(address);
  const publicClient = usePublicClient();
  const [game, setGame] = useState<GameStart | null>(null);
  const [result, setResult] = useState<GameOver | null>(null);
  const [musicMuted, toggleMusic] = useMusic("flappy", !!game);

  // ---- reads
  const enabled = Boolean(KICAU_ADDRESS);
  const { data: speciesRaw } = useReadContract({ ...kicau, functionName: "getAllSpecies", query: { enabled } });
  const species = (speciesRaw ?? []) as readonly Species[];
  const { data: registerFee } = useReadContract({ ...kicau, functionName: "registerFee", query: { enabled } });
  const { data: supportedRaw } = useReadContract({
    ...kicau,
    functionName: "supportOf",
    args: [BigInt(openSpecies ?? 0)],
    query: { enabled: enabled && openSpecies !== null },
  });
  const { data: tokenIds } = useReadContract({
    ...kicau,
    functionName: "tokensOf",
    args: address ? [address] : undefined,
    query: { enabled: enabled && !!address },
  });
  const { data: tokenInfo } = useReadContracts({
    contracts: (tokenIds ?? []).flatMap((id) => [
      { ...kicau, functionName: "speciesOf", args: [id] } as const,
      { ...kicau, functionName: "bestByToken", args: [id] } as const,
    ]),
    query: { enabled: !!tokenIds?.length },
  });

  const baseBirds = (tokenIds ?? []).map((id, i) => ({
    tokenId: Number(id),
    species: Number(tokenInfo?.[i * 2]?.result ?? 0n),
    best: Number(tokenInfo?.[i * 2 + 1]?.result ?? 0n),
  }));
  const customIds = baseBirds.filter((b) => b.species === CUSTOM_SPECIES).map((b) => b.tokenId);
  // Registered birds: sprite + name come from their BirdRegistered log (one block per token).
  const { data: customBirds } = useQuery({
    queryKey: ["customBirds", KICAU_ADDRESS, customIds],
    enabled: !!publicClient && customIds.length > 0,
    staleTime: Infinity,
    queryFn: async () =>
      Object.fromEntries(
        await Promise.all(customIds.map(async (id) => [id, await fetchCustomBird(publicClient!, KICAU_ADDRESS, BigInt(id))] as const)),
      ),
  });
  const myBirds = baseBirds.map((b) => ({
    ...b,
    custom: b.species === CUSTOM_SPECIES ? (customBirds?.[b.tokenId] ?? null) : undefined,
  }));


  // ---- writes. Burner: eth_sendRawTransactionSync (receipt in one call). Wallet: send + wait.
  type Write =
    | { functionName: "buy"; args: readonly [bigint]; value: bigint }
    | { functionName: "startRun"; args: readonly [bigint] }
    | { functionName: "submitRun"; args: readonly [bigint, bigint] }
    | { functionName: "attest"; args: readonly [bigint, string] }
    | { functionName: "supportBird"; args: readonly [bigint]; value: bigint }
    | { functionName: "registerBird"; args: readonly [string, `0x${string}`]; value: bigint }
    | { functionName: "support"; args: readonly [bigint]; value: bigint }
    | { functionName: "fundRewards"; args: readonly [bigint]; value: bigint }
    | { functionName: "claimWeeklyReward"; args: readonly [bigint] }
    | { functionName: "rolloverWeeklyPool"; args: readonly [bigint] };

  /** Returns the receipt (truthy) or null; errors land in the toast. */
  async function send(req: Write) {
    setError(undefined);
    const t0 = performance.now();
    try {
      let receipt: TransactionReceipt;
      if (burner) {
        setBurnerBusy(true);
        receipt = await retry429(() => writeContractSync(burner, { ...kicau, ...req } as unknown as Parameters<typeof writeContractSync>[1]));
      } else {
        receipt = await writeContractSyncAsync({ ...kicau, ...req } as unknown as Parameters<typeof writeContractSyncAsync>[0]);
      }
      setLastMs(Math.round(performance.now() - t0));
      setLastTx(receipt.transactionHash);
      qc.invalidateQueries();
      return receipt;
    } catch (e) {
      setError(txError(e));
      return null;
    } finally {
      setBurnerBusy(false);
    }
  }

  async function quickPlay() {
    setError(undefined);
    const b = burner ?? createBurner();
    setBurner(b);
    setFunding(true);
    try {
      await fundBurner(b.account.address);
    } catch (e) {
      setError(`${(e as Error).message}. Top up manually at faucet.monad.xyz → ${b.account.address}`);
    } finally {
      setFunding(false);
      await qc.invalidateQueries();
    }
  }

  function leaveBurner() {
    // the key lives only in this browser: forgetting it loses the burner's MON and birds for good
    if (!window.confirm("Leave Quick Play? This deletes the burner wallet from this browser, along with its MON and birds.")) return;
    forgetBurner();
    setBurner(null);
  }

  async function buy(id: number) {
    const ok = await send({ functionName: "buy", args: [BigInt(id)], value: species[id].price });
    if (ok) setOpenSpecies(null);
  }

  async function submitScore(r: GameOver) {
    if (!game?.runId) return;
    const ok = await send({ functionName: "submitRun", args: [BigInt(game.runId), BigInt(r.score)] });
    if (ok) {
      setResult(null);
      setGame(null);
    }
  }

  async function support(id: number, amount: bigint) {
    await send({ functionName: "support", args: [BigInt(id)], value: amount });
  }

  async function register(name: string, image: Uint8Array) {
    if (registerFee === undefined) return;
    const ok = await send({ functionName: "registerBird", args: [name, bytesToHex(image)], value: registerFee });
    if (ok) setRegistering(false);
  }

  async function supportBird(tokenId: bigint, amount: bigint) {
    return !!(await send({ functionName: "supportBird", args: [tokenId], value: amount }));
  }

  async function attest(tokenId: bigint, title: string) {
    return !!(await send({ functionName: "attest", args: [tokenId, title] }));
  }

  /** startRun on-chain first (seed → pipe layout, start time → anti-cheat); if it fails, an unverified practice game. */
  async function play(bird: (typeof myBirds)[number]) {
    const s = species[bird.species];
    const stats = s ? { gravity: s.gravity, flapPower: s.flapPower, hitbox: s.hitbox } : { gravity: 100, flapPower: 100, hitbox: 100 };
    if ((!s && !bird.custom) || txBusy) return;
    const receipt = ready ? await send({ functionName: "startRun", args: [BigInt(bird.tokenId)] }) : null;
    let run = receipt && parseEventLogs({ abi: kicauAbi, logs: receipt.logs, eventName: "RunStarted" })[0]?.args;
    if (receipt && !run && publicClient && address) {
      const runId = await publicClient.readContract({ ...kicau, functionName: "activeRunOf", args: [address] }).catch(() => 0n);
      const r = runId ? await publicClient.readContract({ ...kicau, functionName: "runs", args: [runId] }).catch(() => null) : null;
      if (r) run = { runId, seed: r[5], player: r[0], tokenId: r[4] };
    }
    setResult(null);
    setGame({
      tokenId: bird.tokenId,
      species: bird.species,
      stats,
      gameVersion: run ? GAME_VERSION_RUN : GAME_VERSION_CANVAS,
      spriteUrl: bird.custom?.image,
      spriteUpUrl: bird.custom?.imageUp,
      seed: run?.seed.toString(),
      runId: run?.runId.toString(),
    });
  }

  /** Hero CTA: fly your first bird, or try the game as a guest Kenari (score stays off-chain). */
  function playNow() {
    if (myBirds[0]) return play(myBirds[0]);
    const s = species[0];
    setResult(null);
    setGame({
      tokenId: GUEST_TOKEN,
      species: 0,
      stats: s ? { gravity: s.gravity, flapPower: s.flapPower, hitbox: s.hitbox } : { gravity: 100, flapPower: 100, hitbox: 80 },
      gameVersion: GAME_VERSION_CANVAS,
    });
  }

  const birdName = (b: (typeof myBirds)[number]) => (b.custom ? b.custom.name : BIRDS[b.species]?.name);

  const ready = !!burner || (isConnected && !wrongChain);
  const bal = balance ? Number(formatEther(balance.value)).toFixed(3) : "…";

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      {/* header */}
      <header className="flex flex-wrap items-center justify-between gap-3 py-5">
        <div className="flex items-center gap-2">
          <BirdArt id={0} className="h-9 w-auto" />
          <span className="font-display text-2xl font-extrabold tracking-tight">Kicau</span>
          <NetworkToggle />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/me" className={`btn-ghost ${CHIP}`} title="My Dashboard" aria-label="My Dashboard">
            <span className="sm:hidden">Me</span><span className="hidden sm:inline">My Dashboard</span>
          </Link>
          {burner ? (
            <>
              <span className="text-sm text-muted tabular-nums">{bal} MON</span>
              <button className="btn-ghost" disabled={funding} onClick={quickPlay} title="Get testnet MON from the faucet">
                {funding ? "Funding…" : "+ Faucet"}
              </button>
              <button className="btn-ghost" onClick={leaveBurner} title="Leave Quick Play">
                ⚡ {short(burner.account.address)}
              </button>
            </>
          ) : !isConnected ? (
            <>
              {NET.faucet && (
              <button className={`btn-primary ${CHIP}`} disabled={funding} onClick={quickPlay}>
                {funding ? "Setting up…" : "⚡ Quick Play"}
              </button>
              )}
              <button className={`btn-ghost ${CHIP}`} disabled={connecting} onClick={() =>
                  connect(
                    { connector: connectors[0] },
                    {
                      onError: (e) =>
                        setError(e.message.startsWith("Provider not found") ? "No wallet detected. Install MetaMask, or use ⚡ Quick Play." : e.message),
                    },
                  )
                }
              >
                {connecting ? "Connecting…" : "Connect wallet"}
              </button>
            </>
          ) : wrongChain ? (
            <button className="btn-primary bg-clay" onClick={() => switchChain({ chainId: NET.chainId })}>
              Switch to {NET.chain.name}
            </button>
          ) : (
            <button className="btn-ghost" onClick={() => disconnect()} title="Disconnect">
              {short(address!)}
            </button>
          )}
        </div>
      </header>

      {/* hero */}
      <section className="hero-stage bleed">
        <HeroScene />
        <div className="relative mx-auto max-w-6xl px-4 pb-[330px] pt-10 sm:px-6 sm:pb-[380px] lg:min-h-[600px] lg:pb-24 lg:pt-16">
          <p className="eyebrow mb-5">Keep the song, not the cage.</p>
          <h1 className="hero-title mb-5 max-w-[15ch] font-display">The on-chain record for real-life songbird contests.</h1>
          <p className="mb-7 max-w-md text-lg leading-snug">
            Kicau mania contests happen at the gantangan. Kicau puts every judge&apos;s score on Monad as it&apos;s given, pays prizes
            straight to keepers, and turns champion titles into pedigree anyone can verify.
          </p>
          <div className="flex max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap">
            <WatchLiveLink className="btn-primary">Watch a live contest</WatchLiveLink>
            <button className="btn bg-sun text-ink" onClick={() => setRegistering(true)}>
              Register your bird
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 font-display text-[0.6rem] uppercase">
            <button className="underline decoration-2 underline-offset-4 hover:text-leaf" onClick={playNow}>
              ▶ Play Flappy
            </button>
            <Link href="/taman" className="underline decoration-2 underline-offset-4 hover:text-leaf">
              Kicau Garden →
            </Link>
          </div>
        </div>
      </section>

      <ChainStats />
      <HowItWorks />
      <FeaturedContest />

      <div className="pt-14">
        <LiveFeed />
      </div>

      {!enabled && (
        <p className="mb-6 rounded-2xl border border-clay/40 bg-clay/10 p-4 text-sm">
          Contract not configured. Set <code>NEXT_PUBLIC_KICAU_ADDRESS</code> in <code>web/.env.local</code>.
        </p>
      )}
      {(error || lastTx) && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-[1100] mx-auto flex max-w-xl flex-wrap items-center justify-between gap-2 border border-line bg-paper p-4 text-sm shadow-lg"
        >
          {error ? (
            <span className="text-clay">{error}</span>
          ) : (
            <span className="font-semibold">
              ✓ Transaction confirmed{lastMs !== undefined && ` in ${lastMs} ms`}
            </span>
          )}
          {!error && <TxLink hash={lastTx} />}
          <button onClick={() => (setError(undefined), setLastTx(undefined))} className="text-xl leading-none text-muted hover:text-ink" aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {/* kicau garden: every bird on Kicau (shelter species, registered birds, other players' NFTs) */}
      <section className="band mb-14 mt-14 py-14">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow mb-3">Adopt &amp; play</p>
            <h2 className="mb-1 font-display text-3xl font-bold">Kicau Garden</h2>
            <p className="text-muted">Every bird on Kicau lives here. Tap any bird to view it.</p>
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
            <button className={`btn-ghost shrink-0 ${CHIP}`} onClick={() => setRegistering(true)}>
              + Register<span className="max-sm:hidden"> your bird</span>
            </button>
            <Link href="/taman" className={`btn-primary shrink-0 ${CHIP}`}>
              <span className="max-sm:hidden">Kicau</span> Garden <span className="max-sm:hidden">→</span>
            </Link>
            <Link href="/lomba" className={`btn-primary shrink-0 ${CHIP}`}>
              Contests <span className="max-sm:hidden">→</span>
            </Link>
          </div>
        </div>
        <ShelterScene
          birds={[
            ...BIRDS.map((b, id): SceneBird => {
              const s = species[id];
              return { key: `s${id}`, id, name: b.name, label: s ? `${formatEther(s.price)} MON` : "…", soldOut: !!s && s.minted >= s.maxSupply };
            }),
            ...(community ?? []).slice(0, 6).map((c): SceneBird => ({ key: `r${c.tokenId}`, id: 0, name: c.name, label: `NFT #${c.tokenId}`, image: c.image, imageUp: c.imageUp })),
            ...otherNfts.map((n): SceneBird => ({ key: `p${n.tokenId}`, id: n.species, name: BIRDS[n.species]?.name ?? "Bird", label: short(n.owner) })),
          ].slice(0, MAX_SCENE_BIRDS)}
          onSelect={({ key }) => {
            const n = Number(key.slice(1));
            const bird = key[0] === "r" ? community?.find((c) => Number(c.tokenId) === n) : undefined;
            const nft = key[0] === "p" ? otherNfts.find((o) => o.tokenId === n) : undefined;
            if (key[0] === "s") return species[n] && setOpenSpecies(n);
            if (bird) setGardenOpen({ kind: "registered", bird });
            else if (nft) setGardenOpen({ kind: "player", nft });
          }}
        />
      </section>

      <div className="grid gap-8 pb-6 lg:grid-cols-[1.4fr_1fr]">
        {/* my birds */}
        <section>
          <h2 className="mb-4 font-display text-3xl font-bold">My Birds</h2>
          {!address ? (
            <p className="text-muted">{NET.faucet ? "Hit ⚡ Quick Play or connect a wallet to see your collection." : "Connect a wallet to see your collection."}</p>
          ) : myBirds.length === 0 ? (
            <p className="text-muted">No birds yet. Adopt one from the Shelter.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {myBirds.map((b) => (
                <div key={b.tokenId} className="rounded-3xl border border-line bg-paper p-4">
                  {b.custom ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.custom.image} alt={b.custom.name} className="mx-auto mb-2 h-16 w-auto [image-rendering:pixelated]" />
                  ) : b.species === CUSTOM_SPECIES ? (
                    <div className="mx-auto mb-2 h-16 animate-pulse bg-cream" />
                  ) : (
                    <BirdArt id={b.species} className="mx-auto mb-2 h-16 w-auto" />
                  )}
                  <div className="font-semibold">
                    {birdName(b) ?? "…"} <span className="text-muted">#{b.tokenId}</span>
                  </div>
                  {b.custom && <NftChip id={b.tokenId} />}
                  {b.custom && <Badges bird={b.custom} />}
                  <div className="mb-3 text-sm text-muted">Best: {b.best}</div>
                  <button className="btn-primary w-full !py-2" disabled={!ready} onClick={() => play(b)}>
                    Fly
                  </button>
                  {b.custom && (
                    <button className="btn-ghost mt-2 w-full !py-2" onClick={() => setManaging(b.tokenId)}>
                      Manage
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <Leaderboards
          me={address}
          busy={txBusy}
          canWrite={ready}
          onFund={(amount) => send({ functionName: "fundRewards", args: [0n], value: amount })}
          onClaim={(week) => send({ functionName: "claimWeeklyReward", args: [week] })}
          onRollover={(week) => send({ functionName: "rolloverWeeklyPool", args: [week] })}
          onPlay={playNow}
        />
      </div>

      <div className="band mt-8 pb-14 pt-2">
        <RegisteredBirds
          me={address}
          busy={txBusy}
          onAttest={ready ? attest : undefined}
          onSupport={ready ? supportBird : undefined}
        />
      </div>

      {/* owner view of one of my registered birds: proof + dashboard */}
      {managing !== null && customBirds?.[managing] && (
        <Modal onClose={() => setManaging(null)}>
          <BirdProfileCard
            bird={customBirds[managing]!}
            me={address}
            busy={txBusy}
            onAttest={ready ? attest : undefined}
            onSupport={ready ? supportBird : undefined}
          />
        </Modal>
      )}

      {/* register own bird */}
      {registering && (
        <Modal onClose={() => setRegistering(false)}>
          <RegisterBird
            fee={registerFee !== undefined ? formatEther(registerFee) : "…"}
            busy={txBusy}
            canRegister={ready}
            onRegister={register}
          />
          {!ready && <p className="mt-3 text-sm text-clay">{NET.faucet ? "Hit ⚡ Quick Play or connect a wallet first." : "Connect a wallet first."}</p>}
        </Modal>
      )}

      {/* garden: a registered bird or another player's NFT */}
      {gardenOpen && (
        <Modal onClose={() => setGardenOpen(null)}>
          {gardenOpen.kind === "registered" ? (
            <BirdProfileCard
              bird={gardenOpen.bird}
              me={address}
              busy={txBusy}
              onAttest={ready ? attest : undefined}
              onSupport={ready ? supportBird : undefined}
            />
          ) : (
            <OtherCard nft={gardenOpen.nft} />
          )}
        </Modal>
      )}

      {/* bird card */}
      {openSpecies !== null && species[openSpecies] && (
        <Modal onClose={() => setOpenSpecies(null)}>
          <BirdCard
            id={openSpecies}
            species={species[openSpecies]}
            busy={txBusy}
            canBuy={ready}
            onBuy={() => buy(openSpecies)}
            onSupport={(amount) => support(openSpecies, amount)}
            supported={supportedRaw}
          />
          {!ready && <p className="mt-3 text-sm text-clay">{NET.faucet ? "Hit ⚡ Quick Play or connect a wallet on Monad Testnet to adopt." : `Connect a wallet on ${NET.label} to adopt.`}</p>}
        </Modal>
      )}

      {/* game */}
      {game && (
        <Modal onClose={() => setGame(null)}>
          <div className="mb-3 flex items-center justify-between gap-2 pr-8">
            <span className="font-display text-xl font-bold">
              {game.tokenId === GUEST_TOKEN
                ? "Kenari (guest)"
                : `${myBirds.find((b) => b.tokenId === game.tokenId) ? birdName(myBirds.find((b) => b.tokenId === game.tokenId)!) : ""} #${game.tokenId}`}
            </span>
            <button className="btn-ghost !py-1" onClick={toggleMusic} aria-label={musicMuted ? "Unmute music" : "Mute music"}>
              {musicMuted ? "🔇" : "🎵"}
            </button>
          </div>
          <div className="relative">
            <FlappyGame key={result ? "over" : "play"} start={game} onGameOver={setResult} />
            {result && (
              <div className="absolute inset-0 grid place-items-center rounded-2xl bg-ink/60 p-6 text-center text-paper">
                <div>
                  <div className="text-sm uppercase tracking-wider text-paper/70">Score</div>
                  <div className="mb-4 font-display text-6xl font-extrabold">{result.score}</div>
                  <div className="flex flex-col gap-2">
                    {result.tokenId < 0 ? (
                      <p className="max-w-[16rem] text-sm text-paper/85">Playing as a guest. Adopt a bird in the Shelter to save your score on-chain.</p>
                    ) : !game.runId ? (
                      <p className="max-w-[16rem] text-sm text-paper/85">Practice game: the on-chain run couldn&apos;t start, so this score can&apos;t be submitted.</p>
                    ) : (
                      <button className="btn bg-sun text-ink" disabled={txBusy} onClick={() => submitScore(result)}>
                        {txBusy ? "Submitting…" : "Submit score on-chain"}
                      </button>
                    )}
                    <button
                      className="btn border border-paper/40"
                      disabled={txBusy}
                      onClick={() => {
                        // a run is single-use: replays of an owned bird start a fresh one (new seed + clock)
                        const bird = game.runId && myBirds.find((b) => b.tokenId === game.tokenId);
                        if (bird) play(bird);
                        else setResult(null);
                      }}
                    >
                      Play again
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </main>
  );
}

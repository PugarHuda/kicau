"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { monadTestnet } from "wagmi/chains";
import { FlappyGame } from "@/components/FlappyGame";
import { LiveFeed } from "@/components/LiveFeed";
import { RegisterBird } from "@/components/RegisterBird";
import { Badges, NftChip, RegisteredBirds } from "@/components/RegisteredBirds";
import { ShelterScene } from "@/components/ShelterScene";
import { BirdArt, BirdCard, Modal, TxLink, short, type Species } from "@/components/ui";
import { kicauAbi } from "@/lib/abi";
import { BIRDS } from "@/lib/birds";
import { type BurnerClient, createBurner, forgetBurner, fundBurner, loadBurner } from "@/lib/burner";
import { KICAU_ADDRESS } from "@/lib/config";
import { CUSTOM_SPECIES, fetchCustomBird } from "@/lib/customBirds";
import { GAME_VERSION_CANVAS, GAME_VERSION_RUN, type GameOver, type GameStart } from "@/lib/game";
import { useMusic } from "@/lib/music";
import { fmtUsd, useMonUsd } from "@/lib/price";

const kicau = { address: KICAU_ADDRESS, abi: kicauAbi } as const;
const GUEST_TOKEN = -1;

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
  const wrongChain = isConnected && chainId !== monadTestnet.id;

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
  const publicClient = usePublicClient();
  const [game, setGame] = useState<GameStart | null>(null);
  const [result, setResult] = useState<GameOver | null>(null);
  const [musicMuted, toggleMusic] = useMusic("flappy", !!game);

  // ---- reads
  const enabled = Boolean(KICAU_ADDRESS);
  const { data: speciesRaw } = useReadContract({ ...kicau, functionName: "getAllSpecies", query: { enabled } });
  const species = (speciesRaw ?? []) as readonly Species[];
  const { data: totalConservation } = useReadContract({ ...kicau, functionName: "totalConservation", query: { enabled } });
  const monUsd = useMonUsd();
  const { data: board } = useReadContract({ ...kicau, functionName: "getLeaderboardV2", query: { enabled } });
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

  const leaderboard = useMemo(() => {
    if (!board) return [];
    const [players, scores, validated] = board;
    return players
      .map((p, i) => ({ player: p, score: Number(scores[i]), verified: Number(validated[i]) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [board]);

  // ---- writes. Burner: eth_sendRawTransactionSync (receipt in one call). Wallet: send + wait.
  type Write =
    | { functionName: "buy"; args: readonly [bigint]; value: bigint }
    | { functionName: "startRun"; args: readonly [bigint] }
    | { functionName: "submitRun"; args: readonly [bigint, bigint] }
    | { functionName: "attest"; args: readonly [bigint, string] }
    | { functionName: "supportBird"; args: readonly [bigint]; value: bigint }
    | { functionName: "registerBird"; args: readonly [string, `0x${string}`]; value: bigint }
    | { functionName: "support"; args: readonly [bigint]; value: bigint };

  /** Returns the receipt (truthy) or null; errors land in the toast. */
  async function send(req: Write) {
    setError(undefined);
    const t0 = performance.now();
    try {
      let receipt: TransactionReceipt;
      if (burner) {
        setBurnerBusy(true);
        receipt = await writeContractSync(burner, { ...kicau, ...req } as unknown as Parameters<typeof writeContractSync>[1]);
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
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
              <button className="btn-primary" disabled={funding} onClick={quickPlay}>
                {funding ? "Setting up…" : "⚡ Quick Play"}
              </button>
              <button className="btn-ghost" disabled={connecting} onClick={() =>
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
            <button className="btn-primary bg-clay" onClick={() => switchChain({ chainId: monadTestnet.id })}>
              Switch to Monad Testnet
            </button>
          ) : (
            <button className="btn-ghost" onClick={() => disconnect()} title="Disconnect">
              {short(address!)}
            </button>
          )}
        </div>
      </header>

      {/* hero */}
      <section className="mb-10 grid gap-6 rounded-[2rem] bg-leaf px-6 py-10 text-paper sm:grid-cols-[1.4fr_1fr] sm:px-10">
        <div>
          <h1 className="mb-3 font-display text-4xl font-extrabold leading-[1.05] sm:text-6xl">
            Keep the song,
            <br />
            not the cage.
          </h1>
          <p className="max-w-md text-paper/85">
            Adopt Indonesian songbirds as NFTs, fly them in a pixel game, and every adoption funds bird conservation —
            all on-chain on Monad.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="btn bg-sun text-ink" onClick={playNow}>
              ▶ Play Flappy
            </button>
          </div>
        </div>
        <div className="self-end rounded-3xl bg-paper/10 p-5">
          <div className="text-sm uppercase tracking-wider text-paper/70">Conservation funds raised</div>
          <div className="font-display text-4xl font-extrabold tabular-nums">
            {totalConservation !== undefined ? Number(formatEther(totalConservation)).toFixed(3) : "—"} MON
          </div>
          {totalConservation !== undefined && monUsd && (
            <div className="text-sm tabular-nums text-paper/80" title={`Chainlink MON/USD on Monad mainnet, updated ${new Date(monUsd.updatedAt * 1000).toLocaleTimeString()}`}>
              {fmtUsd(Number(formatEther(totalConservation)), monUsd)} at MON ${monUsd.usd.toFixed(4)} · Chainlink feed
            </div>
          )}
          <div className="text-sm text-paper/70">Forwarded automatically with every transaction — the contract holds no balance.</div>
        </div>
      </section>

      <LiveFeed />

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

      {/* shelter */}
      <section className="mb-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="mb-1 font-display text-3xl font-bold">Shelter</h2>
            <p className="text-muted">Tap a bird to hear its song and see its stats.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => setRegistering(true)}>
              + Register your bird
            </button>
            <Link href="/taman" className="btn-primary">
              Kicau Garden →
            </Link>
            <Link href="/lomba" className="btn-primary">
              Contests →
            </Link>
          </div>
        </div>
        <ShelterScene
          birds={BIRDS.map((b, id) => {
            const s = species[id];
            return {
              id,
              name: b.name,
              priceLabel: s ? `${formatEther(s.price)} MON` : "…",
              soldOut: !!s && s.minted >= s.maxSupply,
            };
          })}
          onSelect={(id) => species[id] && setOpenSpecies(id)}
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* my birds */}
        <section>
          <h2 className="mb-4 font-display text-3xl font-bold">My Birds</h2>
          {!address ? (
            <p className="text-muted">Hit ⚡ Quick Play or connect a wallet to see your collection.</p>
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
                </div>
              ))}
            </div>
          )}
        </section>

        {/* leaderboard */}
        <section>
          <h2 className="mb-4 font-display text-3xl font-bold">Leaderboard</h2>
          <ol className="divide-y divide-line rounded-3xl border border-line bg-paper">
            {leaderboard.length === 0 && <li className="p-4 text-muted">No scores yet. Be the first.</li>}
            {leaderboard.map((r, i) => (
              <li key={r.player} className={`flex items-center justify-between p-4 ${r.player === address ? "bg-sun/15" : ""}`}>
                <span className="flex items-center gap-3">
                  <span className="w-6 font-display text-lg font-bold text-muted">{i + 1}</span>
                  <span className="font-mono text-sm">{short(r.player)}</span>
                </span>
                <span className="flex items-center gap-2">
                  {r.verified > 0 && (
                    <span className="bg-leaf px-1.5 py-0.5 text-xs text-paper" title="Best score from a seeded, time-checked on-chain run">
                      ✔ verified run {r.verified}
                    </span>
                  )}
                  <span className="font-display text-xl font-bold tabular-nums">{r.score}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <RegisteredBirds
        me={address}
        busy={txBusy}
        onAttest={ready ? attest : undefined}
        onSupport={ready ? supportBird : undefined}
      />

      {/* register own bird */}
      {registering && (
        <Modal onClose={() => setRegistering(false)}>
          <RegisterBird
            fee={registerFee !== undefined ? formatEther(registerFee) : "…"}
            busy={txBusy}
            canRegister={ready}
            onRegister={register}
          />
          {!ready && <p className="mt-3 text-sm text-clay">Hit ⚡ Quick Play or connect a wallet first.</p>}
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
          {!ready && <p className="mt-3 text-sm text-clay">Hit ⚡ Quick Play or connect a wallet on Monad Testnet to adopt.</p>}
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

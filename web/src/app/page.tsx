"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { formatEther } from "viem";
import { useAccount, useConnect, useDisconnect, useReadContract, useReadContracts, useSwitchChain, useWriteContractSync } from "wagmi";
import { monadTestnet } from "wagmi/chains";
import { FlappyGame } from "@/components/FlappyGame";
import { BirdArt, BirdCard, IucnBadge, Modal, TxLink, short, type Species } from "@/components/ui";
import { kicauAbi } from "@/lib/abi";
import { BIRDS } from "@/lib/birds";
import { KICAU_ADDRESS } from "@/lib/config";
import { GAME_VERSION_CANVAS, type GameOver, type GameStart } from "@/lib/game";

const kicau = { address: KICAU_ADDRESS, abi: kicauAbi } as const;

export default function Home() {
  const qc = useQueryClient();
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const wrongChain = isConnected && chainId !== monadTestnet.id;

  const { writeContractSyncAsync, isPending: txBusy } = useWriteContractSync();
  const [lastTx, setLastTx] = useState<string>();
  const [error, setError] = useState<string>();

  const [openSpecies, setOpenSpecies] = useState<number | null>(null);
  const [game, setGame] = useState<GameStart | null>(null);
  const [result, setResult] = useState<GameOver | null>(null);

  // ---- reads
  const enabled = Boolean(KICAU_ADDRESS);
  const { data: speciesRaw } = useReadContract({ ...kicau, functionName: "getAllSpecies", query: { enabled } });
  const species = (speciesRaw ?? []) as readonly Species[];
  const { data: totalConservation } = useReadContract({ ...kicau, functionName: "totalConservation", query: { enabled } });
  const { data: board } = useReadContract({ ...kicau, functionName: "getLeaderboard", query: { enabled } });
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

  const myBirds = (tokenIds ?? []).map((id, i) => ({
    tokenId: Number(id),
    species: Number(tokenInfo?.[i * 2]?.result ?? 0n),
    best: Number(tokenInfo?.[i * 2 + 1]?.result ?? 0n),
  }));

  const leaderboard = useMemo(() => {
    if (!board) return [];
    const [players, scores] = board;
    return players
      .map((p, i) => ({ player: p, score: Number(scores[i]) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [board]);

  // ---- writes (eth_sendRawTransactionSync on Monad → receipt in one call)
  async function send(fn: () => Promise<{ transactionHash: string }>) {
    setError(undefined);
    try {
      const receipt = await fn();
      setLastTx(receipt.transactionHash);
      await qc.invalidateQueries();
      return true;
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string };
      setError(err.shortMessage ?? err.message ?? "Transaksi gagal");
      return false;
    }
  }

  async function buy(id: number) {
    const ok = await send(() =>
      writeContractSyncAsync({ ...kicau, functionName: "buy", args: [BigInt(id)], value: species[id].price }),
    );
    if (ok) setOpenSpecies(null);
  }

  async function submitScore(r: GameOver) {
    const ok = await send(() =>
      writeContractSyncAsync({
        ...kicau,
        functionName: "submitScore",
        args: [BigInt(r.tokenId), BigInt(r.score), GAME_VERSION_CANVAS],
      }),
    );
    if (ok) {
      setResult(null);
      setGame(null);
    }
  }

  function play(tokenId: number, speciesId: number) {
    const s = species[speciesId];
    if (!s) return;
    setResult(null);
    setGame({
      tokenId,
      species: speciesId,
      stats: { gravity: s.gravity, flapPower: s.flapPower, hitbox: s.hitbox },
      gameVersion: GAME_VERSION_CANVAS,
    });
  }

  const ready = isConnected && !wrongChain;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      {/* header */}
      <header className="flex flex-wrap items-center justify-between gap-3 py-5">
        <div className="flex items-center gap-2">
          <BirdArt id={0} className="h-9 w-auto" />
          <span className="font-display text-2xl font-extrabold tracking-tight">Kicau</span>
        </div>
        <div className="flex items-center gap-2">
          {!isConnected ? (
            <button className="btn-primary" disabled={connecting} onClick={() => connect({ connector: connectors[0] })}>
              {connecting ? "Menghubungkan…" : "Connect wallet"}
            </button>
          ) : wrongChain ? (
            <button className="btn-primary bg-clay" onClick={() => switchChain({ chainId: monadTestnet.id })}>
              Pindah ke Monad Testnet
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
            Pelihara kicaunya,
            <br />
            bukan sangkarnya.
          </h1>
          <p className="max-w-md text-paper/85">
            Adopsi burung kicau Nusantara sebagai NFT, terbangkan di game, dan setiap adopsi langsung mendanai konservasi.
            Semua tercatat on-chain di Monad.
          </p>
        </div>
        <div className="self-end rounded-3xl bg-paper/10 p-5">
          <div className="text-sm uppercase tracking-wider text-paper/70">Dana konservasi terkumpul</div>
          <div className="font-display text-4xl font-extrabold tabular-nums">
            {totalConservation !== undefined ? Number(formatEther(totalConservation)).toFixed(3) : "—"} MON
          </div>
          <div className="text-sm text-paper/70">Dikirim otomatis di tiap transaksi, kontrak tidak menahan saldo.</div>
        </div>
      </section>

      {!enabled && (
        <p className="mb-6 rounded-2xl border border-clay/40 bg-clay/10 p-4 text-sm">
          Kontrak belum dikonfigurasi. Set <code>NEXT_PUBLIC_KICAU_ADDRESS</code> di <code>web/.env.local</code>.
        </p>
      )}
      {(error || lastTx) && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-paper p-4 text-sm">
          {error ? <span className="text-clay">{error}</span> : <span className="font-semibold">✓ Transaksi terkonfirmasi</span>}
          {!error && <TxLink hash={lastTx} />}
        </div>
      )}

      {/* shelter */}
      <section className="mb-12">
        <h2 className="mb-1 font-display text-3xl font-bold">Shelter</h2>
        <p className="mb-5 text-muted">Klik burung untuk mendengar kicaunya dan melihat statsnya.</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {BIRDS.map((b, id) => {
            const s = species[id];
            return (
              <button
                key={id}
                onClick={() => s && setOpenSpecies(id)}
                className="group rounded-3xl border border-line bg-paper p-4 text-left transition hover:-translate-y-1 hover:border-ink hover:shadow-lg"
              >
                <div className="mb-3 grid place-items-center rounded-2xl bg-cream py-4">
                  <BirdArt id={id} className="h-20 w-auto transition group-hover:scale-110" />
                </div>
                <div className="font-display text-lg font-bold leading-tight">{b.name}</div>
                <div className="mb-2 text-xs text-muted">{b.rarity}</div>
                <div className="flex items-center justify-between gap-1">
                  <IucnBadge id={id} />
                  <span className="text-sm font-semibold tabular-nums">{s ? `${formatEther(s.price)} MON` : "…"}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* my birds */}
        <section>
          <h2 className="mb-4 font-display text-3xl font-bold">Burungku</h2>
          {!isConnected ? (
            <p className="text-muted">Hubungkan wallet untuk melihat koleksimu.</p>
          ) : myBirds.length === 0 ? (
            <p className="text-muted">Belum punya burung. Adopsi satu dari Shelter.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {myBirds.map((b) => (
                <div key={b.tokenId} className="rounded-3xl border border-line bg-paper p-4">
                  <BirdArt id={b.species} className="mx-auto mb-2 h-16 w-auto" />
                  <div className="font-semibold">
                    {BIRDS[b.species]?.name} <span className="text-muted">#{b.tokenId}</span>
                  </div>
                  <div className="mb-3 text-sm text-muted">Best: {b.best}</div>
                  <button className="btn-primary w-full !py-2" disabled={!ready} onClick={() => play(b.tokenId, b.species)}>
                    Terbang
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
            {leaderboard.length === 0 && <li className="p-4 text-muted">Belum ada skor. Jadilah yang pertama.</li>}
            {leaderboard.map((r, i) => (
              <li key={r.player} className={`flex items-center justify-between p-4 ${r.player === address ? "bg-sun/15" : ""}`}>
                <span className="flex items-center gap-3">
                  <span className="w-6 font-display text-lg font-bold text-muted">{i + 1}</span>
                  <span className="font-mono text-sm">{short(r.player)}</span>
                </span>
                <span className="font-display text-xl font-bold tabular-nums">{r.score}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* bird card */}
      {openSpecies !== null && species[openSpecies] && (
        <Modal onClose={() => setOpenSpecies(null)}>
          <BirdCard
            id={openSpecies}
            species={species[openSpecies]}
            busy={txBusy}
            canBuy={ready}
            onBuy={() => buy(openSpecies)}
          />
          {!ready && <p className="mt-3 text-sm text-clay">Hubungkan wallet ke Monad Testnet untuk adopsi.</p>}
        </Modal>
      )}

      {/* game */}
      {game && (
        <Modal onClose={() => setGame(null)}>
          <div className="mb-3 font-display text-xl font-bold">
            {BIRDS[game.species]?.name} #{game.tokenId}
          </div>
          <div className="relative">
            <FlappyGame key={result ? "over" : "play"} start={game} onGameOver={setResult} />
            {result && (
              <div className="absolute inset-0 grid place-items-center rounded-2xl bg-ink/60 p-6 text-center text-paper">
                <div>
                  <div className="text-sm uppercase tracking-wider text-paper/70">Skor</div>
                  <div className="mb-4 font-display text-6xl font-extrabold">{result.score}</div>
                  <div className="flex flex-col gap-2">
                    <button className="btn bg-sun text-ink" disabled={txBusy} onClick={() => submitScore(result)}>
                      {txBusy ? "Mengirim…" : "Kirim skor on-chain"}
                    </button>
                    <button className="btn border border-paper/40" onClick={() => setResult(null)}>
                      Main lagi
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

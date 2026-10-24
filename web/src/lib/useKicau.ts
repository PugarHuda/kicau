"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { BaseError, ContractFunctionRevertedError, parseEventLogs, type TransactionReceipt } from "viem";
import { writeContractSync } from "viem/actions";
import { useAccount, useConnect, useDisconnect, usePublicClient, useSwitchChain, useWriteContractSync } from "wagmi";
import { monadTestnet } from "wagmi/chains";
import { kicauAbi } from "./abi";
import { type BurnerClient, createBurner, forgetBurner, fundBurner, loadBurner } from "./burner";
import { KICAU_ADDRESS } from "./config";

export const kicau = { address: KICAU_ADDRESS, abi: kicauAbi } as const;

export type KicauWrite =
  | { functionName: "buy"; args: readonly [bigint]; value: bigint }
  | { functionName: "submitScore"; args: readonly [bigint, bigint, number] }
  | { functionName: "registerBird"; args: readonly [string, `0x${string}`]; value: bigint }
  | { functionName: "support" | "supportBird"; args: readonly [bigint]; value: bigint }
  | { functionName: "startRun"; args: readonly [bigint] }
  | { functionName: "submitRun"; args: readonly [bigint, bigint] }
  | { functionName: "attest"; args: readonly [bigint, string] }
  | { functionName: "createContest"; args: readonly [string, string, bigint, readonly `0x${string}`[], bigint] }
  | { functionName: "enter"; args: readonly [bigint, bigint]; value: bigint }
  | { functionName: "startJudging" | "finalize" | "cancelContest"; args: readonly [bigint] }
  | { functionName: "updateBird"; args: readonly [bigint, `0x${string}`] }
  | { functionName: "withdrawOwed"; args: readonly [] }
  | { functionName: "revokeAttestation"; args: readonly [bigint, bigint] }
  | { functionName: "withdrawOwed"; args: readonly [] }
  | { functionName: "score"; args: readonly [bigint, bigint, number, number, number, number] };

/** Human messages for the contract's custom errors. */
const FRIENDLY: Record<string, string> = {
  ScoreTooFast: "Score rejected: higher than the run's play time allows (max 1 point per second).",
  RunExpired: "This run is older than 1 hour. Start a new flight to submit.",
  RunNotActive: "This run is closed (already submitted, or a newer run was started). Start a new flight.",
  NotRunPlayer: "This run belongs to another player.",
  NotBirdOwner: "You don't own this bird.",
  NotOrganizer: "Only registered organizers can attest titles.",
  NotCustomBird: "Titles can only be attested to registered birds.",
  SoldOut: "This species is sold out.",
  NotHost: "Only the contest host can do this.",
  NotJudge: "Only this contest's judges can score.",
  BadStatus: "Not allowed in the contest's current stage.",
  EntryClosed: "Entries for this contest are closed.",
  AlreadyEntered: "This bird is already entered.",
  ContestFull: "This contest is full (32 entries).",
  NotEnoughEntries: "Need at least 2 entries to start judging.",
  InvalidContest: "Invalid contest settings (name 1–64, class 1–32, 1–5 unique judges, future deadline).",
  InvalidScore: "Each aspect must be 0–10.",
  BelowMinSupport: "Minimum support is 10% of this bird's Kicau Value.",
  InvalidAttestation: "This attestation is already revoked or isn't yours.",
};

function errorText(e: unknown) {
  const revert = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null;
  const name = revert instanceof ContractFunctionRevertedError ? revert.data?.errorName : undefined;
  const err = e as { shortMessage?: string; message?: string };
  const raw = err.shortMessage ?? err.message ?? "Transaction failed";
  const known = name ?? Object.keys(FRIENDLY).find((k) => (err.message ?? "").includes(k));
  return (known && FRIENDLY[known]) || raw;
}

/**
 * Wallet + Quick Play burner + writes, shared by every page.
 * Burner: signs in-browser → eth_sendRawTransactionSync (receipt in one call). Wallet: wagmi send + wait.
 */
export function useKicau() {
  const qc = useQueryClient();
  const client = usePublicClient();
  const { address: walletAddress, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const wrongChain = isConnected && chainId !== monadTestnet.id;

  const [burner, setBurner] = useState<BurnerClient | null>(null);
  const [funding, setFunding] = useState(false);
  useEffect(() => setBurner(loadBurner()), []);
  const address = burner?.account.address ?? walletAddress;

  const { writeContractSyncAsync, isPending: walletBusy } = useWriteContractSync();
  const [burnerBusy, setBurnerBusy] = useState(false);
  const txBusy = walletBusy || burnerBusy;
  const [lastTx, setLastTx] = useState<string>();
  const [lastMs, setLastMs] = useState<number>();
  const [error, setError] = useState<string>();

  /** Sends one contract write; resolves with the receipt once it's in and queries are refreshed (null on failure). */
  async function sendTx(req: KicauWrite): Promise<TransactionReceipt | null> {
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
      await qc.invalidateQueries();
      return receipt;
    } catch (e) {
      setError(errorText(e));
      return null;
    } finally {
      setBurnerBusy(false);
    }
  }

  /** Sends one contract write; resolves true once the receipt is in and queries are refreshed. */
  async function send(req: KicauWrite) {
    return (await sendTx(req)) !== null;
  }

  /** startRun → { runId, seed } from the RunStarted log (fallback: read the player's active run). */
  async function startVerifiedRun(tokenId: bigint) {
    const receipt = await sendTx({ functionName: "startRun", args: [tokenId] });
    if (!receipt) return null;
    const [log] = parseEventLogs({ abi: kicauAbi, eventName: "RunStarted", logs: receipt.logs });
    if (log) return { runId: log.args.runId, seed: log.args.seed };
    try {
      const runId = await client!.readContract({ ...kicau, functionName: "activeRunOf", args: [address!] });
      const run = await client!.readContract({ ...kicau, functionName: "runs", args: [runId] });
      return { runId, seed: run[5] };
    } catch {
      setError("Run started, but its seed couldn't be read. Try again.");
      return null;
    }
  }

  /** Creates (or reuses) the burner and tops it up from /api/faucet. */
  async function quickPlay() {
    setError(undefined);
    const b = burner ?? createBurner();
    setBurner(b);
    setFunding(true);
    try {
      await fundBurner(b.account.address);
    } catch (e) {
      setError(`${(e as Error).message}. Top up manually from faucet.monad.xyz to ${b.account.address}`);
    } finally {
      setFunding(false);
      await qc.invalidateQueries();
    }
  }

  function leaveBurner() {
    forgetBurner();
    setBurner(null);
  }

  function connectWallet() {
    connect(
      { connector: connectors[0] },
      {
        onError: (e) =>
          setError(e.message.startsWith("Provider not found") ? "Wallet not detected. Install MetaMask, or use ⚡ Quick Play." : e.message),
      },
    );
  }

  const switchToMonad = useCallback(() => switchChain({ chainId: monadTestnet.id }), [switchChain]);

  return {
    // identity
    burner,
    walletAddress,
    isConnected,
    wrongChain,
    address,
    /** can send a tx right now (burner, or wallet on Monad testnet) */
    ready: !!burner || (isConnected && !wrongChain),
    // actions
    send,
    sendTx,
    startVerifiedRun,
    quickPlay,
    leaveBurner,
    connectWallet,
    disconnect: () => disconnect(),
    switchToMonad,
    // status
    connecting,
    funding,
    txBusy,
    lastTx,
    lastMs,
    error,
    setError,
  };
}

export type Kicau = ReturnType<typeof useKicau>;

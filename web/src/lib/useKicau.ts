"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { writeContractSync } from "viem/actions";
import { useAccount, useConnect, useDisconnect, useSwitchChain, useWriteContractSync } from "wagmi";
import { monadTestnet } from "wagmi/chains";
import { kicauAbi } from "./abi";
import { type BurnerClient, createBurner, forgetBurner, fundBurner, loadBurner } from "./burner";
import { KICAU_ADDRESS } from "./config";

export const kicau = { address: KICAU_ADDRESS, abi: kicauAbi } as const;

export type KicauWrite =
  | { functionName: "buy"; args: readonly [bigint]; value: bigint }
  | { functionName: "submitScore"; args: readonly [bigint, bigint, number] }
  | { functionName: "registerBird"; args: readonly [string, `0x${string}`]; value: bigint }
  | { functionName: "support"; args: readonly [bigint]; value: bigint };

/**
 * Wallet + Quick Play burner + writes, shared by every page.
 * Burner: signs in-browser → eth_sendRawTransactionSync (receipt in one call). Wallet: wagmi send + wait.
 */
export function useKicau() {
  const qc = useQueryClient();
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

  /** Sends one contract write; resolves true once the receipt is in and queries are refreshed. */
  async function send(req: KicauWrite) {
    setError(undefined);
    const t0 = performance.now();
    try {
      let receipt: { transactionHash: string };
      if (burner) {
        setBurnerBusy(true);
        receipt = await writeContractSync(burner, { ...kicau, ...req } as unknown as Parameters<typeof writeContractSync>[1]);
      } else {
        receipt = await writeContractSyncAsync({ ...kicau, ...req } as unknown as Parameters<typeof writeContractSyncAsync>[0]);
      }
      setLastMs(Math.round(performance.now() - t0));
      setLastTx(receipt.transactionHash);
      await qc.invalidateQueries();
      return true;
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string };
      setError(err.shortMessage ?? err.message ?? "Transaction failed");
      return false;
    } finally {
      setBurnerBusy(false);
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

"use client";

import { decodePaymentResponseHeader } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { useState } from "react";
import { erc20Abi } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { short } from "@/components/ui";
import { loadBurner } from "@/lib/burner";
import { EXPLORER } from "@/lib/config";
import { CERTIFICATE_PRICE_USD, MONAD_TESTNET_USDC, X402_NETWORK } from "@/lib/x402";

type State = { kind: "idle" | "busy" } | { kind: "nofunds"; address: string } | { kind: "error"; msg: string } | { kind: "done"; tx: string; url: string };

/** Buys the pedigree certificate over x402: HTTP 402 → sign USDC authorization (no gas) → facilitator settles on Monad. */
export function CertificateButton({ tokenId }: { tokenId: bigint }) {
  const client = usePublicClient();
  const { data: wallet } = useWalletClient();
  const [state, setState] = useState<State>({ kind: "idle" });

  async function buy() {
    // Quick Play burner signs silently; otherwise the connected wallet shows one EIP-712 signature prompt.
    const burner = loadBurner();
    const address = burner?.account.address ?? wallet?.account.address;
    type Typed = Parameters<NonNullable<typeof burner>["signTypedData"]>[0];
    const sign = (m: unknown) => (burner ? burner.signTypedData(m as Typed) : wallet!.signTypedData(m as Typed));
    if (!address || !client) return setState({ kind: "error", msg: "Start Quick Play or connect a wallet first." });
    setState({ kind: "busy" });
    try {
      const bal = await client.readContract({ address: MONAD_TESTNET_USDC, abi: erc20Abi, functionName: "balanceOf", args: [address] });
      if (bal < BigInt(Math.round(CERTIFICATE_PRICE_USD * 1e6))) return setState({ kind: "nofunds", address });
      const scheme = new ExactEvmScheme({ address, signTypedData: sign });
      const pay = wrapFetchWithPayment(fetch, new x402Client().register(X402_NETWORK, scheme));
      const res = await pay(`/api/certificate/${tokenId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const header = res.headers.get("payment-response");
      const tx = header ? decodePaymentResponseHeader(header).transaction : "";
      const url = URL.createObjectURL(await res.blob());
      setState({ kind: "done", tx, url });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      setState({ kind: "error", msg: e instanceof Error ? e.message.slice(0, 160) : "Payment failed" });
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-line p-3 text-sm">
      <button className="btn-ghost" disabled={state.kind === "busy"} onClick={buy}>
        {state.kind === "busy" ? "Paying via x402…" : `📜 Get certificate · $${CERTIFICATE_PRICE_USD} USDC (x402)`}
      </button>
      <p className="mt-1 text-xs text-muted">Printable pedigree certificate. Paid with a gasless USDC signature, settled on Monad by the x402 facilitator.</p>
      {state.kind === "nofunds" && (
        <p className="mt-2 text-xs">
          {short(state.address)} has no test USDC. Get 1 USDC (Monad Testnet) at{" "}
          <a className="underline" href="https://faucet.circle.com" target="_blank" rel="noreferrer">
            faucet.circle.com
          </a>{" "}
          for <span className="font-mono">{state.address}</span>, then retry.
        </p>
      )}
      {state.kind === "error" && <p className="mt-2 text-xs text-clay">{state.msg}</p>}
      {state.kind === "done" && (
        <p className="mt-2 text-xs">
          Paid ✔{" "}
          <a className="underline" href={state.url} target="_blank" rel="noreferrer">
            open certificate
          </a>
          {state.tx && (
            <>
              {" "}
              · settlement{" "}
              <a className="font-mono underline" href={`${EXPLORER}/tx/${state.tx}`} target="_blank" rel="noreferrer">
                {short(state.tx)}
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}

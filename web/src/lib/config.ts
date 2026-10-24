import { createConfig } from "wagmi";
import { monadTestnet } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { rpcTransport } from "./rpc";

export const KICAU_ADDRESS = (process.env.NEXT_PUBLIC_KICAU_ADDRESS ?? "") as `0x${string}`;
/** Kicau deploy block = log scan start (no Kicau log exists before it). Current: deploy tx 0xc1abd22c…f0b96b9b. Override per redeploy. */
export const KICAU_DEPLOY_BLOCK = BigInt(process.env.NEXT_PUBLIC_KICAU_DEPLOY_BLOCK || "73741359");
export const EXPLORER = "https://testnet.monadvision.com";

export const config = createConfig({
  chains: [monadTestnet],
  connectors: [injected()],
  transports: { [monadTestnet.id]: rpcTransport },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}

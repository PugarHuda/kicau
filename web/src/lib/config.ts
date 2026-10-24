import { createConfig } from "wagmi";
import { NET } from "./network";
import { injected } from "wagmi/connectors";
import { rpcTransport } from "./rpc";

export const KICAU_ADDRESS = NET.address;
/** Kicau deploy block = log scan start (no Kicau log exists before it). Current: deploy tx 0x2d3980a3…5efb69d (testnet 0x9479…0F58). Override per redeploy. */
export const KICAU_DEPLOY_BLOCK = NET.deployBlock;
export const EXPLORER = NET.explorer;

export const config = createConfig({
  chains: [NET.chain],
  connectors: [injected()],
  transports: { [NET.chainId]: rpcTransport } as Record<typeof NET.chainId, typeof rpcTransport>, // only the active network is ever used
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}

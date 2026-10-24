import { createConfig, http } from "wagmi";
import { monadTestnet } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const KICAU_ADDRESS = (process.env.NEXT_PUBLIC_KICAU_ADDRESS ?? "") as `0x${string}`;
export const EXPLORER = "https://testnet.monadvision.com";

export const config = createConfig({
  chains: [monadTestnet],
  connectors: [injected()],
  transports: { [monadTestnet.id]: http() },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}

// One codebase, two Vercel deployments: NEXT_PUBLIC_NETWORK=mainnet → mainnet.kicau.xyz, anything else → testnet (kicau.xyz).
import { monad, monadTestnet } from "viem/chains";

export const NETWORK: "mainnet" | "testnet" = process.env.NEXT_PUBLIC_NETWORK === "mainnet" ? "mainnet" : "testnet";

const NETS = {
  testnet: {
    chain: monadTestnet,
    rpcs: ["https://testnet-rpc.monad.xyz", "https://monad-testnet.drpc.org", "https://rpc.ankr.com/monad_testnet"],
    ws: "wss://testnet-rpc.monad.xyz",
    explorer: "https://testnet.monadvision.com",
    label: "Monad testnet",
    faucet: true,
    site: "https://kicau.xyz",
    otherUrl: "https://mainnet.kicau.xyz",
    address: "0x947929841Ba8154BB6E9BDeb35137d159c6A0F58",
    deployBlock: "73741359",
    x402Network: "eip155:10143",
    usdc: "0x534b2f3A21130d7a60830c2Df862319e593943A3", // Circle testnet USDC (faucet.circle.com)
  },
  mainnet: {
    chain: monad,
    rpcs: ["https://rpc.monad.xyz", "https://rpc1.monad.xyz", "https://rpc2.monad.xyz", "https://monad-mainnet.drpc.org"],
    ws: "wss://rpc.monad.xyz", // monadLogs verified 2026-10-24
    explorer: "https://monadvision.com",
    label: "Monad mainnet",
    faucet: false,
    site: "https://mainnet.kicau.xyz",
    otherUrl: "https://kicau.xyz",
    address: "0xA98CeE28C6EB35b6Ee7440b7490e265f23975d61",
    deployBlock: "116116801",
    x402Network: "eip155:143", // listed by the facilitator's /supported (exact + upto)
    usdc: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603", // Circle USDC on Monad: name "USDC", version "2", 6 decimals (read on-chain)
  },
} as const;

const n = NETS[NETWORK];
export const NET = {
  ...n,
  chainId: n.chain.id,
  address: (process.env.NEXT_PUBLIC_KICAU_ADDRESS || n.address) as `0x${string}`,
  deployBlock: BigInt(process.env.NEXT_PUBLIC_KICAU_DEPLOY_BLOCK || n.deployBlock),
};

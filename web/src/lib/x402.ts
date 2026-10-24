// x402 on Monad, per https://docs.monad.xyz/guides/x402-guide (Monad-hosted facilitator, x402 v2). Its /supported lists
// both eip155:10143 and eip155:143 (exact + upto), so certificates work on either network.
import { NET } from "./network";

export const X402_NETWORK = NET.x402Network;
export const X402_FACILITATOR = "https://x402-facilitator.molandak.org";
/** Circle USDC on the active Monad network (EIP-3009, EIP-712 domain name "USDC", version "2"). Testnet faucet: https://faucet.circle.com */
export const MONAD_TESTNET_USDC = NET.usdc; // ponytail: name kept so importers stay untouched; it is the active network's USDC
export const CERTIFICATE_PRICE_USD = 0.01;

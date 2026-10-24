import { fallback, http } from "viem";

// Public Monad testnet RPCs rate-limit (HTTP 429) under demo load; fall back across providers.
export const rpcTransport = fallback([
  http("https://testnet-rpc.monad.xyz"),
  http("https://monad-testnet.drpc.org"),
  http("https://rpc.ankr.com/monad_testnet"),
]);

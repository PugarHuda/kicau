import { fallback, http } from "viem";
import { NET } from "./network";

// Public Monad RPCs rate-limit (HTTP 429) under demo load; fall back across providers (per network, see lib/network.ts).
export const rpcTransport = fallback(NET.rpcs.map((u) => http(u)));

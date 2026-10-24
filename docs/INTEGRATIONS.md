# Kicau: Monad integrations

Kicau is the on-chain record for real-life songbird contests. This page lists every Monad / ecosystem integration we checked on 24 Oct 2026, its status, and proof for what shipped. No mock data: an item is either live against real Monad infra or marked not feasible.

## Summary

| # | Integration | Status | Why / proof |
|---|---|---|---|
| a | **x402 paid pedigree certificate** (Monad facilitator, testnet USDC) | ✅ **Implemented** | `GET /api/certificate/[tokenId]` returns HTTP 402, the client signs an EIP-3009 USDC authorization (no gas), and the Monad facilitator settles on-chain. Proof txs are listed below |
| c | **MON/USD price via Chainlink** (hero shows the conservation fund in USD) | ✅ **Implemented** | Reads Chainlink `MON / USD` proxy `0xBcD78f76005B7515837af6b50c7C52BCf73822fb` on Monad mainnet (8 decimals, 1 h heartbeat / 0.02% deviation). Live read: $0.02169, updated 4 s earlier |
| c' | Pyth (Hermes + `0x2880aB15…7B43` on testnet) | ❌ Not feasible today | Since the Pyth Core upgrade (26 Aug 2026), Hermes returns `401 unauthorized` without an API key, which needs a Pyth Terminal signup. The on-chain MON/USD on the testnet Pyth contract is about 24 days stale (no one pushes updates) |
| c'' | Chainlink on Monad **testnet** | ❌ No MON feed | The testnet only has USDT, USDC, BTC, LINK and ETH /USD. Testnet MON has no market price anyway, so the mainnet feed is the honest reference |
| c''' | Stork / Redstone | ⏭ Skipped | Stork's pull oracle needs an API key. Redstone's push feeds on 10143 use a 6 h heartbeat. Chainlink mainnet is fresher and needs no key |
| b | MPP (`@monad-crypto/mpp` 0.0.3 + `mppx`) | ⏭ Not chosen | MPP is a second machine-payment protocol (one-time ERC-20 transfer). Its server needs a **server private key** to submit or verify transfers, while x402 with the Monad facilitator needs no key on our server (the facilitator pays gas). Same use case as (a), so we kept one protocol |
| d | Envio HyperIndex | ❌ Not feasible today | Deploying to Envio Cloud needs `envio-cloud` login via GitHub plus a pushed indexer repo (interactive signup). We don't need it either: Kicau reads pedigree from one block via `registeredAt`, and the live feed uses `monadLogs` |
| e1 | ERC-8004 agent identity | ⏭ Not now | The registries exist on Monad (same addresses on mainnet and testnet, see the monskills `addresses` skill), but Kicau has no autonomous agent to register. Value: low |
| e2 | EIP-7702 "adopt + support in one tx" | ⏭ Not now | Supported on Monad, but it needs a delegate/batcher contract plus wallet support for type-4 txs. The burner flow already makes each action 1 call (~0.8 s). Medium effort, low marginal value before the freeze |
| e3 | Para embedded wallet | ⏭ Not now | Needs a Para developer account and API key (signup). The Quick Play burner already gives popup-free onboarding |
| f | **Public read API + shareable result pages** | ✅ **Implemented** | `GET /api/contest/<id>`, `GET /api/bird/<id>` (CORS `*`, read live from the contract over the Monad testnet RPC fallback set) and `/lomba/<id>` with a per-contest `opengraph-image.tsx` rendered from `getContest` + `entriesOf` + `BirdRegistered` logs. The x402 certificate embeds a QR to `/api/bird/<id>` |
| g | **`monadLogs` speculative subscription** | ✅ **Implemented** | `web/src/lib/live.ts` (LIVE KICAU feed) and `web/src/lib/contestLive.ts` (contest scoreboard). Judge score → spectator scoreboard measured 782–1012 ms in the final QA run; feed items show Proposed → Voted → Finalized |
| h | **`eth_sendRawTransactionSync`** (⚡ Quick Play burner) | ✅ **Implemented** | `web/src/lib/useKicau.ts` + `burner.ts`: one RPC call returns the receipt. Final QA: createContest / enter / startJudging / score / finalize each 536–913 ms |
| i | **AI species identification** (Anthropic Claude) | ✅ **Implemented** | `web/src/app/api/identify/route.ts`: Haiku first, escalates to Sonnet when unsure; 5/5 correct on our test photos. Optional: without a key the register flow still works (species chosen manually) |
| j | **devnads faucet + verification API** | ✅ **Implemented** | `/api/faucet` funds Quick Play burners; testnet + mainnet contracts verified on MonadVision + Monadscan via the devnads API |

## (a) x402 paid certificate: how it works

- **Endpoint:** `web/src/app/api/certificate/[tokenId]/route.ts`
  1. Reads the bird first (`BirdRegistered` log + `registeredAt` + `treasury()`). A missing bird gets a 404, so we never charge for a certificate we can't issue.
  2. No `PAYMENT-SIGNATURE` header → **402** with a `PAYMENT-REQUIRED` header (x402 v2): `exact` scheme, network `eip155:10143`, 0.01 USDC (`10000` atomic units of `0x534b2f3A21130d7a60830c2Df862319e593943A3`, EIP-712 domain `USDC`/`2`), `payTo` = the contract's `treasury()`.
  3. With a signature → facilitator `/verify` → `/settle` (`https://x402-facilitator.molandak.org`, signer `0x7f6a2850…Db86`) → returns a printable **SVG certificate**. The certificate includes the settlement tx hash and payer, and the response sets a `PAYMENT-RESPONSE` header.
- **Client:** `web/src/components/CertificateButton.tsx`, a "📜 Get certificate · $0.01 USDC (x402)" button in `BirdProfileCard`. It uses `@x402/fetch` `wrapFetchWithPayment` and `@x402/evm` `ExactEvmScheme`. The signer is the Quick Play burner (silent) or the connected wallet (one EIP-712 prompt). The payer needs **no MON**: the facilitator pays gas. If the payer has no USDC, the button shows a link to the Circle faucet (`faucet.circle.com`, Monad Testnet, 1 USDC / 2 h) with the address.
- **Constants:** `web/src/lib/x402.ts`
- **Packages (exact pins):** `@x402/core@2.28.0`, `@x402/evm@2.28.0`, `@x402/fetch@2.28.0`. We did not use `@x402/next`: 2.28 has a peer dependency on `next >= 16.2.6`, while we run Next 15.5, so the route drives `x402ResourceServer` directly.

**Proof (Monad testnet, real settlements):**

| What | Tx |
|---|---|
| Funding a fresh payer `0xEdD5…876d` with 1 test USDC (it has 0 MON) | [`0xa5e9d29d…376b92`](https://testnet.monadvision.com/tx/0xa5e9d29d1a4a82e534857020fb3df10d9464d88d4fa1e362356b69ab6e376b92) |
| Scripted x402 payment (Node `wrapFetchWithPayment`), certificate #12: 402 → 200 `image/svg+xml` in 2.4 s | [`0x41d0d530…6fe0cbc`](https://testnet.monadvision.com/tx/0x41d0d53034a4a5096a733e2d34052e694780a8c780437047f223f7f166fe0cbc). Sent by the facilitator `0x7f6a…db86` to USDC; logs: `AuthorizationUsed` + `Transfer` |
| Browser x402 payment (UI button, burner signer), certificate #14 | [`0xfd849420…d7793632`](https://testnet.monadvision.com/tx/0xfd849420eee6b442d2e2f0a37868680335f7ec52ab5418e5e872a124d7793632) |

## (c) USD pricing

- `web/src/lib/price.ts`: `fetchMonUsd()` calls `latestRoundData()` on the Chainlink MON/USD proxy over `https://rpc.monad.xyz` (CORS allows the live domain). `useMonUsd()` refetches every 60 s.
- Hero (`page.tsx`): "≈ $0.0021 at MON $0.0217 · Chainlink feed" under the conservation total. The tooltip shows the feed's `updatedAt`. If the read fails, the line is hidden; we never show a made-up number.
- Note: the app runs on testnet, so the USD figure is the *mainnet* MON price applied to testnet MON. The label says "at MON $x".

## Revenue angle (for the pitch)

The x402 certificate is a working **pay-per-document API**: no account and no subscription, and AI agents or contest organizers can call it machine-to-machine. Revenue goes straight to the Kicau treasury in USDC, and settlement costs the payer no gas. Planned extensions (not built): paid organizer onboarding and per-call pedigree lookups.

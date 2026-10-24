# Kicau

**The on-chain record for real-life songbird contests.** Kicau puts Indonesian *gantangan* songbird contests on Monad: judges score on-chain, a live scoreboard updates in under a second, prizes pay out in the finalize tx, and champion titles become verifiable pedigree for real birds. Plus a pixel Flappy game and open world where your bird lives.

Built at **Monad Blitz Jogja 2026** · [docs/JUDGING.md](docs/JUDGING.md) (rubric → evidence) · [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) · [docs/PEDIGREE.md](docs/PEDIGREE.md) · [docs/BRIEF.md](docs/BRIEF.md)

| | |
|---|---|
| **Live app** | **https://kicau.xyz** (custom domain) · https://kicau-theta.vercel.app |
| Pages | [Home](https://kicau.xyz) · [Contests `/lomba`](https://kicau.xyz/lomba) · result page `/lomba/<id>` · [Kicau Garden `/taman`](https://kicau.xyz/taman) · [Pitch deck `/pitch`](https://kicau.xyz/pitch) |
| **Testnet** (chain 10143, used by the app) | [`0x947929841Ba8154BB6E9BDeb35137d159c6A0F58`](https://testnet.monadvision.com/address/0x947929841Ba8154BB6E9BDeb35137d159c6A0F58) · verified on MonadVision + [Monadscan](https://testnet.monadscan.com/address/0x947929841Ba8154BB6E9BDeb35137d159c6A0F58) · deploy tx [`0x2d3980a3…5efb69d`](https://testnet.monadvision.com/tx/0x2d3980a35125711b90e1d3b6972c8991ce6bb22fc21d89975d4dae1a15efb69d) (block 73741359) |
| **Mainnet** (chain 143) | [`0xA98CeE28C6EB35b6Ee7440b7490e265f23975d61`](https://monadvision.com/address/0xA98CeE28C6EB35b6Ee7440b7490e265f23975d61) · verified on MonadVision + [Monadscan](https://monadscan.com/address/0xA98CeE28C6EB35b6Ee7440b7490e265f23975d61) · deploy tx [`0x34c0b085…a3bb01`](https://monadvision.com/tx/0x34c0b0859000f0a8c99e04d1b5f705626951714bb81faef3d37640c4c2a3bb01) · weekly pool funded 0.5 MON |
| Source | Same `contracts/src/Kicau.sol` on both networks · 57 Foundry tests · organizer "Kicau Demo Contest" registered on both |
| Build in public | [X thread](https://x.com/BangDropID/status/2113853488170156259) · [update](https://x.com/BangDropID/status/2113869717429789043) · more in [JUDGING.md](docs/JUDGING.md#3-advance--did-anyone-see-it--build-in-public-100) |

## Problem

*Kicau mania* is a nationwide Indonesian hobby with weekly songbird contests. Scores are on paper, results get disputed, and champion titles and pedigrees can't be verified. Demand for champion singers also drives poaching (Straw-headed bulbul and Bali myna are Critically Endangered).

## Features

### 🏆 Contests
- **Host a gantangan** (`/lomba`): name, class, entry fee, 1–5 judges, deadline. Owners `enter` registered birds; fees form the prize pool.
- **Judges score on-chain**: melody, volume, duration, style (0–10 each), one tx per score. **Live scoreboard** via Monad `monadLogs` (measured ~0.6–1 s from tx to screen).
- **`finalize`** ranks on-chain and pays 🥇50% · 🥈25% · 🥉15% to the keepers; the rest goes to conservation, same tx. If the host is a registered organizer, "Juara 1/2/3" titles are **attested on-chain** automatically.
- `cancelContest` refunds every entry; failed payouts never block (`withdrawOwed`); hosts can `revokeAttestation`.
- **Shareable result page** `/lomba/<id>` with an OG image rendered from chain data.

### 🪪 Pedigree & value
- **Register a real bird**: photo → **AI species ID** (Claude Haiku, escalating to Sonnet when unsure; flags protected species; 5/5 correct on our test photos) → redrawn as a pixel sprite from a 21-byte palette. Name is free text. Certificates, lineage and wins are optional, following the Indonesian pedigree model in [docs/PEDIGREE.md](docs/PEDIGREE.md). Registration fee 0.005 MON (30% conservation).
- **Verified vs self-declared**: organizers `attest` titles; a certificate is verified when an organizer attests `CERT:<type>:<number>`, and the uploaded document is pinned by a SHA-256 fingerprint. Self-declared data is labelled.
- **Kicau Value** (`valueOf` / `valueBreakdown`): points from podiums, attestations, supporters, sponsorship and verified runs; decays 5%/day after 7 days without `updateBird` (floor 30%). Value history chart rebuilt from events with the same formula; shown in MON + USD (Chainlink).
- **Owner dashboard**, **sponsor a bird** (`supportBird`: 70% keeper / 30% conservation, minimum 10% of value), **adopt species NFTs** (`buy`: 30% conservation) and **support** (`support`: 100% conservation).
- **x402 certificate**: `/api/certificate/<id>` returns HTTP 402; pay $0.01 USDC (Monad facilitator, gasless for the payer) → printable certificate with a QR to the live record.

### 🎮 Play
- **Verified Flappy runs**: `startRun` seeds pipes from `prevrandao`; `submitRun` rejects scores impossible for the elapsed time (anti-cheat v1). Gantangan-cage obstacles.
- **Daily · Weekly · All-time leaderboards** (verified runs only) + **weekly prize pool**: anyone can `fundRewards`, the week's leader calls `claimWeeklyReward` after the week ends (Monday 00:00 UTC), empty weeks `rolloverWeeklyPool`.
- **Kicau Garden** (`/taman`): top-down pixel open world (Kenney CC0) with your birds, community birds and other players' NFTs; the home page also has a garden scene with every bird.
- 8-bit gamelan music (WebAudio), English pixel UI, mobile-friendly.

### ⚡ Monad tech
- **`monadLogs`** (speculative, Proposed state): LIVE KICAU feed and contest scoreboard show each tx Proposed → Voted → Finalized.
- **`eth_sendRawTransactionSync`**: ⚡ Quick Play burner signs in-browser; one RPC call returns the receipt (measured ~0.5–1 s). No popups.
- **Parallel-friendly storage**: hot paths write per-player / per-token / per-(contest, bird, judge) slots.
- **Pedigree in event logs** (palette + JSON), read from one block via `registeredAt`: no database, no indexer.
- Chainlink MON/USD (mainnet feed), Monad x402 facilitator, devnads faucet + verification API, MONSKILLS.
- **Public JSON API** (CORS open, live from the contract): `GET /api/contest/<id>`, `GET /api/bird/<id>`, `/metadata/<id>`.

## Structure

```
contracts/  Foundry: src/Kicau.sol, test/Kicau.t.sol (57 tests), script/Deploy.s.sol
web/        Next.js 15 · wagmi · viem · Tailwind v4
  src/app/        /  /lomba  /lomba/[id]  /taman  /pitch · api/{faucet,identify,certificate/[tokenId],contest/[id],bird/[id]} · metadata/[id]
  src/components/ game, lomba, taman, home, RegisterBird, RegisteredBirds, OwnerDashboard, Leaderboards, LiveFeed …
  src/lib/        useKicau, burner, live + contestLive (monadLogs), birdHistory, pixelate, price, x402, music …
docs/       JUDGING · INTEGRATIONS · PEDIGREE · BRIEF
```

## Run it

Prerequisites: Node 22+, [Foundry](https://getfoundry.sh). No wallet needed: ⚡ Quick Play creates a burner and funds it from the testnet faucet. MetaMask/Rabby also work.

```bash
# contract
cd contracts
forge install --no-git foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.4.0   # if lib/ is empty
forge test                                   # 57 tests incl. fuzz + reentrancy
cast wallet import deployer --interactive    # encrypted keystore, no key in files
BASE_URI=https://<host>/metadata/ forge script script/Deploy.s.sol --rpc-url monad_testnet --account deployer --broadcast
# optional env: TREASURY, CONSERVATION (default: deployer)

# frontend
cd ../web
npm install
cat > .env.local <<EOF
NEXT_PUBLIC_KICAU_ADDRESS=0x947929841Ba8154BB6E9BDeb35137d159c6A0F58
NEXT_PUBLIC_KICAU_DEPLOY_BLOCK=73741359
# optional: AI species ID (on Vercel it falls back to AI Gateway via OIDC)
ANTHROPIC_API_KEY=
EOF
npm run dev                                  # http://localhost:3000
```

After changing the contract: `forge build` then `cd web && npm run abi`.

## Contract API

| Area | Functions |
|---|---|
| Contests | `createContest` · `enter` · `startJudging` · `score(contestId, tokenId, melody, volume, duration, style)` · `finalize` · `cancelContest` · `withdrawOwed` · `getContest` · `entriesOf` · `judgeScoreOf` · `contestCount` · `winsOf` |
| Registered birds | `registerBird(name, bytes)` · `updateBird(tokenId, bytes)` · `supportBird(tokenId)` · `valueOf` · `valueBreakdown` |
| Attestations | `setOrganizer` (owner) · `attest(tokenId, title)` · `revokeAttestation` · `attestationsOf` |
| Species NFTs | `buy(speciesId)` · `support(speciesId)` · `getAllSpecies` · `tokensOf` |
| Runs & leaderboards | `startRun(tokenId)` · `submitRun(runId, score)` · `getLeaderboardV2` · `getDailyLeaderboard(day)` · `getWeeklyLeaderboard(week)` · `currentDay` · `currentWeek` |
| Weekly prize pool | `fundRewards(week)` · `claimWeeklyReward(week)` · `rolloverWeeklyPool(week)` · `weeklyPool` |
| Transparency | `totalConservation()` · events for every action · owner: `setConservationWallet`, `setTreasury`, `setRegisterFee` |

## Honest notes

- The conservation wallet is currently the team deployer wallet; it will be pointed to a conservation partner via `setConservationWallet`.
- Self-declared pedigree data is labelled; only organizer attestations count as verified.
- Anti-cheat v1 is an on-chain time bound; full replay verification of seeded runs is roadmap.
- The app runs on testnet (Quick Play needs the faucet). The same contract is deployed and verified on mainnet.
- IUCN statuses are for education; verify at iucnredlist.org. Kicau records collectibles and contest results; it never supports trading wild-caught birds.

## License

MIT

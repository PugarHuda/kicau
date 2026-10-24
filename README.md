# Kicau

**Keep the song, not the cage.** On-chain songbird contests (*gantangan*) with transparent judging, instant prizes and verifiable champions — plus a pixel game and open world where your bird NFT lives. GameFi + ReFi with a real-world provenance layer, built on Monad.

Built at **Monad Blitz Jogja 2026**. Brief and mechanics: [docs/BRIEF.md](docs/BRIEF.md) · Judging rubric mapping: [docs/JUDGING.md](docs/JUDGING.md) · Monad integrations: [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).

| | |
|---|---|
| **Live app** | **https://kicau.xyz** (custom domain) · https://kicau-theta.vercel.app · https://kicau-monad.vercel.app |
| Pages | [Home](https://kicau.xyz) · [Contests](https://kicau.xyz/lomba) · [Kicau Garden](https://kicau.xyz/taman) · [Pitch deck](https://kicau.xyz/pitch) |
| **Testnet** (chain 10143, used by the app) | [`0x947929841Ba8154BB6E9BDeb35137d159c6A0F58`](https://testnet.monadvision.com/address/0x947929841Ba8154BB6E9BDeb35137d159c6A0F58) — verified on MonadVision + Monadscan · deploy tx [`0x2d3980a3…5efb69d`](https://testnet.monadvision.com/tx/0x2d3980a35125711b90e1d3b6972c8991ce6bb22fc21d89975d4dae1a15efb69d) |
| **Mainnet** (chain 143) | [`0xA98CeE28C6EB35b6Ee7440b7490e265f23975d61`](https://monadvision.com/address/0xA98CeE28C6EB35b6Ee7440b7490e265f23975d61) — verified on MonadVision + Monadscan · deploy tx [`0x34c0b085…a3bb01`](https://monadvision.com/tx/0x34c0b0859000f0a8c99e04d1b5f705626951714bb81faef3d37640c4c2a3bb01) |
| Build in public | [X thread](https://x.com/BangDropID/status/2113853488170156259) · [update](https://x.com/BangDropID/status/2113869717429789043) |

## The problem

*Kicau mania* is a nationwide Indonesian hobby with weekly songbird contests (*gantangan*). Judging is on paper, results are disputed, champion titles and pedigrees are unverifiable — and demand for champion singers fuels poaching (Straw-headed bulbul and Bali myna are Critically Endangered).

## What Kicau does

1. **🏆 On-chain contests (`/lomba`).** Anyone can host a contest (class, entry fee, 1–5 judges, deadline). Owners enter their registered birds; the fee goes into the prize pool. Judges score each bird on four aspects — melody, volume, duration, style (0–10) — **one tx per score**, and a **live scoreboard updates in ~0.6 s** via Monad's `monadLogs` subscription. `finalize` ranks on-chain and pays 🥇50% · 🥈25% · 🥉15% to the winners' keepers and 10% to conservation in the same tx; if the host is a verified organizer, "Juara 1/2/3" titles are **attested on-chain** to the winning birds. Cancel refunds everyone; failed payouts never block (a "Claim" banner on `/lomba` calls `withdrawOwed`). The host can revoke an attested title from the results podium (`revokeAttestation`). Every contest has a **shareable result page** `/lomba/<id>` with a live OG image (X / WhatsApp preview) rendered from chain data.
2. **🪪 Register your real bird (tokenized provenance).** Upload a photo → **AI species identification** (Claude Haiku, escalating to Sonnet when unsure; flags species protected in Indonesia) → colours extracted and redrawn in Kicau's pixel style → `registerBird` mints an ERC-721 record with owner, titles, certificate/ring number, lineage and story. The sprite palette + profile live in the event log (21-byte palette + JSON), not storage.
3. **🏅 Verified titles.** Registered contest organizers `attest` championship titles; the UI separates "verified by <organizer>" from self-declared claims.
4. **💚 Sponsor a bird + dynamic Kicau Value.** `supportBird(tokenId)` sends 70% to the bird's current keeper (NFT holder) and 30% to conservation, same tx. Each registered bird has an on-chain **Kicau Value** (`valueOf`/`valueBreakdown`): points rise with contest podiums, organizer-attested titles, supporters and verified runs, and **decay if the owner stops updating the bird** (`updateBird` publishes a new photo/profile version). Minimum sponsorship = 10% of the value.
5. **🐦 Adopt species NFTs.** Five Indonesian songbirds (Kenari → Jalak Bali) with real singing videos, IUCN status and game stats. `buy()` splits 30% to conservation in the same tx; `support()` sends 100%.
6. **🎮 Verified Flappy runs.** `startRun` derives a seed from `prevrandao` → pipes are generated deterministically from it → `submitRun` is rejected on-chain if the score is physically impossible for the elapsed time (anti-cheat v1). Leaderboard v2 marks verified runs. **Daily · Weekly · All-time leaderboards** count only verified runs; the **weekly top scorer claims the on-chain prize pool** (`fundRewards` by anyone, `claimWeeklyReward` after the week ends Monday 00:00 UTC, empty weeks roll over).
7. **🌳 Kicau Garden (`/taman`).** A top-down pixel open world (Kenney CC0 tiles): walk your bird NFT, meet shelter birds, community birds and other players' NFTs; adopt/support straight from the card.
8. **💳 x402 pedigree certificate.** `/api/certificate/<id>` returns HTTP 402; paying $0.01 USDC (settled by Monad's x402 facilitator, gasless for the payer) returns a printable certificate.
9. **🔌 Public read-only API.** `GET /api/contest/<id>` (contest + ranked scoreboard + prizes) and `GET /api/bird/<id>` (current keeper, contest wins, organizer-attested titles, Kicau Value, self-declared profile kept separate) — CORS open, read live from the contract, for organizers and other apps. The x402 certificate carries a QR code to the bird's live record.
10. **📈 Chainlink MON/USD**, **🎵 8-bit gamelan chiptune** (WebAudio, no assets), English pixel-art UI, mobile-friendly.

## Why Monad

- **`monadLogs` (speculative, Proposed state):** live contest scoreboard and LIVE KICAU feed show each tx Proposed → Voted → Finalized in **~540–600 ms** (~2× faster than `eth_subscribe logs`).
- **`eth_sendRawTransactionSync`:** ⚡ Quick Play burner signs in-browser; one RPC call returns the receipt (~0.6–0.9 s) — judges' scores and game runs feel like Web2.
- **Parallel-execution-friendly storage:** per-player / per-token / per-(contest, entry, judge) slots, no contended global counters.
- **Cheap blockspace:** one tx per judge score, per game run, per support — micro-actions are viable.
- Tooling: MONSKILLS, devnads faucet API, devnads multi-explorer verification API, Monad x402 facilitator, viem `monadTestnet`.

## Structure

```
contracts/  Foundry — src/Kicau.sol (ERC-721 Enumerable + species, register, attest, runs, contests, support), test/Kicau.t.sol, script/Deploy.s.sol
web/        Next.js 15 · wagmi v3 · viem · Tailwind v4
  src/app/            /  /lomba  /lomba/[id] (share page + OG image)  /taman  /pitch  · api/faucet · api/identify · api/certificate/[tokenId] · api/contest/[id] · api/bird/[id] · metadata/[id]
  src/components/     game (Flappy), lomba (contests), taman (open world), RegisterBird, RegisteredBirds, LiveFeed …
  src/lib/            useKicau (burner/wallet/send), live + contestLive (monadLogs), pixelate (palette encoding), music, chirp …
docs/       BRIEF.md · JUDGING.md · INTEGRATIONS.md
```

## Running

**Prerequisites:** Node 22+ and [Foundry](https://getfoundry.sh). No wallet needed thanks to ⚡ Quick Play (burner auto-funded from the testnet faucet); MetaMask/Rabby also work.

### 1. Contract

```bash
cd contracts
forge install --no-git foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.4.0   # if lib/ is empty
forge test                      # 57 tests incl. fuzz + reentrancy

cast wallet import deployer --interactive   # key stored encrypted, never in a file
BASE_URI=https://<host>/metadata/ forge script script/Deploy.s.sol --rpc-url monad_testnet --account deployer --broadcast
# optional env: TREASURY, CONSERVATION (default: deployer)
cast send <KICAU> "setOrganizer(address,string,bool)" <you> "My Contest Org" true --account deployer --rpc-url monad_testnet
```

### 2. Frontend

```bash
cd web
npm install
cat > .env.local <<EOF
NEXT_PUBLIC_KICAU_ADDRESS=0x947929841Ba8154BB6E9BDeb35137d159c6A0F58
# optional — AI species identification (else Vercel AI Gateway via OIDC on Vercel)
ANTHROPIC_API_KEY=
EOF
npm run dev        # http://localhost:3000
```

After changing the contract: `cd contracts && forge build`, then `cd web && npm run abi`.

## Contract at a glance

| Area | Functions |
|---|---|
| Species NFTs | `buy(speciesId)` · `support(speciesId)` · `getAllSpecies()` · `tokensOf(owner)` |
| Registered birds | `registerBird(name, bytes)` · `updateBird(tokenId, bytes)` · `supportBird(tokenId)` · `valueOf` / `valueBreakdown` · `winsOf` |
| Attestations | `setOrganizer` (owner) · `attest(tokenId, title)` · `revokeAttestation` · `attestationsOf` |
| Game runs | `startRun(tokenId)` · `submitRun(runId, score)` · `getLeaderboardV2()` · `getDailyLeaderboard` / `getWeeklyLeaderboard` · `fundRewards` · `claimWeeklyReward` · `rolloverWeeklyPool` |
| Contests | `createContest` · `enter` · `startJudging` · `score(contestId, tokenId, melody, volume, duration, style)` · `finalize` · `cancelContest` · `withdrawOwed` · `getContest` · `entriesOf` |
| Transparency | `totalConservation()` · events for every action |

## Honest notes

- The conservation wallet is currently the team's deployer wallet; it will point to a conservation partner via `setConservationWallet`.
- Self-declared pedigree data is labelled as such; only organizer attestations are "verified".
- Anti-cheat v1 is a time bound on-chain; full replay verification of the seeded run is roadmap.
- IUCN statuses are shown for education — verify at iucnredlist.org. Kicau records digital collectibles and provenance; it never supports trading wild-caught birds.

## License

MIT

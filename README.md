# Kicau

**Keep the song, not the cage.** GameFi + ReFi with a real-world provenance layer — on-chain pedigree and organizer-attested championship records for real songbirds. Adopt Indonesian songbirds as NFTs, fly them in a Flappy-style pixel game, and every adoption funds bird conservation. All on-chain on Monad.

Built at **Monad Blitz Jogja 2026**. Brief and mechanics: [docs/BRIEF.md](docs/BRIEF.md) · Judging rubric mapping: [docs/JUDGING.md](docs/JUDGING.md).

| | |
|---|---|
| Network | **Monad Testnet** (chain 10143) |
| Contract | [`0x7b0A5E9D4A8b1bf2829478e72f62283C6939C816`](https://testnet.monadvision.com/address/0x7b0A5E9D4A8b1bf2829478e72f62283C6939C816) (verified on MonadVision + Monadscan) |
| Live app | **https://kicau-theta.vercel.app** (also https://kicau-monad.vercel.app) · [Kicau Garden](https://kicau-theta.vercel.app/taman) · [Pitch deck](https://kicau-theta.vercel.app/pitch) |
| **Mainnet** (chain 143) | [`0x269f6d0E6CB20387Bb4494cf447218eE1f03C09b`](https://monadvision.com/address/0x269f6d0E6CB20387Bb4494cf447218eE1f03C09b) (verified on MonadVision + Monadscan) · deploy tx [`0xa1c9fbfe…b47055`](https://monadvision.com/tx/0xa1c9fbfee7276e3f49af15f581db1da95b761700e158737f0c20631374b47055) |
| Deploy tx | [`0xbc190b63…4a794`](https://testnet.monadvision.com/tx/0xbc190b63991354d67859ec17f26601755e00a66e59c2404f7af76a62be44a794) |

## What it does

1. **Shelter.** Five songbird species (Kenari → Jalak Bali). Tap one to open its card: illustration, song, description, IUCN status, and game stats.
2. **Adopt (mint NFT).** `buy(speciesId)` mints an ERC-721 and splits the payment in the same tx: 30% to the conservation fund, 70% to the treasury. The contract never holds a balance.
3. **Play.** A Flappy game on HTML5 Canvas. Its physics follow the species stats stored on-chain (gravity, flap power, hitbox).
4. **On-chain scores.** `submitScore()` is sent via `eth_sendRawTransactionSync` (wagmi `useWriteContractSync`), so the receipt comes straight back and the leaderboard updates instantly.
5. **⚡ Quick Play.** No MetaMask needed: the browser creates a local burner wallet, funds it automatically from the testnet faucet (`/api/faucet` → devnads agent faucet), then signs every tx in-browser and sends it with `eth_sendRawTransactionSync`. No popups, and the receipt returns in a single call. Confirmation time is shown in the UI.
6. **Transparency.** Total conservation funds are read directly from the contract (`totalConservation()`).

## Why Monad

- 600 ms finality + `eth_sendRawTransactionSync`: submitting a score after every game feels like a normal game.
- Per-player / per-token storage with no contended global counter, so it plays well with parallel execution.
- Cheap gas makes micro-actions (one score per game) sensible.
- Quick Play uses a local account, so it genuinely uses `eth_sendRawTransactionSync`. Wallet extensions (MetaMask) are still supported, via `eth_sendTransaction` + receipt polling.

## Structure

```
contracts/   Foundry: src/Kicau.sol, test/Kicau.t.sol, script/Deploy.s.sol
web/         Next.js 15 + wagmi v3 + viem + Tailwind v4 (frontend, game, metadata route)
docs/        BRIEF.md (concept, mechanics, game interface for Unity)
unity/       Unity WebGL integration kit (optional)
```

## Running

**Prerequisites:** Node 20+ and [Foundry](https://getfoundry.sh). A browser wallet (MetaMask/Rabby) with testnet MON from [faucet.monad.xyz](https://faucet.monad.xyz).

### 1. Contract

```bash
cd contracts
forge install --no-git foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.4.0   # if lib/ is empty
forge test

# deploy: key stored encrypted, never in a file
cast wallet import deployer --interactive
forge script script/Deploy.s.sol --rpc-url monad_testnet --account deployer --broadcast
# optional env: TREASURY, CONSERVATION (default: deployer), BASE_URI (https://<host>/metadata/)
```

### 2. Frontend

```bash
cd web
npm install
echo NEXT_PUBLIC_KICAU_ADDRESS=0xYourContractAddress > .env.local
npm run dev        # http://localhost:3000
```

After changing the contract: `cd contracts && forge build`, then `cd web && npm run abi`.

### 3. NFT metadata

`tokenURI` = `<baseURI><speciesId>.json`, served by the `web/src/app/metadata/[id]` route. Once the web app is live, call:

```bash
cast send <KICAU> "setBaseURI(string)" "https://<host>/metadata/" --account deployer --rpc-url monad_testnet
```

## Contract at a glance

| Function | Description |
|---|---|
| `buy(speciesId)` payable | Pay exactly `price`, mint the NFT, split to conservation + treasury |
| `submitScore(tokenId, score, gameVersion)` | Token owner only. Stores best per token & per player |
| `getAllSpecies()` | Name, price, supply, game stats |
| `tokensOf(owner)` / `getLeaderboard()` | Read by the frontend without an indexer |
| `totalConservation()` | Total wei sent to the conservation fund so far |

## Known limitations

- Scores are submitted from the client. Roadmap: server-signed replays, or seed+input verification.
- Bird songs are still synthesized (WebAudio). Roadmap: xeno-canto recordings (CC, with attribution).
- IUCN status is shown for education. Please verify at iucnredlist.org.

## License

MIT

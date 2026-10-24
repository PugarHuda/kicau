# Kicau

**Pelihara kicaunya, bukan sangkarnya.** Adopsi burung kicau Nusantara sebagai NFT, terbangkan di game Flappy, dan setiap adopsi langsung mendanai konservasi burung. Semuanya on-chain di Monad.

Built at **Monad Blitz Jogja 2026**. Brief lengkap dan mekanisme: [docs/BRIEF.md](docs/BRIEF.md).

| | |
|---|---|
| Live app | _TBA_ |
| Contract (Monad Testnet, chain 10143) | _TBA_ |
| Explorer | _TBA_ |

## Apa yang dilakukan

1. **Shelter.** Lima spesies burung kicau (Kenari → Jalak Bali). Klik untuk melihat card: ilustrasi, suara kicau, deskripsi, status IUCN, dan stats game.
2. **Adopsi (mint NFT).** `buy(speciesId)` mint ERC-721 dan langsung membagi pembayaran di tx yang sama: 30% ke dana konservasi, 70% ke treasury. Kontrak tidak pernah menahan saldo.
3. **Main.** Game Flappy di HTML5 Canvas. Fisikanya mengikuti stats spesies yang tersimpan on-chain (gravitasi, kepakan, hitbox).
4. **Skor on-chain.** `submitScore()` dikirim lewat `eth_sendRawTransactionSync` (wagmi `useWriteContractSync`), jadi receipt langsung kembali dan leaderboard ter-update instan.
5. **Transparansi.** Total dana konservasi dibaca langsung dari kontrak (`totalConservation()`).

## Kenapa Monad

- Finality 600 ms + `eth_sendRawTransactionSync`: submit skor tiap game terasa seperti game biasa.
- Storage per pemain / per token, tanpa counter global yang diperebutkan, sehingga ramah parallel execution.
- Gas murah, sehingga micro-action (skor per game) masuk akal.

## Struktur

```
contracts/   Foundry: src/Kicau.sol, test/Kicau.t.sol, script/Deploy.s.sol
web/         Next.js 15 + wagmi v3 + viem + Tailwind v4 (frontend, game, metadata route)
docs/        BRIEF.md (konsep, mekanisme, game interface untuk Unity)
unity/       Kit integrasi Unity WebGL (opsional)
```

## Menjalankan

**Prasyarat:** Node 20+ dan [Foundry](https://getfoundry.sh). Wallet browser (MetaMask/Rabby) dengan MON testnet dari [faucet.monad.xyz](https://faucet.monad.xyz).

### 1. Kontrak

```bash
cd contracts
forge install --no-git foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.4.0   # jika lib/ kosong
forge test

# deploy: key disimpan terenkripsi, tidak pernah di file
cast wallet import deployer --interactive
forge script script/Deploy.s.sol --rpc-url monad_testnet --account deployer --broadcast
# opsional env: TREASURY, CONSERVATION (default: deployer), BASE_URI (https://<host>/metadata/)
```

### 2. Frontend

```bash
cd web
npm install
echo NEXT_PUBLIC_KICAU_ADDRESS=0xAlamatKontrak > .env.local
npm run dev        # http://localhost:3000
```

Setelah kontrak diubah: `cd contracts && forge build`, lalu `cd web && npm run abi`.

### 3. Metadata NFT

`tokenURI` = `<baseURI><speciesId>.json`, dilayani oleh route `web/src/app/metadata/[id]`. Setelah web live, panggil:

```bash
cast send <KICAU> "setBaseURI(string)" "https://<host>/metadata/" --account deployer --rpc-url monad_testnet
```

## Kontrak: ringkas

| Fungsi | Keterangan |
|---|---|
| `buy(speciesId)` payable | Bayar persis `price`, mint NFT, split ke konservasi + treasury |
| `submitScore(tokenId, score, gameVersion)` | Hanya pemilik token. Menyimpan best per token & per pemain |
| `getAllSpecies()` | Nama, harga, supply, stats game |
| `tokensOf(owner)` / `getLeaderboard()` | Dibaca frontend tanpa indexer |
| `totalConservation()` | Total wei yang sudah dikirim ke dana konservasi |

## Batasan yang diakui

- Skor dikirim dari client. Roadmap: replay yang ditandatangani server, atau verifikasi seed+input.
- Suara kicau masih disintesis (WebAudio). Roadmap: rekaman xeno-canto (CC, dengan atribusi).
- Status IUCN ditampilkan untuk edukasi. Silakan verifikasi di iucnredlist.org.

## Lisensi

MIT

# Kicau — Project Brief

> Monad Blitz Jogja · 24 Oktober 2026 · Submission freeze **16:45**.

## 1. Satu kalimat

**Koleksi burung kicau Nusantara sebagai NFT, mainkan di game Flappy, dan setiap pembelian ikut mendanai konservasi burung, semuanya transparan on-chain di Monad.**

## 2. Latar belakang

- **Kicau mania** adalah hobi massal di Indonesia: lomba gantangan berjalan tiap minggu dan komunitasnya besar. Tapi hobi ini juga mendorong perburuan liar. Beberapa spesies populer (Cucak Rawa, Jalak Bali) sudah berstatus kritis.
- **Token Tails** (tokentails.com) membuktikan model *play-to-save*: game kucing yang hasilnya dialirkan ke shelter. Namun di sana hanya **payout** yang on-chain. Gameplay, skor, dan leaderboard tetap di server.
- **Celah yang kita isi:** konsep play-to-save versi lokal, di mana *kepemilikan, stats, skor, dan pembagian dana* semuanya on-chain. Ini praktis hanya di chain dengan finality 600 ms dan biaya murah seperti Monad.

**Positioning:** *"Pelihara burung kicau versi digital, bukan beli burung asli dari alam."*

## 3. User flow

```
[Shelter]  grid burung (gambar + nama + harga)
    │ klik
    ▼
[Bird Card]  gambar · ▶ suara kicau · deskripsi · status IUCN · stats game
    │ Buy (1 tx)
    ▼
[Mint NFT]  dana di-split otomatis: treasury + dana konservasi
    │
    ▼
[My Birds]  koleksi milik wallet
    │ Play
    ▼
[Flappy Game]  fisika mengikuti stats spesies
    │ game over
    ▼
[Submit Score] (1 tx, receipt instan) ──► [Leaderboard live]
```

## 4. Fitur MVP (wajib selesai)

| # | Fitur | Keterangan |
|---|---|---|
| 1 | Shelter | Grid 5 spesies, data dibaca dari kontrak |
| 2 | Bird Card | Gambar, audio kicau, deskripsi, status IUCN, stats |
| 3 | Buy / Mint | ERC-721, `buy(speciesId)` payable, split 70/30 |
| 4 | My Birds | Daftar NFT milik wallet yang terhubung |
| 5 | Flappy Game | Canvas HTML5, stats spesies memengaruhi fisika |
| 6 | Submit Score | `submitScore()` on-chain, best score per pemain |
| 7 | Leaderboard | Dibaca dari event `ScoreSubmitted` |
| 8 | Conservation counter | Total dana konservasi terkumpul, langsung dari kontrak |

**Nice to have:** suara kicau setiap lolos pipa, turnamen mingguan dengan entry fee.
**Di luar scope hari ini:** breeding, marketplace, anti-cheat skor, setiap kepakan jadi tx.

## 5. Data spesies (draft)

Stats bersifat relatif: `100` = normal. Status IUCN **wajib diverifikasi ulang** di iucnredlist.org sebelum demo.

| id | Nama | Latin | IUCN (verifikasi) | gravity | flapPower | hitbox | Ciri game |
|---|---|---|---|---|---|---|---|
| 0 | Kenari | *Serinus canaria* | LC | 100 | 100 | 80 | Kecil dan lincah, starter |
| 1 | Lovebird | *Agapornis fischeri* | NT | 85 | 90 | 100 | Jatuh lebih pelan |
| 2 | Murai Batu | *Copsychus malabaricus* | LC* | 110 | 125 | 100 | Kepakan kuat |
| 3 | Cucak Rawa | *Pycnonotus zeylanicus* | CR | 100 | 110 | 110 | Langka, harga tinggi |
| 4 | Jalak Bali | *Leucopsar rothschildi* | CR | 90 | 110 | 95 | Paling langka, supply terbatas |

\* Global LC, tapi populasi di Indonesia tertekan perdagangan.

**Aset:**
- Suara dari **xeno-canto.org**. Cek lisensi CC per rekaman dan tulis atribusinya di README.
- Gambar berupa ilustrasi atau pixel art buatan sendiri atau AI. Jangan pakai foto berhak cipta.

## 6. Smart contract: `Kicau.sol`

Satu kontrak, deploy di Monad Testnet (chain 10143). Mainnet opsional untuk bonus +25.

```
Species { name, price, maxSupply, minted, gravity, flapPower, hitbox }

buy(speciesId) payable          → mint NFT, split pembayaran, emit BirdBought
submitScore(tokenId, score, gameVersion)
                                → wajib pemilik token, simpan best, emit ScoreSubmitted
speciesOf(tokenId) view         → speciesId
getSpecies(id) view             → data + stats
totalConservation() view        → total wei yang sudah dikirim ke dana konservasi

Owner: addSpecies, setConservationWallet, setSplitBps
```

**Prinsip desain:**
- **Pass-through split.** Dana langsung diteruskan ke treasury dan wallet konservasi di tx yang sama, sehingga kontrak tidak menahan saldo. Polanya meniru ShelterSplit (MIT).
- **Storage per pemain / per token.** Tidak ada counter global yang diperebutkan, jadi ramah parallel execution Monad.
- **Leaderboard tanpa sorting on-chain.** Kontrak hanya menyimpan `bestScore[player]` dan mengeluarkan event. Sorting dilakukan di frontend.
- **Gas:** Monad menagih berdasarkan `gas_limit`, bukan gas yang terpakai, jadi set gas limit secukupnya.

## 7. Game interface: kontrak antara web dan game

Web (React) memegang **wallet dan semua tx**. Game hanya menerima data dan mengembalikan skor. Dengan begitu game Canvas hari ini bisa diganti Unity nanti tanpa mengubah halaman web.

```ts
// web → game
type GameStart = {
  tokenId: number;
  species: number;                 // speciesId
  stats: { gravity: number; flapPower: number; hitbox: number }; // 100 = normal
  gameVersion: number;             // 1 = canvas, 2 = unity
};

// game → web
type GameOver = { tokenId: number; score: number; durationMs: number };
```

**Aturan bersama (berlaku untuk Canvas dan Unity):**
- 1 pipa dilewati = 1 poin.
- Stats dikonversi ke fisika masing-masing engine. Angka kontrak tetap relatif.
- Game memakai delta time, supaya kecepatan sama di 60 Hz dan 120 Hz.

**Integrasi Unity (tim Unity):**
- Web → Unity: `unityInstance.SendMessage("GameManager", "StartGame", JSON.stringify(gameStart))`
- Unity → Web: plugin `.jslib` → `window.dispatchEvent(new CustomEvent("kicau:gameover", { detail: gameOver }))`
- Embed di React lewat `react-unity-webgl`.
- Build WebGL: **compression disabled** atau decompression fallback ON, supaya tidak macet loading di Vercel.
- Unity **tidak boleh** memegang private key atau mengirim tx sendiri.

## 8. Tech stack

| Layer | Pilihan |
|---|---|
| Kontrak | Solidity 0.8.x, Foundry (OpenZeppelin ERC-721) |
| Frontend | Next.js (App Router), viem + wagmi |
| Game | HTML5 Canvas (v1), Unity WebGL (v2, opsional) |
| Tx UX | `eth_sendRawTransactionSync`, receipt instan |
| Hosting | Vercel + custom domain (bonus +15) |
| Explorer | testnet.monadexplorer.com (verifikasi source) |

Tanpa backend. Semua state ada di kontrak, aset statis di `public/`.

## 9. Pemetaan ke rubrik penilaian (400 poin)

| Rubrik | Poin | Cara memenuhinya |
|---|---|---|
| Repo publik + README + alamat kontrak | 50 | README berisi alamat, live URL, cara run |
| Deploy testnet + hosted | 50 | Foundry deploy + Vercel |
| Semua fitur jalan | 25 | Scope MVP dikunci di tabel §4 |
| Tx live saat demo | 25 | Buy + submit score di atas panggung |
| Kontrak verified | 25 | `forge verify-contract` |
| Bisa di-run dari README | 25 | `npm i && npm run dev`, tanpa backend |
| Post X/LinkedIn + video demo ≥30 detik + video iklan | 75 | Tag @monad @monad_dev @geeky_kartikey |
| 5K+ views | 25 | Sebar ke komunitas kicau mania dan Web3 Jogja |
| Mainnet | 25 | Jika panitia mengizinkan |
| Custom domain | 15 | Domain murah diarahkan ke Vercel |
| PMF / revenue / inovasi | 60 | Lihat §10 |

## 10. Narasi pitch (3 menit)

1. **Hook (20 detik):** "Kicau mania itu hobi jutaan orang Indonesia, dan Cucak Rawa sekarang hampir punah di alam."
2. **Solusi (20 detik):** "Kicau: pelihara burungnya secara digital, mainkan, dan setiap pembelian mendanai konservasi."
3. **Demo live (2 menit):** buka card → putar suara → **beli (tx)** → main → **submit skor (tx, langsung muncul)** → tunjukkan counter dana konservasi dan tx di explorer.
4. **Kenapa Monad (10 detik):** receipt instan via `eth_sendRawTransactionSync`, dan tx skor tiap game hanya praktis di chain cepat dan murah.
5. **Bisnis + next (10 detik):**
   - Revenue: fee mint dan turnamen.
   - Next: versi Unity, turnamen ala gantangan, kemitraan dengan organisasi konservasi.

**Ucapkan keras-keras di panggung:** link repo, alamat kontrak, live URL.

## 11. Timeline hari ini

| Jam | Target | PIC |
|---|---|---|
| 10:30–11:30 | Kontrak + test Foundry → deploy testnet | Web |
| 11:30–13:30 | Shelter, Card, Mint, My Birds | Web |
| 13:30–14:30 | Canvas Flappy + submit score + leaderboard | Web |
| 10:30–15:30 | Unity WebGL mengikuti interface di §7 | Unity |
| 14:30–15:00 | Verify kontrak, README, domain | Web |
| 15:00–15:45 | Video demo + video iklan + posting sosial | Semua |
| 15:45–16:15 | Buffer bug, pre-fill wallet demo, swap ke Unity jika siap | Semua |
| **≤16:15** | **Submit di blitz.devnads.com** | — |

## 12. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Unity tidak siap | Demo memakai Canvas. Unity disebut di pitch sebagai roadmap |
| Faucet atau RPC lambat | Isi burner wallet di pagi hari, siapkan RPC cadangan |
| Skor bisa dipalsukan dari client | Diakui terbuka di pitch, roadmap: signature server / replay |
| Isu satwa dilindungi | Posisi "koleksi digital + dana konservasi", IUCN tampil di card |
| Lisensi aset | Suara CC dari xeno-canto dengan atribusi, gambar buatan sendiri |
| Keamanan key | Deploy dari keystore Foundry. Key tidak pernah masuk repo atau AI agent |

## 13. Mekanisme detail

### 13.1 Ekonomi: beli & split dana

| id | Spesies | Harga (testnet) | Max supply | Kelangkaan |
|---|---|---|---|---|
| 0 | Kenari | 0.01 MON | 100 | Common |
| 1 | Lovebird | 0.02 MON | 100 | Common |
| 2 | Murai Batu | 0.05 MON | 50 | Rare |
| 3 | Cucak Rawa | 0.1 MON | 20 | Epic |
| 4 | Jalak Bali | 0.2 MON | 10 | Legendary |

**Alur `buy(speciesId)`, semuanya dalam 1 tx:**
1. `require(msg.value == price)`: harus persis, tanpa logika refund.
2. `require(minted < maxSupply)`: kalau stok habis, tx revert dan tombol di UI menampilkan "Sold out".
3. Mint NFT `tokenId` berikutnya ke pembeli, dengan `speciesOf[tokenId] = speciesId`.
4. Hitung split: `conservation = price × 30%`, `treasury = sisanya` (sisa pembulatan masuk treasury).
5. Kirim ke dua wallet saat itu juga. Kalau salah satu gagal, seluruh tx revert dan tidak ada yang dibayar setengah.
6. `totalConservation += conservation`, lalu emit `BirdBought(buyer, tokenId, speciesId, conservation)`.

Satu wallet boleh memiliki banyak burung, dan NFT bisa ditransfer layaknya ERC-721 biasa.

### 13.2 Game: konversi stats ke fisika

Engine memakai konstanta dasar, lalu dikalikan stats spesies (`100` = 1.0×):

| Parameter | Nilai dasar | Dipengaruhi |
|---|---|---|
| Gravitasi | 1500 px/s² | × `gravity/100` |
| Kecepatan kepak (ke atas) | 450 px/s | × `flapPower/100` |
| Radius hitbox | 14 px | × `hitbox/100` |
| Kecepatan pipa | 180 px/s | +5% setiap 10 poin |
| Celah pipa | 150 px | Tetap |
| Jarak spawn pipa | 1.4 s | Tetap |

**Balancing:** setiap spesies punya *trade-off*, bukan sekadar lebih kuat. Burung langka harus terasa beda, tapi tidak boleh *pay-to-win*:
- **Kenari:** hitbox kecil (80), tapi kepakannya biasa.
- **Murai Batu:** kepakan kuat (125), tapi gravitasinya berat (110), jadi gampang overshoot.
- **Lovebird:** jatuh pelan (85), tapi kepakannya lemah (90).
- **Cucak Rawa:** kepak kuat (110), tapi hitbox paling besar (110).
- **Jalak Bali:** paling seimbang (90/110/95), jadi keunggulannya lebih ke status kelangkaan daripada power.

**Loop per frame:** `vy += g·dt` → `y += vy·dt` → gerakkan pipa → cek tabrakan lingkaran vs persegi → +1 poin setiap pipa terlewati → putar suara kicau.
**Game over** terjadi saat menabrak pipa, lantai, atau langit-langit. Game lalu memanggil `onGameOver({ tokenId, score, durationMs })`.

### 13.3 Skor & leaderboard

**`submitScore(tokenId, score, gameVersion)`:**
1. `require(ownerOf(tokenId) == msg.sender)`: hanya pemilik burung yang boleh submit.
2. `bestByToken[tokenId] = max(best lama, score)` dan `bestByPlayer[msg.sender] = max(...)`.
3. Emit `ScoreSubmitted(player, tokenId, speciesId, score, gameVersion)`, **selalu**, meski skornya bukan rekor. Dengan begitu riwayat main tetap tercatat.

**Leaderboard (frontend):**
- Baca semua event `ScoreSubmitted` dengan `getLogs` dari blok deploy.
- Ambil skor maksimum per pemain, urutkan, tampilkan top 10.
- Tab per spesies (filter berdasarkan `speciesId`) dan filter per `gameVersion` (Canvas vs Unity).
- Refresh setelah tx submit berhasil. Receipt instan dari `eth_sendRawTransactionSync` membuat papan langsung terupdate.

**Submit bersifat opsional:** pemain bisa langsung main lagi tanpa submit. Biaya gas kecil per submit sekaligus menjadi rem alami terhadap spam.

### 13.4 Dana konservasi (transparansi)

- `conservationWallet` diset owner. Untuk demo dipakai wallet tim yang diberi label jelas, lalu nantinya diganti ke wallet mitra konservasi.
- Halaman web menampilkan `totalConservation()` dan daftar event `BirdBought` beserta link ke explorer. Siapa pun bisa audit.
- Kontrak tidak pernah menahan saldo. Semua pembayaran diteruskan di tx yang sama.

### 13.5 Kenapa ini butuh Monad

| Mekanisme | Di chain lambat | Di Monad |
|---|---|---|
| Submit skor tiap game | Menunggu sekitar 12 detik, pemain malas submit | Receipt sekitar 0.6 detik, terasa seperti game biasa |
| Leaderboard live saat lomba | Tertunda beberapa blok | Update hampir real-time |
| Banyak pemain submit bersamaan | Antre di satu slot global | Storage per token/pemain dieksekusi paralel |
| Biaya mint dan submit | Mahal untuk micro-action | Murah |

### 13.6 Batasan yang diakui

- **Skor dikirim dari client**, jadi secara teori bisa dipalsukan. Roadmap: backend menandatangani hasil replay (seperti Token Tails), atau verifikasi seed + input on-chain.
- **Harga tetap per spesies.** Roadmap: harga dinamis atau lelang untuk spesies legendary.

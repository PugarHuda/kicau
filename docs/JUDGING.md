# Kicau — Rubrik Penilaian Monad Blitz Jogja (400 poin)

Peta setiap butir rubrik ke bukti nyata. Status per 24 Okt 2026, ~14:30 WIB.

**Positioning:** *The on-chain record for real-life songbird contests.* Lomba gantangan dengan penjurian on-chain, scoreboard live, hadiah otomatis, dan gelar juara yang jadi silsilah terverifikasi untuk burung asli. Koleksi digital + catatan prestasi; **bukan** jual-beli hewan hidup.

**Link inti (ucapkan saat pitch):**
- Repo: https://github.com/PugarHuda/kicau
- Live: **https://kicau.xyz** · https://kicau-theta.vercel.app
- Testnet (chain 10143, dipakai app): `0x947929841Ba8154BB6E9BDeb35137d159c6A0F58` — [MonadVision](https://testnet.monadvision.com/address/0x947929841Ba8154BB6E9BDeb35137d159c6A0F58) · [Monadscan](https://testnet.monadscan.com/address/0x947929841Ba8154BB6E9BDeb35137d159c6A0F58)
- Mainnet (chain 143): `0xA98CeE28C6EB35b6Ee7440b7490e265f23975d61` — [MonadVision](https://monadvision.com/address/0xA98CeE28C6EB35b6Ee7440b7490e265f23975d61) · [Monadscan](https://monadscan.com/address/0xA98CeE28C6EB35b6Ee7440b7490e265f23975d61)

---

## 1. Basic — Prize eligibility (100)

| Butir | Poin | Bukti | Status |
|---|---|---|---|
| Public GitHub repo | 25 | `PugarHuda/kicau`, dibuat 24 Okt; monorepo `contracts/` + `web/` + `docs/` | ✅ |
| Proper README | 25 | [README.md](../README.md): deskripsi 1 kalimat, live URL, alamat testnet + mainnet, deploy tx, fitur, langkah run, tabel API kontrak, catatan jujur | ✅ |
| Kontrak di Monad Testnet | 25 | `0x9479…0F58`, deploy tx [`0x2d3980a3…5efb69d`](https://testnet.monadvision.com/tx/0x2d3980a35125711b90e1d3b6972c8991ce6bb22fc21d89975d4dae1a15efb69d) (blok 73741359), 24 Okt. Source final `contracts/src/Kicau.sol`, 60 test Foundry | ✅ |
| Project publicly hosted | 25 | Vercel, https://kicau.xyz + https://kicau-theta.vercel.app | ✅ |

## 2. Advance — Does it work (100)

| Butir | Poin | Bukti | Status |
|---|---|---|---|
| Semua fungsi yang diumumkan jalan | 25 | QA Playwright final terhadap kontrak testnet live, dengan tx asli: register burung (foto) → `createContest` → `enter` ×2 → `startJudging` → skor juri → `finalize` (tx [`0x60b2c83d…a07a5bd`](https://testnet.monadvision.com/tx/0x60b2c83de51483e165a4a413e8f87a67560ccc05fbdf0007b18314feda07a5bd)), `updateBird`, adopt, support, `supportBird` (preset minimum), `startRun`/`submitRun`, faucet Quick Play. Tiap tx 536–913 ms; scoreboard penonton ter-update 782–1012 ms setelah skor juri. 40/40 cek mobile (375/360 px) + keyboard lolos. Kegagalan saat QA = 429 rate limit RPC publik testnet & bug selector di skrip test, lolos saat diulang. x402: settlement nyata di [INTEGRATIONS.md](INTEGRATIONS.md) | ✅ |
| Live transaction on chain saat demo | 25 | Rencana: di panggung **`finalize` lomba #0** di `/lomba/0` → hadiah 50/25/15% + konservasi dibayar di tx yang sama, gelar "Juara" ter-attest, item muncul di LIVE KICAU (Proposed → Finalized). Cadangan: skor juri / ⚡ adopt | ✅ (siapkan wallet host terisi) |
| Kontrak verified di explorer | 25 | Testnet + mainnet: verified di MonadVision + Monadscan (API verifikasi devnads) | ✅ |
| Bisa di-run orang lain dari README | 25 | Tanpa database/indexer. `npm install` → `.env.local` (`NEXT_PUBLIC_KICAU_ADDRESS`, `NEXT_PUBLIC_KICAU_DEPLOY_BLOCK`, opsional `ANTHROPIC_API_KEY`) → `npm run dev`. Kontrak: `forge test` (60 test, termasuk fuzz + reentrancy) + script deploy dengan keystore | ✅ |

## 3. Advance — Did anyone see it / Build in public (100)

> Post & views dikunci saat submission ditutup (16:45).

| Butir | Poin | Bukti | Status |
|---|---|---|---|
| Post di X dengan tag @monad @monad_dev @geeky_kartikey | 25 | Thread @BangDropID: [post 1](https://x.com/BangDropID/status/2113853488170156259) · [reply (Monad + repo + kontrak)](https://x.com/BangDropID/status/2113853615941284205) · [update 2](https://x.com/BangDropID/status/2113869717429789043) · [update 3 (quote)](https://x.com/BangDropID/status/2113885785019798003) | ✅ |
| Video demo ≥30 detik | 25 | _(diisi setelah rekaman)_ | ⏳ |
| Video iklan kreatif | 25 | _(diisi setelah rekaman)_ | ⏳ |
| 5K+ views kolektif | 25 | Sebar ke grup kicau mania, Dev Web3 Jogja, Monad Developers Indonesia | ⏳ |

## 4. Bonus (100)

| Butir | Poin | Bukti / argumen | Status |
|---|---|---|---|
| Kontrak di Monad Mainnet | 25 | `0xA98CeE28C6EB35b6Ee7440b7490e265f23975d61`, deploy tx [`0x34c0b085…a3bb01`](https://monadvision.com/tx/0x34c0b0859000f0a8c99e04d1b5f705626951714bb81faef3d37640c4c2a3bb01), source sama, verified MonadVision + Monadscan, weekly pool diisi 0.5 MON, organizer "Kicau Demo Contest" terdaftar | ✅ |
| Custom domain | 15 | **https://kicau.xyz** (production domain Vercel + redirect www) | ✅ |
| Product-market fit | ≤20 | Lomba gantangan jalan tiap minggu di seluruh Indonesia, tapi skor di kertas, hasil sering diperdebatkan, gelar & silsilah tidak bisa dicek. Kicau memberi penyelenggara alat yang langsung bisa dipakai: penjurian per aspek on-chain, scoreboard live untuk penonton, hadiah otomatis, halaman hasil yang bisa di-share ke WhatsApp, dan gelar "Juara" yang menempel ke catatan burung. Pemilik mendapat silsilah terverifikasi (model sertifikat Indonesia, [PEDIGREE.md](PEDIGREE.md)) + Kicau Value yang naik dengan prestasi | argumen pitch |
| Revenue potential & strategy | ≤20 | **LIVE (on-chain, sesuai `Kicau.sol`):** fee registrasi burung 0.005 MON (70% treasury / 30% konservasi), adopsi spesies `buy()` (70% treasury / 30% konservasi), sertifikat x402 $0.01 USDC → treasury. **Ecosystem flows (bukan pendapatan):** entry fee lomba → 50/25/15 ke keeper pemenang + sisa ke konservasi; `supportBird` → 70% keeper / 30% konservasi; weekly prize pool via `fundRewards`. **PROPOSED (belum diimplementasi):** fee platform lomba, Verified Organizer (SaaS klub gantangan: hak attestation, halaman branded, app juri), fee verifikasi sertifikat, royalti resale ERC-2981, prize pool sponsor brand, data API / x402 per call, AI species ID per call, fee turnamen Flappy, featured listing breeder, kosmetik game. **Strategi:** 0–3 bln user + 1–2 klub pilot Jogja, harga rendah → 3–6 bln fee platform + Verified Organizer → 6–12 bln sponsor, data API, verifikasi sertifikat → 12+ bln royalti + turnamen. **Risiko:** harga MON (sebagian treasury ke stablecoin); fee B2B butuh partner nyata (tidak dihitung sebagai revenue awal); wallet konservasi pindah ke partner via `setConservationWallet` | argumen pitch (slide 6–7) |
| Innovation & originality | ≤20 | Lihat bagian 5 | argumen pitch |

## 5. Yang membuat Kicau "Monad-native"

1. **Scoreboard live & LIVE KICAU via `monadLogs`** (state *Proposed*, spekulatif): skor juri sampai ke layar penonton ~0,6–1 detik (terukur saat QA), tiap item berubah Proposed → Voted → Finalized.
2. **⚡ Quick Play + `eth_sendRawTransactionSync`:** burner di browser, receipt kembali dalam satu panggilan RPC (~0,5–1 detik terukur). Tanpa popup.
3. **Hadiah + gelar dalam satu tx:** `finalize` meranking on-chain, membayar 50/25/15% ke keeper, sisa ke konservasi, dan meng-attest "Juara 1/2/3" bila host adalah organizer. Pembayaran gagal tidak memblokir (`withdrawOwed`).
4. **Storage ramah parallel execution:** slot per pemain / per token / per (lomba, burung, juri).
5. **Silsilah di event log:** palet 21 byte + profil JSON di `BirdRegistered`, dibaca dari satu blok (`registeredAt`). Tanpa indexer.
6. **Sertifikat verifiable:** attestation organizer `CERT:<tipe>:<nomor>` + fingerprint SHA-256 dokumen; data self-declared diberi label.
7. **Verified runs + weekly prize pool:** seed dari `prevrandao`, batas waktu on-chain, pool mingguan (`fundRewards` / `claimWeeklyReward` / `rolloverWeeklyPool`, minggu mulai Senin 00:00 UTC).
8. **Tooling:** MONSKILLS, faucet + verification API devnads, Monad x402 facilitator, Chainlink MON/USD, viem `monadTestnet`.

## 6. Checklist sebelum 16:30 (code freeze) / 16:45 (submit)

- [ ] Submit di https://blitz.devnads.com/events/monad-blitz-jogja-v2 **lebih awal** (urutan submit = urutan pitching)
- [ ] Isi GitHub URL + Demo URL (https://kicau.xyz)
- [x] Post X (link di bagian 3)
- [ ] Rekam video demo + iklan, isi baris ⏳
- [ ] Pastikan lomba #0 status Judging + wallet host terisi MON untuk `finalize` di panggung
- [ ] Satu tab saja (hindari 429 RPC), hard refresh sebelum naik
- [ ] Ucapkan: repo, alamat kontrak, live URL, network

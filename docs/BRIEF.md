# Kicau — Project Brief

> Monad Blitz Jogja · 24 Oktober 2026 · code freeze 16:30 · submit 16:45.
> Brief awal (pagi) berfokus pada koleksi NFT + Flappy. Sepanjang hari produk bergeser ke **lomba gantangan on-chain**; dokumen ini sudah diperbarui ke apa yang live di https://kicau.xyz.

## 1. Satu kalimat

**Kicau adalah catatan on-chain untuk lomba burung kicau di dunia nyata:** juri menilai on-chain, scoreboard live, hadiah otomatis, dan gelar juara menjadi silsilah terverifikasi untuk burung asli. Ditambah game Flappy dan open world tempat burungmu hidup.

## 2. Latar belakang

- **Kicau mania** = hobi massal Indonesia dengan lomba **gantangan** tiap minggu. Penilaian di kertas, hasil sering diperdebatkan, gelar dan silsilah tidak bisa dicek.
- Permintaan burung juara ikut mendorong perburuan liar (Cucak Rawa dan Jalak Bali berstatus Critically Endangered).
- Celah: belum ada catatan prestasi yang netral dan bisa diverifikasi siapa pun. Monad (finality ~1 detik, biaya murah, `monadLogs`) membuat satu tx per skor juri masuk akal.

**Positioning:** koleksi digital + catatan prestasi, **bukan** jual-beli hewan hidup.

## 3. User flow utama (demo)

```
Host  → createContest (kelas, entry fee, 1–5 juri, deadline)
Owner → registerBird (foto → AI species ID → sprite pixel) → enter (bayar entry fee)
Host  → startJudging
Juri  → score(melodi, volume, durasi, gaya; 0–10) — 1 tx per skor
Penonton → scoreboard live via monadLogs (~0,6–1 s)
Host  → finalize → 50/25/15% ke keeper, sisa ke konservasi, "Juara 1/2/3" ter-attest (jika host organizer)
Semua → /lomba/<id>: halaman hasil + OG image untuk share
```

## 4. Status fitur

| Area | Fitur | Status |
|---|---|---|
| Lomba | create / enter / startJudging / score / finalize / cancel + refund / withdrawOwed / revoke | ✅ live |
| Lomba | Scoreboard live `monadLogs`, halaman hasil `/lomba/<id>` + OG image | ✅ live |
| Silsilah | Register burung asli (foto → AI species ID Haiku→Sonnet → palet 21 byte), nama bebas, sertifikat/silsilah/prestasi opsional ([PEDIGREE.md](PEDIGREE.md)) | ✅ live |
| Silsilah | Verifikasi sertifikat: attestation organizer `CERT:<tipe>:<nomor>` + fingerprint SHA-256 dokumen | ✅ live |
| Silsilah | Kicau Value (`valueOf`/`valueBreakdown`) + grafik riwayat dari event, MON + USD (Chainlink) | ✅ live |
| Silsilah | Owner dashboard, sponsor (`supportBird` 70/30, min 10% value), sertifikat x402 $0.01 USDC + QR | ✅ live |
| Main | Adopsi NFT spesies (30% konservasi), support (100%) | ✅ live |
| Main | Flappy verified runs (seed `prevrandao`, batas waktu on-chain), rintangan sangkar gantangan | ✅ live |
| Main | Leaderboard Daily/Weekly/All-time + weekly prize pool | ✅ live |
| Main | Kicau Garden `/taman` (Kenney CC0), musik gamelan 8-bit | ✅ live |
| Monad | ⚡ Quick Play burner + `eth_sendRawTransactionSync`, LIVE KICAU feed, public JSON API | ✅ live |
| Deploy | Testnet (app) + mainnet, source sama, verified, 57 test Foundry | ✅ |
| — | Verifikasi replay penuh untuk run Flappy | ❌ roadmap (v1 = batas waktu) |
| — | Wallet konservasi mitra | ❌ belum (sekarang wallet deployer tim, diganti via `setConservationWallet`) |
| — | Versi Unity, marketplace, breeding | ❌ di luar scope |
| — | App di mainnet | ❌ app memakai testnet; kontrak sudah di mainnet |

## 5. Kontrak: `Kicau.sol` (ringkas)

Satu kontrak ERC-721 Enumerable, sama di testnet `0x947929841Ba8154BB6E9BDeb35137d159c6A0F58` dan mainnet `0xA98CeE28C6EB35b6Ee7440b7490e265f23975d61`. Daftar fungsi lengkap di [README](../README.md#contract-api).

Prinsip desain:
- **Pass-through split:** dana konservasi/keeper/treasury dikirim di tx yang sama. Pembayaran hadiah/refund yang gagal dicatat sebagai `owed` (tidak memblokir).
- **Storage per slot:** per pemain / token / (lomba, burung, juri) — ramah parallel execution.
- **Data besar di event log:** palet + profil JSON di `BirdRegistered`/`BirdUpdated`, dibaca dari satu blok.
- **Gas:** Monad menagih berdasarkan `gas_limit`; gas limit diset secukupnya.

## 6. Pitch (3 menit, mayoritas demo)

1. Masalah (15 s): lomba gantangan, skor kertas, gelar tak terverifikasi, perburuan.
2. Solusi (15 s): catatan on-chain untuk lomba + silsilah terverifikasi + main.
3. **Demo live (~2 m):** `/lomba/0` → skor juri muncul live → **`finalize` di panggung** → hadiah + gelar ter-attest → halaman hasil + profil burung.
4. Kenapa Monad + bisnis + roadmap (20 s). Deck: https://kicau.xyz/pitch.

## 7. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| RPC testnet 429 / lambat | Satu tab, RPC fallback set, wallet demo diisi sebelumnya |
| Skor Flappy dipalsukan | Batas waktu on-chain (v1); diakui terbuka, replay = roadmap |
| Data silsilah palsu | Self-declared diberi label; hanya attestation organizer yang "verified" |
| Isu satwa dilindungi | AI menandai spesies dilindungi; posisi koleksi + catatan, bukan perdagangan |
| Keamanan key | Deploy dari keystore Foundry; key tidak masuk repo |

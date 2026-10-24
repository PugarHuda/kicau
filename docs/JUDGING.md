# Kicau — Rubrik Penilaian Monad Blitz Jogja (400 poin)

Peta setiap butir rubrik dari hackathon brief ke bukti nyata di project ini. Status per 24 Okt 2026.

**Positioning:** *GameFi + ReFi with a real-world provenance layer — on-chain pedigree and organizer-attested championship records for real songbirds.* Koleksi digital + catatan prestasi yang bisa diverifikasi; **bukan** kepemilikan atau jual-beli hewan hidup.

**Link inti (ucapkan saat pitch):**
- Repo: https://github.com/PugarHuda/kicau
- Live: https://kicau-theta.vercel.app
- Kontrak Mainnet (chain 143): `0xdada618e564edaf7ec0af0a12575bf3c0dc8523b` — [MonadVision](https://monadvision.com/address/0xdada618e564edaf7ec0af0a12575bf3c0dc8523b)
- Kontrak Testnet (chain 10143, dipakai app untuk demo): `0xD15bF5b95dC29083eBA236057e2DC9dE90092725` — [MonadVision](https://testnet.monadvision.com/address/0xD15bF5b95dC29083eBA236057e2DC9dE90092725) · [Monadscan](https://testnet.monadscan.com/address/0xD15bF5b95dC29083eBA236057e2DC9dE90092725)

---

## 1. Basic — Prize eligibility (100)

> "You can pitch without these, but you can't win." Sebut repo, alamat kontrak, live URL, dan deployment saat pitch.

| Butir | Poin | Syarat | Bukti di Kicau | Status |
|---|---|---|---|---|
| Public GitHub repo | 25 | Repo publik, baru, dibuat saat Blitz | `PugarHuda/kicau`, commit pertama 24 Okt pagi; monorepo (`contracts/`, `web/`, `docs/`) sesuai anjuran panitia | ✅ |
| Proper README | 25 | Nama, deskripsi 1 kalimat, cara setup, live URL, alamat kontrak, network | `README.md`: tabel network/kontrak/live/deploy tx, langkah `forge test` → deploy → `npm run dev`, ringkasan fungsi kontrak | ✅ |
| Kontrak di Monad Testnet | 25 | Deploy di testnet/mainnet **selama Blitz** | `Kicau` v3 dideploy 24 Okt (tx `0xbc190b63…4a794`); v1/v2 juga dideploy hari yang sama | ✅ |
| Project publicly hosted | 25 | Host apa pun, tanpa custom domain pun boleh | Vercel, auto-deploy dari GitHub (`web/`) | ✅ |

## 2. Advance — Does it work (100)

| Butir | Poin | Syarat | Bukti di Kicau | Status |
|---|---|---|---|---|
| Semua fungsi yang diumumkan jalan | 25 | Tidak ada fitur "coming soon" yang diklaim | QA Playwright 10/10 skenario lolos dengan tx asli: Shelter → card → video, Quick Play + faucet, Adopsi, Support, Flappy + submit skor, Register burung sendiri, metadata NFT, mobile 375 px | ✅ |
| Live transaction on chain saat demo | 25 | Tx sungguhan terjadi di panggung | Alur demo: ⚡ Quick Play → Adopsi (banner "terkonfirmasi dalam ~800 ms") → item muncul di LIVE KICAU dan berubah Proposed → Finalized → main → **Kirim skor on-chain** | ✅ (siapkan burner terisi) |
| Kontrak verified di explorer | 25 | Source terpublikasi | Verified "perfect match" di MonadVision + "Pass - Verified" di Monadscan via API devnads | ✅ |
| Bisa di-run orang lain dari README | 25 | Tanpa bantuan tim | Tanpa backend/DB; hanya `npm install`, `.env.local` 1 baris, `npm run dev`. Kontrak: `forge test` (30 test) + script deploy dengan keystore | ✅ |

## 3. Advance — Did anyone see it / Build in public (100)

> Post & views dikunci saat submission ditutup (16:45). Post setelahnya tidak dihitung.

| Butir | Poin | Syarat | Rencana / bukti | Status |
|---|---|---|---|---|
| Post di X atau LinkedIn dengan tag | 25 | Tag **@monad @monad_dev @geeky_kartikey** | Thread @BangDropID 11:41 WIB: [post 1](https://x.com/BangDropID/status/2113853488170156259) (apa itu Kicau + live + screenshot) · [reply](https://x.com/BangDropID/status/2113853615941284205) (sisi Monad + repo + kontrak) · [update 2](https://x.com/BangDropID/status/2113869717429789043) | ✅ |
| Video demo ≥30 detik di sosial | 25 | Produk berjalan, ≥30 detik | Rekam layar alur demo di atas (≤60 detik) | ⏳ setelah post teks |
| Video iklan kreatif di sosial | 25 | Bebas, kreatif | Mis. sprite pixel burung + kicau asli + "Pelihara kicaunya, bukan sangkarnya" | ⏳ |
| 5K+ views kolektif | 25 | Total semua post selama Blitz | Sebar ke grup kicau mania, Dev Web3 Jogja, Monad Developers Indonesia | ⏳ |

## 4. Bonus (100)

| Butir | Poin | Penilai | Bukti / argumen | Status |
|---|---|---|---|---|
| Kontrak di Monad Mainnet | 25 | Panitia | `0xdada618e564edaf7ec0af0a12575bf3c0dc8523b` di chain 143, dideploy 24 Okt (tx `0xafa4ad0d…df7884`), verified MonadVision + Monadscan · [explorer](https://monadvision.com/address/0xdada618e564edaf7ec0af0a12575bf3c0dc8523b) | ✅ |
| Public page di custom domain | 15 | Panitia | Vercel mendukung custom domain; perlu domain | ❌ belum |
| Product-market fit | ≤20 | Juri | Kicau mania = hobi nasional di Indonesia dengan lomba gantangan mingguan. Kicau memberi versi digital (koleksi, game, lomba skor) + **daftarkan burung asli** dengan silsilah, prestasi, sertifikat yang tersimpan on-chain — menjawab kebutuhan pamer & bukti prestasi | argumen pitch |
| Revenue potential & strategy | ≤20 | Juri | 70% hasil adopsi ke treasury, biaya register burung, ke depan: entry fee turnamen, sponsor lomba, verifikasi sertifikat oleh panitia lomba (attestation berbayar) | argumen pitch |
| Innovation & originality | ≤20 | Juri | Lihat bagian 5 | argumen pitch |

## 5. Yang membuat Kicau "Monad-native" (untuk poin inovasi)

1. **LIVE KICAU via `monadLogs`.** Subscription WebSocket khusus Monad di state *Proposed* (spekulatif). Setiap adopsi/support/skor muncul seketika dan berubah Proposed → Voted → Finalized dalam **~540 ms**, sekitar 2× lebih cepat dari `eth_subscribe logs` (~1.050 ms). Item yang bloknya di-reorg ditandai.
2. **⚡ Quick Play + `eth_sendRawTransactionSync`.** Burner wallet di browser, diisi otomatis dari faucet devnads, tanda tangan lokal, receipt kembali dalam satu panggilan RPC (~0,8 detik round trip). Tanpa popup — UX game terasa seperti Web2.
3. **Desain storage ramah parallel execution.** Semua state per pemain/per token (`bestByPlayer`, `bestByToken`, `supportOf[species]`), tanpa counter global yang diperebutkan.
4. **Gambar & silsilah murah di event log.** Burung yang didaftarkan disimpan sebagai palet 18 byte + profil JSON di event `BirdRegistered` (bukan storage). Frontend membaca log dari satu blok saja (`registeredAt`), jadi tidak butuh indexer maupun `getLogs` rentang lebar.
5. **Konservasi transparan.** Split 30% (adopsi) / 100% (support) terjadi di tx yang sama; kontrak tidak pernah menahan saldo. `totalConservation()` tampil langsung di hero.
6. **Tooling Monad yang dipakai:** MONSKILLS (scaffold, gas, concepts), faucet API devnads, verification API devnads (multi-explorer), viem `monadTestnet`, wagmi `useWriteContractSync`.

## 6. Checklist sebelum 16:30 (code freeze) / 16:45 (submit)

- [ ] Submit di https://blitz.devnads.com/events/monad-blitz-jogja-v2 **lebih awal** (urutan submit = urutan pitching)
- [ ] Isi GitHub URL + Demo URL (live)
- [x] Post X selesai sebelum 16:45 (link di bagian 3)
- [ ] Siapkan burner demo terisi MON, satu tab saja (hindari 429 RPC)
- [ ] Hard refresh live site sebelum naik panggung
- [ ] Ucapkan: repo, alamat kontrak, live URL, network

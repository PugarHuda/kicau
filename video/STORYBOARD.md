# Kicau demo video — storyboard

The 3-minute pitch slot includes the live talk and a live on-stage tx, so **`KicauDemo` is 110 s** (hard max 120 s):
intro 4 s + 8 scenes = 100 s + outro 6 s. The presenter talks over it: captions are short, music is quiet (volume 0.15).
The live `finalize` happens on stage, so the video only shows scoring → live scoreboard, and the podium of an
*already-finalized* contest.

Source of truth for durations/captions/callouts/SFX: `src/scenes.ts`. Click scripts: `scripts/record.mjs` (same ids).
Each recording lands in `public/recordings/<id>.mp4`; missing files render as a pixel placeholder card.

| # | id | sec | Caption (headline) | Monad detail line |
|---|---|---|---|---|
| — | intro | 4 | KICAU — Keep the song, not the cage. | The on-chain record for real-life songbird contests · built on Monad |
| 1 | contest-live | 18 | Judges score live. Scoreboard in ~0.6 s | 1 tx per score · monadLogs Proposed-state stream |
| 2 | contest-podium | 12 | Prizes paid instantly. Champion on-chain | finalize: 50/25/15% to keepers + 10% conservation, 1 tx |
| 3 | register | 15 | Register your real bird | AI species ID → pixel sprite → registerBird ERC-721 |
| 4 | kicau-value | 12 | Kicau Value: earned, not hyped | valueOf rises with wins, decays without updates |
| 5 | sponsor-adopt | 12 | Sponsor & adopt. Confirmed in < 1 s | eth_sendRawTransactionSync · 70/30 split in the same tx |
| 6 | flappy | 15 | Verified runs. Weekly prize pool | prevrandao seed · contract rejects impossible scores |
| 7 | garden | 8 | Kicau Garden: walk your bird NFT | Open world · adopt or support straight from the card |
| 8 | proof | 8 | x402 certificate. Verified on mainnet | $0.01 USDC via Monad x402 · testnet + mainnet verified |
| — | outro | 6 | KICAU · try it live | live URL, repo, testnet + mainnet addresses, Built at Monad Blitz Jogja 2026, @monad @monad_dev @geeky_kartikey @devweb3jogja |

Scenes 1+2 = 30 s (contests), sum of scenes = 100 s, total = **110 s**.

## Click scripts (what `scripts/record.mjs` does on https://kicau-theta.vercel.app)

Actors are persistent profiles in `video/.profiles/<actor>` (each keeps its ⚡ Quick Play burner + MON between runs).
Only the context marked 🎥 is filmed. Every tx waits for a *new* tx link in the `[role=status]` banner (real confirmation).
The visible cursor (sun-coloured pixel dot) and click ripple are injected by an init script.

1. **contest-live** — host (off camera) + 🎥 viewer
   - host: `/lomba` → ⚡ Quick Play → fill `Piala Kicau Jogja` placeholder with "Piala Kicau Jogja HH:MM", class `Murai Batu` → **+ Add me** (host is the judge) → **Create contest** (tx) → 3× (**Quick-register** tx → **Enter ·** tx) → **Start judging** (tx).
   - 🎥 viewer: opens `/lomba#<id>`, scrolls to **Live scoreboard**, cursor rests on the board.
   - host scores 3 birds (4 range sliders each, then the card's button; 1 tx per score) — the viewer's board re-ranks with "updated in ~… ms". 3 s hold after each.
   - The contest is left in judging → **finalize it live on stage**.
2. **contest-podium** — 🎥 viewer: `/lomba/<podium id>` (an already-finalized contest with an attested title; pass `--podium=<id>`) → hold on podium/prizes → scroll → cursor to a payout tx link.
3. **register** — 🎥 owner: home → ⚡ Quick Play → **Register your real bird** → upload a real bird photo (`--photo=assets/bird.jpg`, default) → wait for "Identifying species with AI…" to finish → hold on species verdict + pixel sprite → name `Si Jambul` → **Register** (tx).
4. **kicau-value** — 🎥 owner: `/lomba` → **Proof & dashboard** → wait for "matches contract" → hover the value chart → scroll the proof timeline.
5. **sponsor-adopt** — 🎥 viewer: home → ⚡ Quick Play → a bird in **Community Birds** → "Support this bird" → MON amount button (tx; banner shows ~ms) → Esc → a bird in **Shelter** → **Adopt NFT** (tx). LIVE KICAU feed visible top-right.
6. **flappy** — 🎥 viewer: home → **Fly** (startRun, seeded) → ~18 flaps (Space) → **Submit verified score** (tx) → scroll to **Leaderboard** → **Daily** → **Weekly** (weekly pool).
7. **garden** — 🎥 viewer: `/taman` → walk left/up with arrow keys into the shelter yard, press E near a bird → card opens. No tx. *(Used for the pipeline dry-run.)*
8. **proof** — 🎥 owner: `/lomba` → **Certificate** (x402: burner signs EIP-712, $0.01 testnet USDC — fund the owner burner with USDC first) → certificate tab → MonadVision mainnet contract page (`0xdada…523b`, Contract tab, verified badge).

After recording, open `npm run studio`, scrub each scene, and adjust `durationSec`, `callouts` (recording-pixel coords, 1920x1080; frames relative to scene start) and `sfx` frames in `src/scenes.ts`.

## Teaser (`KicauTeaser`, 40 s, social "creative ad")

3 s KICAU title · 4 s "Songbird contests judged on paper. Disputed. Poached." · 3 s "Now on Monad." · 4 × 5 s UI clips
(contest-live, register, flappy, garden — reuses the same recordings) · 3 s "~0.6 s live scoreboard" · 3 s "30% to conservation" ·
4 s "PLAY · PROTECT · PROVE / kicau-theta.vercel.app". Flappy-theme chiptune at 0.55 + SFX on every cut.

## Audio (synthesized, no licensed assets) — `npm run audio`

`public/audio/`: `music-garden.wav` (68.6 s seamless loop, demo bed), `music-flappy.wav` (41.7 s, teaser), `ui-click`,
`tx-confirm`, `coin`, `score-tick`, `whoosh`, `chirp`. Same slendro scale + patterns as `web/src/lib/music.ts`.

## Commands

```bash
cd video
npm install                                   # once (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 if chromium is cached)
npm run audio                                 # regenerate WAVs
node scripts/record.mjs                       # all scenes (or: node scripts/record.mjs flappy garden)
node scripts/record.mjs contest-podium --podium=<finalized contest id>
node scripts/record.mjs register --photo=assets/<real bird>.jpg
npm run studio                                # tune durations / callouts
npm run render                                # out/kicau-demo.mp4 + out/kicau-teaser.mp4
```

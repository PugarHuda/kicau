# Kicau demo video: storyboard

The 3-minute pitch slot includes the live talk and a live on-stage tx, so **`KicauDemo` is 113 s** (v2, hard max 120 s):
intro 4 s + 11 scenes = 103 s + outro 6 s. The presenter talks over it: captions are short, music is quiet (volume 0.15).
Story order: start on the home page (your bird, its value and record, play, garden, mainnet), then contests and the trophy last.
The live `finalize` happens on stage, so the video only shows scoring, the live scoreboard and the podium of an
*already-finalized* contest. Older clips are sped up 1.2x-1.64x with ffmpeg instead of cut; `sped()` in `src/scenes.ts`
rescales their callouts/SFX. Scene order is the `ORDER` array in `src/scenes.ts`.

Source of truth for durations/captions/callouts/SFX: `src/scenes.ts`. Click scripts: `scripts/record.mjs` (same ids).
Each recording lands in `public/recordings/<id>.mp4`; missing files render as a pixel placeholder card.

| # | id | sec | starts | Caption (headline) | Monad detail line |
|---|---|---|---|---|---|
| - | intro | 4 | 0 | KICAU: Keep the song, not the cage. | The on-chain record for real-life songbird contests · built on Monad |
| 1 | register | 11 | 4 | Register your real bird | Photo → AI species ID → pixel character → ERC-721 on Monad |
| 2 | kicau-value | 10 | 15 | Kicau Value: earned, not hyped | Rebuilt from on-chain events, checked against the contract |
| 3 | pedigree | 7 | 25 | Pedigree: certificates, lineage, doc hash | Indonesian certificates + sire × dam on-chain · doc kept as SHA-256 |
| 4 | dashboard | 7.5 | 32 | My Dashboard: value, earnings, contests | Kicau Value in MON + USD · earnings · weekly rewards |
| 5 | sponsor-adopt | 12 | 39.5 | Support & adopt. Confirmed in ~1 s | Support: 100% to conservation · adoption: 30% to conservation |
| 6 | flappy | 10.5 | 51.5 | Verified runs. Weekly prize pool | startRun seeds the level on-chain · contract rejects impossible scores |
| 7 | garden | 5 | 62 | Kicau Garden: an open world of real birds | Every bird NFT lives here · adopt or support from its card |
| 8 | mainnet | 7 | 67 | Live on Monad mainnet · verified on both | One toggle: kicau.xyz ↔ mainnet.kicau.xyz · real MON |
| 9 | contest-live | 19 | 74 | Judges score live. The crowd sees it instantly | 1 tx per score · board updates from the Proposed block (monadLogs) |
| 10 | contest-podium | 10 | 93 | Finalize: prizes paid to keepers instantly | 50/25/15% to the top 3 + 10% conservation, in the same tx |
| 11 | proof | 4 | 103 | Every result is a public link | Server-rendered from the chain + live OG preview · no database |
| - | outro | 6 | 107 | KICAU · try it live | live URL, repo, testnet + mainnet addresses, @monad @monad_dev @geeky_kartikey @devweb3jogja |

Sum of scenes = 103 s, total = **113 s**. Output: `out/kicau-demo.mp4`, copied to `web/public/demo/`.

## Click scripts (what `scripts/record.mjs` does on https://kicau.xyz, override with `--base=`)

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
8. **proof** — 🎥 owner: `/lomba` → **Certificate** (x402: burner signs EIP-712, $0.01 testnet USDC — fund the owner burner with USDC first) → certificate tab → shareable result page `/lomba/<id>` with its OG preview.
9. **pedigree** + **dashboard** (recipe `dashboard`; `--noreg` skips registering): owner registers "Si Silsilah" with a self-declared breeder-ring certificate (DEMO-001) and lineage, opens its profile (certificates, lineage, "Check a document"), then `/me` My Dashboard.
10. **mainnet**: viewer on kicau.xyz clicks the header **mainnet** toggle → mainnet.kicau.xyz ("MAINNET · real MON" badge) → `/lomba/0`. Read-only, no wallet.

After recording, open `npm run studio`, scrub each scene, and adjust `durationSec`, `callouts` (recording-pixel coords, 1920x1080; frames relative to scene start) and `sfx` frames in `src/scenes.ts`.

## Teaser (`KicauTeaser`, 40 s, social "creative ad")

3 s KICAU title · 4 s "Songbird contests judged on paper. Disputed. Poached." · 3 s "Now on Monad." · 4 × 5 s UI clips
(contest-live, register, flappy, mainnet "LIVE ON MAINNET / same app · real MON"; reuses the same recordings) · 3 s "~0.6 s live scoreboard" · 3 s "30% to conservation" ·
4 s "PLAY · PROTECT · PROVE / kicau.xyz". Flappy-theme chiptune at 0.55 + SFX on every cut.

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

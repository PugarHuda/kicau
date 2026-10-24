"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { birdDataUri } from "@/lib/birds";
import { KICAU_ADDRESS } from "@/lib/config";
import { qrSvgPath } from "./qr";

export type LiveStats = { birds: number; conservation: string; players: number; contests: number };

const LIVE = "https://kicau.xyz";
const LIVE_SHORT = "kicau.xyz";
const REPO = "github.com/PugarHuda/kicau";
const CONTRACT = KICAU_ADDRESS; // testnet (used by the app); follows NEXT_PUBLIC_KICAU_ADDRESS on redeploy
const MAINNET = "0xA98CeE28C6EB35b6Ee7440b7490e265f23975d61"; // chain 143, same source, verified
const QR = qrSvgPath(LIVE);

function Bird({ id, wing, size = "pd-bird" }: { id: number; wing: boolean; size?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={birdDataUri(id, wing)} alt="" className={size} />;
}

function Kicker({ children }: { children: ReactNode }) {
  return <p className="font-display pd-kicker">{children}</p>;
}

function Card({ title, children, tone = "paper" }: { title: ReactNode; children?: ReactNode; tone?: string }) {
  return (
    <div className={`pd-card pd-${tone}`}>
      <h3 className="font-display pd-h3">{title}</h3>
      {children && <div className="pd-p">{children}</div>}
    </div>
  );
}

function Qr({ className = "pd-qr" }: { className?: string }) {
  return (
    <a href={LIVE} className={className} aria-label={`Open ${LIVE_SHORT}`}>
      <svg viewBox={`0 0 ${QR.size} ${QR.size}`} shapeRendering="crispEdges" role="img" aria-label="QR code">
        <rect width={QR.size} height={QR.size} fill="#fffdf7" />
        <path d={QR.d} fill="#1e2a1f" />
      </svg>
    </a>
  );
}

function slides(wing: boolean, stats: LiveStats | null): { dark?: boolean; body: ReactNode }[] {
  return [
    {
      dark: true,
      body: (
        <div className="pd-close">
          <div className="pd-title-main">
            <div className="pd-birdrow pd-left">
              {[0, 1, 2, 3, 4].map((i) => (
                <Bird key={i} id={i} wing={(i % 2 === 0) === wing} size="pd-bird-lg" />
              ))}
            </div>
            <h1 className="font-display pd-hero">KICAU</h1>
            <p className="font-display pd-h2 pd-sun">The on-chain record for real-life songbird contests.</p>
            <p className="pd-p">Judges score on-chain · live scoreboard · instant prizes · verified champions. Built on Monad.</p>
            <p className="font-display pd-url pd-sun">{LIVE_SHORT}</p>
            <p className="pd-sm">Monad Blitz Jogja 2026 · {REPO}</p>
          </div>
          <Qr className="pd-qr pd-qr-sm" />
        </div>
      ),
    },
    {
      body: (
        <>
          <Kicker>01 · Problem</Kicker>
          <h2 className="font-display pd-h1">Every week, thousands of contests. Zero trusted records.</h2>
          <div className="pd-grid pd-g3">
            <Card title="Paper scores">
              <b>Gantangan</b> songbird contests run weekly across Indonesia. Scores live on paper; results get disputed.
            </Card>
            <Card title="Unverifiable champions">
              &quot;Juara 1&quot; titles, rings and pedigree certificates are claims nobody can check.
            </Card>
            <Card title="Poaching" tone="clay">
              <div className="pd-birdrow pd-left">
                <Bird id={3} wing={wing} />
                <Bird id={4} wing={!wing} />
              </div>
              Demand for champion singers empties forests. Straw-headed bulbul &amp; Bali myna are{" "}
              <b>Critically Endangered</b>.
            </Card>
          </div>
        </>
      ),
    },
    {
      body: (
        <>
          <Kicker>02 · Solution</Kicker>
          <h2 className="font-display pd-h1">Contests · verified pedigree · play.</h2>
          <div className="pd-grid pd-g3">
            <Card title="① Contests on-chain">
              <p className="font-display pd-big pd-leaf">50/25/15</p>
              Judges score 4 aspects on-chain. <code>finalize</code> pays keepers + conservation and attests
              &quot;Juara&quot; titles in the same tx.
            </Card>
            <Card title="② Verified pedigree">
              <p className="font-display pd-big pd-leaf">Real bird</p>
              Photo → AI species ID → pixel sprite. Organizer-attested titles &amp; certificates; self-declared data
              labelled. <b>Kicau Value</b> rises with results.
            </Card>
            <Card title="③ Play">
              <p className="font-display pd-big pd-leaf">Flappy</p>
              Verified on-chain runs, Daily/Weekly/All-time boards, weekly prize pool, Kicau Garden open world.
            </Card>
          </div>
          <p className="pd-sm pd-mt">Records and collectibles. Never ownership or trade of live animals.</p>
        </>
      ),
    },
    {
      body: (
        <>
          <Kicker>03 · Live demo · kicau.xyz/lomba/0</Kicker>
          <h2 className="font-display pd-h1">Watch a contest close on stage.</h2>
          <div className="pd-grid pd-g3">
            <Card title="1 · Contest">Host, class, entry fee, judges. Birds entered by their keepers.</Card>
            <Card title="2 · Judge scores">Melody, volume, duration, style. One tx each.</Card>
            <Card title="3 · Live board">Every viewer&apos;s scoreboard updates in under a second.</Card>
            <Card title="4 · Finalize" tone="sun">
              Live tx: prizes paid, conservation funded, Juara titles attested.
            </Card>
            <Card title="5 · Share">/lomba/&lt;id&gt; result page with an OG image from chain data.</Card>
            <Card title="6 · Bird record">Wins, attestations, Kicau Value chart, x402 certificate.</Card>
          </div>
        </>
      ),
    },
    {
      dark: true,
      body: (
        <>
          <Kicker>04 · Why Monad · measured today</Kicker>
          <h2 className="font-display pd-h1">One tx per judge score only works here.</h2>
          <div className="pd-grid pd-g2">
            <div className="pd-card pd-ink">
              <p className="font-display pd-big pd-sun">~0.6–1 s</p>
              <p className="pd-p">
                Judge score → every viewer&apos;s scoreboard, via <code>monadLogs</code> (speculative, Proposed state).
              </p>
            </div>
            <div className="pd-card pd-ink">
              <p className="font-display pd-big pd-sun">~0.5–1 s</p>
              <p className="pd-p">
                <b>⚡ Quick Play</b>: browser burner + <code>eth_sendRawTransactionSync</code>. Receipt in one call, no
                popups.
              </p>
            </div>
            <div className="pd-card pd-ink">
              <p className="font-display pd-big pd-sun">Per-slot</p>
              <p className="pd-p">
                Hot paths write per-player / per-token / per-(contest, bird, judge) slots: parallel-execution friendly.
              </p>
            </div>
            <div className="pd-card pd-ink">
              <p className="font-display pd-big pd-sun">21 bytes</p>
              <p className="pd-p">
                Sprite palette + pedigree JSON in <b>event logs</b>, read from one block. <b>No indexer.</b>
              </p>
            </div>
          </div>
        </>
      ),
    },
    {
      body: (
        <>
          <Kicker>05 · Architecture</Kicker>
          <h2 className="font-display pd-h1">No database. No indexer.</h2>
          <div className="pd-arch">
            <div className="pd-card pd-paper">
              <h3 className="font-display pd-h3">Next.js 15 on Vercel</h3>
              <ul className="pd-p pd-list">
                <li>wagmi / viem · ⚡ burner</li>
                <li>contests · Flappy · Garden</li>
                <li>API: faucet · AI species ID</li>
                <li>x402 certificate · JSON API</li>
              </ul>
            </div>
            <div className="pd-arrows pd-sm">
              <span>tx → eth_sendRawTransactionSync →</span>
              <span>← monadLogs (Proposed) ←</span>
              <span>← reads + one-block logs ←</span>
            </div>
            <div className="pd-card pd-leafbg">
              <h3 className="font-display pd-h3">Kicau.sol · Monad</h3>
              <ul className="pd-p pd-list">
                <li>contests: enter · score · finalize</li>
                <li>registerBird · attest · valueOf</li>
                <li>supportBird · buy · support</li>
                <li>runs · weekly prize pool</li>
              </ul>
            </div>
          </div>
          <p className="pd-sm pd-mt">
            External: Chainlink MON/USD · Monad x402 facilitator · Claude Haiku → Sonnet · devnads faucet + verify API
          </p>
        </>
      ),
    },
    {
      body: (
        <>
          <Kicker>06 · Proof · built today</Kicker>
          <h2 className="font-display pd-h1">It works. On chain. Right now.</h2>
          {stats && (
            <div className="pd-grid pd-g4">
              <Card title="Contests">
                <p className="font-display pd-big pd-leaf">{stats.contests}</p>
              </Card>
              <Card title="Birds (NFTs)">
                <p className="font-display pd-big pd-leaf">{stats.birds}</p>
              </Card>
              <Card title="MON to conservation">
                <p className="font-display pd-big pd-leaf">{stats.conservation}</p>
              </Card>
              <Card title="Players">
                <p className="font-display pd-big pd-leaf">{stats.players}</p>
              </Card>
            </div>
          )}
          <ul className="pd-p pd-checks">
            {stats && <li>Numbers above read live from the testnet contract when this page rendered</li>}
            <li>60 Foundry tests (incl. fuzz + reentrancy)</li>
            <li>Playwright QA with real txs: full contest flow, each tx 0.5–0.9 s</li>
            <li>Same contract on mainnet, verified on MonadVision + Monadscan</li>
          </ul>
          <p className="pd-sm pd-mt">
            testnet <span className="pd-mono">{CONTRACT}</span> · mainnet <span className="pd-mono">{MAINNET}</span>
          </p>
        </>
      ),
    },
    {
      body: (
        <>
          <Kicker>07 · Business model</Kicker>
          <h2 className="font-display pd-h1">Trust is the product.</h2>
          <div className="pd-grid pd-g2">
            <div className="pd-stack">
              <Card title="Bird registration · live">0.005 MON per bird record, 70% treasury / 30% conservation.</Card>
              <Card title="x402 certificate · live">$0.01 USDC per printable pedigree, gasless for the payer.</Card>
              <Card title="Sponsorships · live">supportBird: 70% to the keeper (not us), 30% to conservation.</Card>
            </div>
            <div className="pd-stack">
              <Card title="Contest platform fee · planned" tone="sun">
                Today entry fees go up to 90% to winners, the rest to conservation; a host fee comes next.
              </Card>
              <Card title="Verified organizers · planned">Paid onboarding for contest organizers who attest titles.</Card>
              <Card title="Sponsored contests · planned">Feed &amp; cage brands fund prize pools.</Card>
            </div>
          </div>
        </>
      ),
    },
    {
      body: (
        <>
          <Kicker>08 · Shipped today → next</Kicker>
          <h2 className="font-display pd-h1">Next flights.</h2>
          <div className="pd-grid pd-g4">
            <Card title="Shipped" tone="leafbg">
              On-chain contests + payouts + auto-attested titles, verified pedigree, Kicau Value, x402 certificate,
              verified runs + weekly pool. Contract on mainnet.
            </Card>
            <Card title="Next">Pilot with a real gantangan organizer; printed QR on result sheets.</Card>
            <Card title="Then">Conservation partner wallet; app on mainnet.</Card>
            <Card title="Later">Full replay verification of Flappy runs (today: on-chain time bound).</Card>
          </div>
        </>
      ),
    },
    {
      dark: true,
      body: (
        <div className="pd-close">
          <Qr />
          <div>
            <Kicker>Try it now</Kicker>
            <p className="font-display pd-url pd-sun">{LIVE_SHORT}</p>
            <ul className="pd-p pd-list">
              <li>{REPO}</li>
              <li>
                testnet <span className="pd-mono pd-break">{CONTRACT}</span>
              </li>
              <li>
                mainnet <span className="pd-mono pd-break">{MAINNET}</span>
              </li>
              <li>Built by @BangDropID</li>
            </ul>
            <p className="pd-sm pd-mt">Thanks @monad @monad_dev @geeky_kartikey @devweb3jogja</p>
            <div className="pd-birdrow pd-left pd-mt">
              {[0, 1, 2, 3, 4].map((i) => (
                <Bird key={i} id={i} wing={(i % 2 === 0) === wing} />
              ))}
            </div>
          </div>
        </div>
      ),
    },
  ];
}

export function Deck({ stats }: { stats: LiveStats | null }) {
  const [wing, setWing] = useState(false);
  const deck = slides(wing, stats);
  const n = deck.length;
  const [i, setI] = useState(0);
  const touch = useRef<number | null>(null);

  const go = useCallback((to: number) => setI(Math.max(0, Math.min(n - 1, to))), [n]);

  useEffect(() => {
    const q = new URLSearchParams(location.search).get("s") ?? location.hash.slice(1);
    const s = parseInt(q, 10);
    if (s >= 1) go(s - 1);
  }, [go]);

  useEffect(() => {
    const onHash = () => {
      const s = parseInt(location.hash.slice(1), 10);
      if (s >= 1) go(s - 1);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [go]);

  useEffect(() => {
    // drop ?s= so a reload keeps the current slide
    history.replaceState(null, "", `${location.pathname}#${i + 1}`);
  }, [i]);

  useEffect(() => {
    const t = setInterval(() => setWing((w) => !w), 350);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) go(i + 1);
      else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) go(i - 1);
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(n - 1);
      else if (e.key === "f" || e.key === "F") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.();
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, n, go]);

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("a,button,code,.pd-mono")) return;
    const r = e.currentTarget.getBoundingClientRect();
    go(e.clientX - r.left < r.width / 3 ? i - 1 : i + 1);
  };

  return (
    <div
      className="pd-root"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? i + 1 : i - 1);
      }}
    >
      <style>{CSS}</style>
      {deck.map((s, k) => (
        <section
          key={k}
          className={`pd-stage ${s.dark ? "pd-dark" : ""}`}
          data-active={k === i || undefined}
          aria-hidden={k !== i}
          aria-label={`Slide ${k + 1} of ${n}`}
          onClick={onClick}
        >
          <div className="pd-inner">{s.body}</div>
          <span className="font-display pd-num">
            {k + 1}/{n}
          </span>
        </section>
      ))}
      <nav className="pd-nav" aria-label="Slide navigation">
        <button className="btn-ghost" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous slide">
          ◀
        </button>
        <span className="font-display">
          {i + 1} / {n}
        </span>
        <button className="btn-ghost" onClick={() => go(i + 1)} disabled={i === n - 1} aria-label="Next slide">
          ▶
        </button>
        <button
          className="btn-ghost"
          onClick={() => void document.documentElement.requestFullscreen?.()}
          aria-label="Fullscreen (F)"
        >
          ⛶
        </button>
      </nav>
    </div>
  );
}

// Mobile-first sizes in rem; on wide screens the stage is a 16:9 box and type scales with its width (cqw).
const CSS = `
.pd-root{position:fixed;inset:0;overflow:auto;background:#141c15;color:var(--ink);z-index:50}
.pd-stage{display:none;position:relative;container-type:inline-size;background:var(--cream);
  background-image:repeating-linear-gradient(0deg,rgb(0 0 0/.035) 0 2px,transparent 2px 4px);
  min-height:100svh;padding:20px 16px 88px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.pd-stage[data-active]{display:block}
.pd-dark{background-color:var(--ink);color:var(--paper)}
.pd-inner{display:flex;flex-direction:column;gap:14px;height:100%}
.pd-kicker{font-size:.7rem;color:var(--clay);text-transform:uppercase;padding-right:3rem}
.pd-dark .pd-kicker{color:var(--sun)}
.pd-hero{font-size:3rem;line-height:1.1!important}
.pd-h1{font-size:1.3rem}
.pd-h2{font-size:1rem}
.pd-h3{font-size:.8rem;margin-bottom:6px}
.pd-p{font-size:1.1rem;line-height:1.35}
.pd-sm{font-size:.9rem;opacity:.85}
.pd-big{font-size:1.6rem;margin:4px 0 8px;line-height:1.1!important}
.pd-sun{color:var(--sun)}
.pd-leaf{color:var(--leaf)}
.pd-mt{margin-top:auto}
.pd-mono{font-family:ui-monospace,monospace;font-size:.85em;word-break:break-all;cursor:text}
.pd-break{word-break:break-all}
.pd-url{font-size:.85rem;word-break:break-all;margin:6px 0 12px}
code{font-family:ui-monospace,monospace;font-size:.9em;background:rgb(232 163 61/.25);padding:0 .25em}
.pd-grid{display:grid;gap:12px;grid-template-columns:1fr}
.pd-stack{display:flex;flex-direction:column;gap:12px}
.pd-card{border:3px solid var(--ink);box-shadow:4px 4px 0 var(--ink);padding:12px;background:var(--paper);color:var(--ink)}
.pd-dark .pd-card{border-color:var(--paper);box-shadow:4px 4px 0 var(--sun)}
.pd-ink{background:#273628;color:var(--paper)}
.pd-clay{background:var(--clay);color:var(--paper)}
.pd-sun.pd-card{background:var(--sun);color:var(--ink)}
.pd-leafbg{background:var(--leaf);color:var(--paper)}
.pd-list{list-style:none;display:flex;flex-direction:column;gap:4px}
.pd-list li::before{content:"▸ ";color:var(--sun)}
.pd-checks{list-style:none;display:flex;flex-direction:column;gap:8px}
.pd-checks li::before{content:"✔ ";color:var(--leaf)}
.pd-center{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:16px;min-height:calc(100svh - 120px)}
.pd-birdrow{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.pd-left{justify-content:flex-start;margin:4px 0 8px}
.pd-bird{width:48px;height:auto;image-rendering:pixelated}
.pd-bird-lg{width:56px;height:auto;image-rendering:pixelated}
.pd-bars{display:flex;flex-direction:column;gap:6px;margin:10px 0 6px}
.pd-bar{display:block;background:var(--muted);color:var(--paper);font-size:.8rem;padding:4px 8px;white-space:nowrap}
.pd-bar-sun{background:var(--sun);color:var(--ink)}
.pd-arch{display:grid;gap:12px;grid-template-columns:1fr}
.pd-arrows{display:flex;flex-direction:column;gap:8px;justify-content:center;text-align:center;font-family:ui-monospace,monospace;font-weight:700}
.pd-close{display:flex;flex-direction:column;gap:20px}
.pd-qr{display:block;width:min(100%,320px);margin:0 auto;border:4px solid var(--paper);box-shadow:6px 6px 0 var(--sun)}
.pd-qr svg{display:block;width:100%;height:auto}
.pd-qr-sm{width:min(100%,220px)}
.pd-title-main{display:flex;flex-direction:column;gap:12px}
.pd-num{position:absolute;right:16px;top:12px;font-size:.6rem;opacity:.5}
.pd-nav{position:fixed;left:50%;bottom:12px;translate:-50% 0;display:flex;gap:8px;align-items:center;
  background:var(--paper);border:3px solid var(--ink);padding:6px 10px;font-size:.7rem;color:var(--ink);z-index:2;opacity:.9;white-space:nowrap}
.pd-nav .btn-ghost{padding:6px 10px;box-shadow:2px 2px 0 var(--ink)}

@media (min-width:900px) and (min-aspect-ratio:4/3){
  .pd-root{display:flex;align-items:center;justify-content:center;overflow:hidden}
  .pd-stage{width:min(100vw,177.78vh);height:min(100vh,56.25vw);min-height:0;padding:4cqw 5cqw 5cqw;overflow:hidden}
  .pd-stage[data-active]{display:block}
  .pd-inner{gap:2.2cqw}
  .pd-kicker{font-size:1.3cqw}
  .pd-hero{font-size:9cqw}
  .pd-h1{font-size:3.1cqw}
  .pd-h2{font-size:2.2cqw}
  .pd-h3{font-size:1.45cqw;margin-bottom:1cqw}
  .pd-p{font-size:2.05cqw}
  .pd-sm{font-size:1.45cqw}
  .pd-big{font-size:3.8cqw}
  .pd-grid,.pd-stack,.pd-arch{gap:2cqw}
  .pd-g2{grid-template-columns:1fr 1fr}
  .pd-g3{grid-template-columns:repeat(3,1fr)}
  .pd-g4{grid-template-columns:repeat(4,1fr)}
  .pd-card{padding:1.6cqw;border-width:.3cqw;box-shadow:.45cqw .45cqw 0 var(--ink)}
  .pd-dark .pd-card{box-shadow:.45cqw .45cqw 0 var(--sun)}
  .pd-center{min-height:0;height:100%;gap:2cqw}
  .pd-bird{width:5cqw}
  .pd-bird-lg{width:8cqw}
  .pd-birdrow{gap:1.5cqw}
  .pd-bar{font-size:1.2cqw;padding:.4cqw .8cqw}
  .pd-arch{grid-template-columns:1fr auto 1fr;align-items:stretch}
  .pd-close{flex-direction:row;align-items:center;gap:5cqw;height:100%}
  .pd-qr{width:36cqw;flex:none;margin:0;border-width:.5cqw}
  .pd-qr-sm{width:26cqw}
  .pd-title-main{gap:1.6cqw;flex:1}
  .pd-url{font-size:2.6cqw;word-break:normal;white-space:nowrap;margin:1cqw 0 2cqw}
  .pd-num{right:2cqw;top:1.6cqw;font-size:1cqw}
  .pd-nav{opacity:.25;transition:opacity .15s}
  .pd-nav:hover,.pd-nav:focus-within{opacity:1}
}
:fullscreen .pd-nav{display:none}

@page{size:1600px 900px;margin:0}
@media print{
  html,body{background:#fff!important}
  .pd-root{position:static;overflow:visible;display:block;background:none}
  .pd-nav{display:none!important}
  .pd-stage,.pd-stage[data-active]{display:block!important;width:1600px!important;height:900px!important;min-height:0;
    padding:64px 80px 80px;overflow:hidden;break-after:page;page-break-after:always;
    -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .pd-g2{grid-template-columns:1fr 1fr}
  .pd-g3{grid-template-columns:repeat(3,1fr)}
  .pd-g4{grid-template-columns:repeat(4,1fr)}
  .pd-arch{grid-template-columns:1fr auto 1fr;align-items:stretch}
  .pd-url{font-size:2.6cqw;white-space:nowrap}
  .pd-stage:last-of-type{break-after:auto;page-break-after:auto}
  .pd-close{flex-direction:row;align-items:center;gap:5cqw;height:100%}
  .pd-qr{width:36cqw;flex:none;margin:0}
  .pd-qr-sm{width:26cqw}
  .pd-title-main{gap:1.6cqw;flex:1}
  .pd-inner{gap:2.2cqw}.pd-kicker{font-size:1.3cqw}.pd-hero{font-size:9cqw}.pd-h1{font-size:3.1cqw}.pd-h2{font-size:2.2cqw}
  .pd-h3{font-size:1.45cqw}.pd-p{font-size:2.05cqw}.pd-sm{font-size:1.45cqw}.pd-big{font-size:3.8cqw}
  .pd-grid,.pd-stack,.pd-arch{gap:2cqw}.pd-card{padding:1.6cqw}.pd-center{min-height:0;height:100%}
  .pd-bird{width:5cqw}.pd-bird-lg{width:8cqw}.pd-bar{font-size:1.2cqw}.pd-num{font-size:1cqw;right:2cqw;top:1.6cqw}
}
`;

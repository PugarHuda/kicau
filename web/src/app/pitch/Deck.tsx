"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { birdDataUri } from "@/lib/birds";
import { KICAU_ADDRESS } from "@/lib/config";
import { qrSvgPath } from "./qr";

export type LiveStats = { birds: number; conservation: string; players: number };

const LIVE = "https://kicau.xyz";
const LIVE_SHORT = "kicau.xyz";
const REPO = "github.com/PugarHuda/kicau";
const CONTRACT = KICAU_ADDRESS; // testnet (used by the app); follows NEXT_PUBLIC_KICAU_ADDRESS on redeploy
const MAINNET = "0xdada618e564edaf7ec0af0a12575bf3c0dc8523b"; // chain 143
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

function slides(wing: boolean, stats: LiveStats | null): { dark?: boolean; body: ReactNode }[] {
  return [
    {
      dark: true,
      body: (
        <div className="pd-center">
          <div className="pd-birdrow">
            {[0, 1, 2, 3, 4].map((i) => (
              <Bird key={i} id={i} wing={(i % 2 === 0) === wing} size="pd-bird-lg" />
            ))}
          </div>
          <h1 className="font-display pd-hero">KICAU</h1>
          <p className="font-display pd-h2 pd-sun">Keep the song, not the cage.</p>
          <p className="pd-p">
            GameFi + ReFi with a real-world provenance layer: on-chain pedigrees and organizer-attested championship
            records for Indonesian songbirds. Built on Monad.
          </p>
          <p className="pd-sm pd-mt">
            Monad Blitz Jogja 2026 · {LIVE_SHORT} · {REPO}
          </p>
        </div>
      ),
    },
    {
      body: (
        <>
          <Kicker>01 · Problem</Kicker>
          <h2 className="font-display pd-h1">Indonesia loves songbirds to death.</h2>
          <div className="pd-grid pd-g3">
            <Card title="Kicau mania">
              A massive national hobby. Weekly <b>gantangan</b> songbird contests in every city.
            </Card>
            <Card title="Poaching" tone="clay">
              <div className="pd-birdrow pd-left">
                <Bird id={3} wing={wing} />
                <Bird id={4} wing={!wing} />
              </div>
              Demand for champion singers empties forests. Straw-headed bulbul &amp; Bali myna are{" "}
              <b>Critically Endangered</b> (IUCN).
            </Card>
            <Card title="Paper pedigrees">
              Champion titles and lineage are unverifiable claims on paper.
            </Card>
          </div>
        </>
      ),
    },
    {
      body: (
        <>
          <Kicker>02 · Solution · GameFi + ReFi + provenance</Kicker>
          <h2 className="font-display pd-h1">Play, protect, prove.</h2>
          <div className="pd-grid pd-g3">
            <Card title="① Adopt · ReFi">
              <p className="font-display pd-big pd-leaf">30%</p>
              of every digital songbird NFT goes to conservation <b>in the same tx</b>. Support = <b>100%</b>.
            </Card>
            <Card title="② Fly · GameFi">
              <p className="font-display pd-big pd-leaf">Flappy</p>
              Each species flies with its own on-chain stats. Scores land on an on-chain leaderboard.
            </Card>
            <Card title="③ Register · Provenance">
              <p className="font-display pd-big pd-leaf">Pedigree</p>
              Your real bird: photo → pixel character + titles, certificate &amp; lineage on-chain. Contest organizers
              attest championship titles.
            </Card>
          </div>
          <p className="pd-sm pd-mt">
            Digital collectibles + verifiable records — never ownership or trade of live animals.
          </p>
        </>
      ),
    },
    {
      body: (
        <>
          <Kicker>03 · Product tour → live demo</Kicker>
          <h2 className="font-display pd-h1">From shelter to podium.</h2>
          <div className="pd-grid pd-g3">
            <Card title="1 · Shelter">Kicau Garden: birds waiting for adoption.</Card>
            <Card title="2 · Bird card">Real singing video, IUCN status, game stats.</Card>
            <Card title="3 · Adopt / Support">One tap, confirmed in ~0.8 s, no popup.</Card>
            <Card title="4 · Flappy">Species stats change how your bird flies.</Card>
            <Card title="5 · Contests">Host a gantangan, judges score on-chain, live board, auto payout.</Card>
            <Card title="6 · Register">Photo → pixel bird + titles, certificate, lineage.</Card>
          </div>
        </>
      ),
    },
    {
      dark: true,
      body: (
        <>
          <Kicker>04 · Why Monad</Kicker>
          <h2 className="font-display pd-h1">Built on what only Monad does.</h2>
          <div className="pd-grid pd-g2">
            <div className="pd-card pd-ink">
              <p className="font-display pd-big pd-sun">~540 ms</p>
              <p className="pd-p">
                <b>LIVE KICAU</b> via <code>monadLogs</code> speculative subscription: Proposed → Voted → Finalized.
              </p>
              <div className="pd-bars">
                <span className="pd-bar pd-bar-sun" style={{ width: "51%" }}>monadLogs 540</span>
                <span className="pd-bar" style={{ width: "100%" }}>eth logs 1,050 ms</span>
              </div>
              <p className="pd-sm">≈ 2× faster than eth_subscribe logs</p>
            </div>
            <div className="pd-card pd-ink">
              <p className="font-display pd-big pd-sun">~0.8 s</p>
              <p className="pd-p">
                <b>⚡ Quick Play</b>: browser burner + <code>eth_sendRawTransactionSync</code>. Receipt in one call,{" "}
                <b>zero popups</b>.
              </p>
            </div>
            <div className="pd-card pd-ink">
              <p className="font-display pd-big pd-sun">Per-slot</p>
              <p className="pd-p">
                Parallel-execution-friendly hot paths: scores, supports and judge scores write per-player / per-token /
                per-(contest, bird, judge) slots. Only mints and run IDs bump a counter.
              </p>
            </div>
            <div className="pd-card pd-ink">
              <p className="font-display pd-big pd-sun">21 bytes</p>
              <p className="pd-p">
                Pedigree = palette + JSON in <b>event logs</b>, read from one block. <b>No indexer.</b>
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
              <h3 className="font-display pd-h3">Browser</h3>
              <ul className="pd-p pd-list">
                <li>Next.js 15 on Vercel</li>
                <li>wagmi / viem</li>
                <li>canvas Flappy game</li>
                <li>⚡ burner wallet</li>
              </ul>
            </div>
            <div className="pd-arrows pd-sm">
              <span>tx → eth_sendRawTransactionSync →</span>
              <span>← WebSocket monadLogs (Proposed) ←</span>
              <span>← reads: leaderboard, species ←</span>
            </div>
            <div className="pd-card pd-leafbg">
              <h3 className="font-display pd-h3">Monad testnet</h3>
              <ul className="pd-p pd-list">
                <li>Kicau.sol · ERC-721 Enumerable</li>
                <li>buy → 30% split</li>
                <li>support → 100%</li>
                <li>startRun / submitRun · verified runs</li>
                <li>registerBird → event log</li>
                <li>contests: enter · score · finalize</li>
              </ul>
            </div>
          </div>
          <p className="pd-sm pd-mt">
            + 3 API routes (faucet, AI species ID, x402 certificate) · public JSON API · devnads faucet + verify API
            <br />
            testnet <span className="pd-mono">{CONTRACT}</span> · mainnet <span className="pd-mono">{MAINNET}</span> · both
            verified on MonadVision + Monadscan
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
            <div className="pd-grid pd-g3">
              <Card title="Birds on chain">
                <p className="font-display pd-big pd-leaf">{stats.birds}</p>
              </Card>
              <Card title="MON to conservation">
                <p className="font-display pd-big pd-leaf">{stats.conservation}</p>
              </Card>
              <Card title="Leaderboard players">
                <p className="font-display pd-big pd-leaf">{stats.players}</p>
              </Card>
            </div>
          )}
          <ul className="pd-p pd-checks">
            {stats && <li>Numbers above read live from Monad testnet when this page rendered</li>}
            <li>Contract verified on MonadVision + Monadscan, testnet and mainnet</li>
            <li>46 Foundry tests (incl. fuzz + reentrancy) · Playwright E2E with real testnet transactions</li>
            <li>Build in public on X: @BangDropID</li>
          </ul>
        </>
      ),
    },
    {
      body: (
        <>
          <Kicker>07 · Business model</Kicker>
          <h2 className="font-display pd-h1">Hobbyists pay to compete.</h2>
          <div className="pd-grid pd-g2">
            <div className="pd-stack">
              <Card title="70% of adoptions → treasury">30% to conservation, split by the contract in the same tx.</Card>
              <Card title="Registration fee">Mint your real bird&apos;s on-chain profile.</Card>
              <Card title="x402 certificate · live">$0.01 USDC per printable pedigree, settled gasless to the treasury.</Card>
              <Card title="Contest entry fees · live">On-chain gantangan: 90% prizes, 10% conservation.</Card>
            </div>
            <div className="pd-stack">
              <Card title="Paid attestations · planned" tone="sun">
                Contest organizers sign champion titles → verified pedigree.
              </Card>
              <Card title="Sponsored contests · planned">Sponsor-branded contests &amp; prize pools for bird brands.</Card>
              <Card title="Market" tone="leafbg">
                The kicau mania community: a nationwide Indonesian hobby with weekly gantangan contests.
              </Card>
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
              Contests with on-chain judging + payouts, organizer-attested titles, x402 certificates, Kicau Value. Testnet
              app; contract also on mainnet.
            </Card>
            <Card title="Next">Pilot with a real gantangan organizer: verified-organizer onboarding, printed QR results.</Card>
            <Card title="Then">Full replay verification of seeded Flappy runs (today: on-chain time bound).</Card>
            <Card title="Later">Mainnet app + conservation partner wallet. Unity client.</Card>
          </div>
        </>
      ),
    },
    {
      dark: true,
      body: (
        <div className="pd-close">
          <a href={LIVE} className="pd-qr" aria-label={`Open ${LIVE_SHORT}`}>
            <svg viewBox={`0 0 ${QR.size} ${QR.size}`} shapeRendering="crispEdges" role="img" aria-label="QR code">
              <rect width={QR.size} height={QR.size} fill="#fffdf7" />
              <path d={QR.d} fill="#1e2a1f" />
            </svg>
          </a>
          <div>
            <Kicker>Try it now</Kicker>
            <p className="font-display pd-url pd-sun">{LIVE_SHORT}</p>
            <ul className="pd-p pd-list">
              <li>{REPO}</li>
              <li className="pd-mono pd-break">{CONTRACT}</li>
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
  .pd-inner{gap:2.2cqw}.pd-kicker{font-size:1.3cqw}.pd-hero{font-size:9cqw}.pd-h1{font-size:3.1cqw}.pd-h2{font-size:2.2cqw}
  .pd-h3{font-size:1.45cqw}.pd-p{font-size:2.05cqw}.pd-sm{font-size:1.45cqw}.pd-big{font-size:3.8cqw}
  .pd-grid,.pd-stack,.pd-arch{gap:2cqw}.pd-card{padding:1.6cqw}.pd-center{min-height:0;height:100%}
  .pd-bird{width:5cqw}.pd-bird-lg{width:8cqw}.pd-bar{font-size:1.2cqw}.pd-num{font-size:1cqw;right:2cqw;top:1.6cqw}
}
`;

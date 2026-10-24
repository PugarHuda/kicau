"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { birdDataUri } from "@/lib/birds";
import { NET } from "@/lib/network";
import { qrSvgPath } from "./qr";

export type LiveStats = { birds: number; conservation: string; players: number; contests: number };

const LIVE = "https://kicau.xyz";
const LIVE_SHORT = "kicau.xyz";
const MAIN_SHORT = "mainnet.kicau.xyz";
const REPO = "github.com/PugarHuda/kicau";
const TESTNET = "0x947929841Ba8154BB6E9BDeb35137d159c6A0F58"; // chain 10143, verified
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

const DEMO = "/demo/kicau-demo.mp4";
const POSTER = "/demo/kicau-demo-poster.jpg";

function Demo() {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (v && (v.error || v.networkState === HTMLMediaElement.NETWORK_NO_SOURCE)) setFailed(true);
  }, []);
  if (failed)
    return (
      <div className="pd-card pd-ink pd-video pd-ph">
        <p className="font-display pd-big pd-sun">▶</p>
        <p className="font-display pd-h3">Demo video</p>
      </div>
    );
  return (
    <div className="pd-video">
      <video ref={ref} src={DEMO} poster={POSTER} controls preload="metadata" playsInline onError={() => setFailed(true)} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={POSTER} alt="Demo video" className="pd-print-only" />
    </div>
  );
}

function Tag({ k }: { k: "live" | "flow" | "proposed" }) {
  return <span className={`font-display pd-tag pd-tag-${k}`}>{k === "flow" ? "ecosystem" : k}</span>;
}

function slides(wing: boolean, stats: LiveStats | null): { dark?: boolean; body: ReactNode }[] {
  return [
    // 1 · Hook
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
            <h1 className="font-display pd-h1 pd-hook">This bird isn&apos;t a pet. It&apos;s an unpaid athlete.</h1>
            <p className="font-display pd-h2 pd-sun">Keep the song, not the cage.</p>
            <p className="pd-p">
              <b>KICAU</b> · the on-chain record for real-life songbird contests · built on Monad
            </p>
            <p className="font-display pd-url pd-sun">{LIVE_SHORT}</p>
            <p className="pd-sm">Monad Blitz Jogja 2026 · {REPO}</p>
          </div>
          <Qr className="pd-qr pd-qr-sm" />
        </div>
      ),
    },
    // 2 · Market + problem
    {
      body: (
        <>
          <Kicker>01 · Market + problem</Kicker>
          <h2 className="font-display pd-h1">A bird&apos;s pedigree sets its value — and paper can be forged.</h2>
          <div className="pd-grid pd-g3 pd-g3w">
            <Card title="Big, everyday market">
              <p className="font-display pd-big pd-bs pd-leaf">Rp 1.7–2 T*</p>
              songbird economy per year. <b>66–84 M</b> caged birds, ~1/3 of Java households. Weekly <b>gantangan</b> contests in every city.
              Rp 12.5 B ornamental bird exports in 2025*.
            </Card>
            <Card title="Fed by the wild" tone="clay">
              <p className="font-display pd-big pd-bs">134,515*</p>
              birds seized 2023–2025*, 70.21% from Sumatra*; 771 seizure cases. 9,219 rescued in 2025*. Bali myna &amp; straw-headed
              bulbul: <b>Critically Endangered</b>.
            </Card>
            <Card title="No trusted record">
              <div className="pd-birdrow pd-left">
                <Bird id={3} wing={wing} />
                <Bird id={4} wing={!wing} />
              </div>
              Scores on paper, titles and pedigree papers nobody can check. A forged pedigree hides a wild-caught bird.
            </Card>
          </div>
          <p className="pd-xs pd-mt">
            Sources: Ministry of Trade · Tempo.co · seizures: FLIGHT via Kompas.id, Garda Animalia (2023–2025) · Marshall
            et al. 2020, Biological Conservation · IUCN Red List · * as reported by cited sources
          </p>
        </>
      ),
    },
    // 3 · Solution
    {
      body: (
        <>
          <Kicker>02 · Solution</Kicker>
          <h2 className="font-display pd-h1">A verified record that travels with the bird.</h2>
          <p className="pd-p">
            On-chain contest results + organizer-attested titles + certificate fingerprints shift value from
            wild-caught to legally bred birds. <b>30%</b> of adoptions &amp; registrations goes to conservation in the
            same tx.
          </p>
          <div className="pd-grid pd-g2">
            <Card title="Door A · real bird owners" tone="leafbg">
              Photo → AI species ID → pixel character + verified record. Enter contests; <b>Kicau Value</b> grows with
              every result. Track it all in <b>My Dashboard</b>.
            </Card>
            <Card title="Door B · everyone">
              Kicau Garden, adopt a species, verified Flappy runs, daily/weekly leaderboards + weekly prize pool.
            </Card>
          </div>
          <p className="pd-sm pd-mt">Records and collectibles. Never ownership or trade of live animals.</p>
        </>
      ),
    },
    // 4 · Live demo
    {
      dark: true,
      body: (
        <>
          <Kicker>03 · Live demo · kicau.xyz/lomba/0</Kicker>
          <div className="pd-demo">
            <Demo />
            <ul className="pd-li pd-list">
              <li>Judges score at the venue · one tx per score</li>
              <li>Every viewer&apos;s scoreboard updates in ~1 s (monadLogs)</li>
              <li>
                <b>Finalize</b> → instant prizes + &quot;Juara&quot; attested, same tx
              </li>
              <li>Also: register a bird, Kicau Value, pedigree, My Dashboard, mainnet</li>
            </ul>
          </div>
          <p className="font-display pd-h2 pd-sun pd-mt">Live on stage: we finalize contest #0 now.</p>
        </>
      ),
    },
    // 5 · Why Monad
    {
      dark: true,
      body: (
        <>
          <Kicker>04 · Why Monad · measured today</Kicker>
          <h2 className="font-display pd-h1">One tx per judge score only works here.</h2>
          <div className="pd-grid pd-g3">
            <div className="pd-card pd-ink">
              <p className="font-display pd-big pd-sun">~1 s</p>
              <p className="pd-p">
                Judge click → every scoreboard, via <code>monadLogs</code> speculative feed.
              </p>
            </div>
            <div className="pd-card pd-ink">
              <p className="font-display pd-big pd-sun">&lt;1.5 s</p>
              <p className="pd-p">
                Tx receipt in one call: <code>eth_sendRawTransactionSync</code>.
              </p>
            </div>
            <div className="pd-card pd-ink">
              <p className="font-display pd-big pd-sun">1 tx</p>
              <p className="pd-p">per judge score · per game run · per sponsor. Viable at Monad cost + speed.</p>
            </div>
          </div>
          <ul className="pd-p pd-checks">
            <li>x402 certificates via the Monad facilitator</li>
            <li>Contracts verified on testnet + mainnet · 60 Foundry tests</li>
            {stats && (
              <li>
                Live now ({NET.label}): {stats.contests} contests · {stats.birds} birds · {stats.conservation} MON to
                conservation
              </li>
            )}
          </ul>
        </>
      ),
    },
    // 6 · Revenue
    {
      body: (
        <>
          <Kicker>05 · Revenue model · matches Kicau.sol</Kicker>
          <h2 className="font-display pd-h1">Trust is the product.</h2>
          <div className="pd-grid pd-g3">
            <div className="pd-card pd-paper">
              <h3 className="font-display pd-h3">
                <Tag k="live" /> on-chain today
              </h3>
              <ul className="pd-li pd-list">
                <li>Bird registration 0.005 MON · 70% treasury / 30% conservation</li>
                <li>Species adoption · 70% treasury / 30% conservation</li>
                <li>x402 certificate $0.01 USDC → treasury</li>
              </ul>
            </div>
            <div className="pd-card pd-paper">
              <h3 className="font-display pd-h3">
                <Tag k="flow" /> not our revenue
              </h3>
              <ul className="pd-li pd-list">
                <li>Contest entry fees → 50/25/15 to winners&apos; keepers, rest to conservation</li>
                <li>Sponsorships → 70% keeper / 30% conservation</li>
                <li>Weekly prize pool (funded via fundRewards)</li>
              </ul>
            </div>
            <div className="pd-card pd-paper">
              <h3 className="font-display pd-h3">
                <Tag k="proposed" /> next
              </h3>
              <ul className="pd-li pd-list">
                <li>Contest platform fee · Verified Organizer SaaS for clubs</li>
                <li>Certificate verification fee · ERC-2981 resale royalty</li>
                <li>Brand-sponsored prize pools · data API / x402 per call</li>
                <li>AI species ID per call · Flappy tournament fees</li>
                <li>Breeder featured listings · game cosmetics</li>
              </ul>
            </div>
          </div>
          <p className="pd-sm pd-mt">
            Loop: wins → higher Kicau Value → sponsors &amp; entries → fees &amp; pool → more players.
          </p>
        </>
      ),
    },
    // 7 · Strategy + risks
    {
      body: (
        <>
          <Kicker>06 · Strategy + risks</Kicker>
          <h2 className="font-display pd-h1">Start in Jogja. Earn trust first.</h2>
          <div className="pd-grid pd-g4">
            <Card title="0–3 mo" tone="leafbg">
              Users + 1–2 pilot gantangan clubs in Jogja (Dev Web3 network). Low prices.
            </Card>
            <Card title="3–6 mo">Contest platform fee + Verified Organizer.</Card>
            <Card title="6–12 mo">Brand sponsorships, data API, certificate verification.</Card>
            <Card title="12+ mo">Royalties + tournaments.</Card>
          </div>
          <div className="pd-card pd-paper">
            <h3 className="font-display pd-h3">Risks</h3>
            <ul className="pd-li pd-list">
              <li>MON price → convert part of treasury to stablecoins</li>
              <li>B2B fees need real partners → not counted as early revenue</li>
              <li>Conservation wallet moves to a partner via setConservationWallet</li>
            </ul>
          </div>
        </>
      ),
    },
    // 8 · Closing
    {
      dark: true,
      body: (
        <div className="pd-close">
          <Qr />
          <div>
            <Kicker>Keep the song. Not the cage.</Kicker>
            <p className="font-display pd-url pd-sun">{LIVE_SHORT}</p>
            <ul className="pd-li pd-list">
              <li>mainnet app: {MAIN_SHORT}</li>
              <li>{REPO}</li>
              <li>
                testnet <span className="pd-mono pd-break">{TESTNET}</span>
              </li>
              <li>
                mainnet <span className="pd-mono pd-break">{MAINNET}</span>
              </li>
              <li>Team: @BangDropID &amp; @maziazi</li>
            </ul>
            <p className="pd-sm pd-mt">Thanks @monad @monad_dev @geeky_kartikey @devweb3jogja</p>
            <p className="pd-xs">
              Data: Ministry of Trade · Tempo.co · FLIGHT via Kompas.id · Garda Animalia · Marshall et al. 2020 · IUCN Red List
            </p>
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
      if ((e.target as HTMLElement).closest?.("video")) return; // Space/arrows control the video
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
    if ((e.target as HTMLElement).closest("a,button,code,video,.pd-mono")) return;
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
.pd-xs{font-size:.75rem;opacity:.7}
.pd-li{font-size:1rem;line-height:1.35}
.pd-hook{font-size:1.6rem;line-height:1.25!important}
.pd-tag{display:inline-block;font-size:.6rem;padding:2px 6px;margin-right:6px;text-transform:uppercase;vertical-align:middle}
.pd-tag-live{background:var(--leaf);color:var(--paper)}
.pd-tag-flow{background:var(--muted);color:var(--paper)}
.pd-tag-proposed{background:var(--sun);color:var(--ink)}
.pd-demo{display:grid;gap:12px;grid-template-columns:1fr}
.pd-video{border:3px solid var(--paper);box-shadow:4px 4px 0 var(--sun);background:#000;aspect-ratio:16/9}
.pd-video video,.pd-video img{display:block;width:100%;height:100%;object-fit:contain}
.pd-ph{display:flex;flex-direction:column;align-items:center;justify-content:center}
.pd-print-only{display:none!important}
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
  .pd-xs{font-size:1.1cqw}
  .pd-g3w{grid-template-columns:1.3fr 1.1fr .8fr}
  .pd-bs{font-size:3cqw}
  .pd-demo{grid-template-columns:1.9fr 1fr;gap:2.4cqw;align-items:center}
  .pd-video{border-width:.4cqw;box-shadow:.6cqw .6cqw 0 var(--sun)}
  .pd-li{font-size:1.6cqw}
  .pd-hook{font-size:4.6cqw}
  .pd-tag{font-size:1cqw;padding:.3cqw .6cqw;margin-right:.6cqw}
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
  .pd-demo{display:grid;grid-template-columns:1.9fr 1fr;gap:2.4cqw;align-items:center}
  .pd-video video{display:none!important}.pd-video .pd-print-only{display:block!important}
  .pd-g3w{grid-template-columns:1.3fr 1.1fr .8fr}.pd-bs{font-size:3cqw}
  .pd-xs{font-size:1.1cqw}.pd-li{font-size:1.6cqw}.pd-hook{font-size:4.6cqw}.pd-tag{font-size:1cqw}
  .pd-grid,.pd-stack,.pd-arch{gap:2cqw}.pd-card{padding:1.6cqw}.pd-center{min-height:0;height:100%}
  .pd-bird{width:5cqw}.pd-bird-lg{width:8cqw}.pd-bar{font-size:1.2cqw}.pd-num{font-size:1cqw;right:2cqw;top:1.6cqw}
}
`;

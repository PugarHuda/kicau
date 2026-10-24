import Link from "next/link";
import { birdDataUri } from "@/lib/birds";

// Small pixel illustrations, drawn on a 24×24 grid.
const Px = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" className="h-14 w-14" shapeRendering="crispEdges" aria-hidden>
    {children}
  </svg>
);

const ART = {
  scan: (
    <Px>
      <image href={birdDataUri(2)} x={0} y={4} width={24} height={18} />
      <path fill="#b5532a" d="M0 0h6v2H2v4H0zM18 0h6v6h-2V2h-4zM0 18h2v4h4v2H0zM22 18h2v6h-6v-2h4z" />
    </Px>
  ),
  score: (
    <Px>
      <path fill="#1e2a1f" d="M3 2h18v20H3z" />
      <path fill="#fffdf7" d="M5 4h14v16H5z" />
      <path fill="#2f6b3a" d="M7 7h4v2H7zM7 11h7v2H7zM7 15h5v2H7z" />
      <path fill="#e8a33d" d="M15 6h2v4h-2zM16 14h2v4h-2z" />
      <path fill="#8a5a2b" d="M9 1h6v3H9z" />
    </Px>
  ),
  prize: (
    <Px>
      <path fill="#e8a33d" d="M5 2h14v2h3v5h-2v2h-2v2h-2v2h-2v3h4v4H6v-4h4v-3H8v-2H6v-2H4V9H2V4h3z" />
      <path fill="#f6c25b" d="M7 4h4v7H9V9H7z" />
      <path fill="#fffdf7" d="M4 6h1v3H4zM19 6h1v3h-1z" />
    </Px>
  ),
  grow: (
    <Px>
      <path fill="#1e2a1f" d="M1 22h22v1H1z" />
      <path fill="#86bb80" d="M3 16h4v6H3z" />
      <path fill="#2f6b3a" d="M9 11h4v11H9z" />
      <path fill="#24552e" d="M15 5h4v17h-4z" />
      <path fill="#b5532a" d="M18 1h2v2h2v2h-2v2h-2V5h-2V3h2z" />
    </Px>
  ),
};

const STEPS = [
  { art: ART.scan, title: "Register your real bird", body: "Upload a photo. AI identifies the species and turns your bird into a pixel character with its own NFT." },
  { art: ART.score, title: "Judges score it live", body: "At the gantangan, every judge's score lands on Monad as it's given. The scoreboard updates in real time." },
  { art: ART.prize, title: "Prizes + titles on-chain", body: "Winners are paid instantly to the keeper's wallet, and the champion title becomes verifiable pedigree." },
  { art: ART.grow, title: "Value grows, fans sponsor", body: "Each win raises the bird's Kicau Value. Sponsors back champions: 70% to the keeper, 30% to conservation." },
];

const STACK = [
  { name: "monadLogs", what: "live scoreboard from speculative blocks" },
  { name: "eth_sendRawTransactionSync", what: "receipt in one call, no polling" },
  { name: "x402", what: "pay-per-download pedigree certificates" },
  { name: "Chainlink", what: "MON/USD for conservation totals" },
];

export function HowItWorks() {
  return (
    <section className="py-14">
      <p className="eyebrow mb-3">How it works</p>
      <h2 className="mb-8 max-w-2xl font-display text-3xl">From the contest pole to the chain</h2>
      <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="step-card relative flex gap-4 border-[3px] border-ink bg-paper p-4 pt-6 sm:block sm:p-5 sm:pt-6">
            <span className="step-no font-display">{i + 1}</span>
            <div className="grid h-20 w-20 shrink-0 place-items-center bg-cream sm:mb-4 sm:w-auto">{s.art}</div>
            <div>
              <h3 className="mb-2 font-display text-[0.7rem] leading-relaxed">{s.title}</h3>
              <p className="text-[0.95rem] leading-snug text-muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-col gap-3 border-t-[3px] border-dashed border-ink/30 pt-6 lg:flex-row lg:items-center">
        <Link href="/pitch" className="shrink-0 font-display text-[0.65rem] uppercase underline decoration-2 underline-offset-4 hover:text-leaf">
          Built on Monad →
        </Link>
        <ul className="flex flex-wrap gap-2">
          {STACK.map((t) => (
            <li key={t.name} className="border-2 border-ink bg-paper px-2 py-1 text-sm" title={t.what}>
              <span className="font-mono font-semibold">{t.name}</span>
              <span className="text-muted"> · {t.what}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

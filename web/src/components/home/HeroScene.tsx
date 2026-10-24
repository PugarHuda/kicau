import { birdDataUri } from "@/lib/birds";

// Decorative hero backdrop: a gantangan (contest pole) at dawn. Every cage door is open and the
// birds sit on top: "keep the song, not the cage". Pure SVG + CSS, motion off under reduced-motion.

const CAGES = [
  { cx: 40, bird: 0, open: true },
  { cx: 82, bird: 2, open: false },
  { cx: 124, bird: 4, open: true },
  { cx: 166, bird: 3, open: true },
];

function Cloud({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 32 12" className={className} shapeRendering="crispEdges">
      <path fill="#fffdf7" d="M8 2h8v2h4v2h6v2h4v4H0V8h4V4h4z" />
      <path fill="#dcebf0" d="M0 10h30v2H0z" />
    </svg>
  );
}

function Bird({ id, x, y, flap = false, delay = 0 }: { id: number; x: number; y: number; flap?: boolean; delay?: number }) {
  return (
    <g className="hs-bob" style={{ animationDelay: `${delay}s` }}>
      <image href={birdDataUri(id)} x={x} y={y} width={24} height={18} />
      {flap && <image className="hs-flap" href={birdDataUri(id, true)} x={x} y={y} width={24} height={18} style={{ animationDelay: `${delay}s` }} />}
    </g>
  );
}

function Cage({ cx, bird, open, n }: { cx: number; bird: number; open: boolean; n: number }) {
  const top = 40;
  const bars = Array.from({ length: 7 }, (_, i) => cx - 11 + i * 4);
  return (
    <g className="hs-sway" style={{ transformOrigin: `${cx}px 16px`, animationDelay: `${n * -0.7}s` }}>
      <rect x={cx} y={16} width={1} height={top - 18} fill="#5a3b1c" />
      {/* dome */}
      <rect x={cx - 6} y={top - 4} width={12} height={2} fill="#8a5a2b" />
      <rect x={cx - 10} y={top - 2} width={20} height={2} fill="#8a5a2b" />
      <rect x={cx - 13} y={top} width={26} height={2} fill="#8a5a2b" />
      {/* bars */}
      {bars.map((x) => (
        <rect key={x} x={x} y={top + 2} width={1} height={26} fill="#6b4423" />
      ))}
      <rect x={cx - 13} y={top + 12} width={26} height={1} fill="#6b4423" opacity={0.6} />
      {/* tray */}
      <rect x={cx - 14} y={top + 28} width={28} height={4} fill="#8a5a2b" />
      <rect x={cx - 14} y={top + 31} width={28} height={1} fill="#5a3b1c" />
      {/* open door swung out to the side */}
      {open && (
        <>
          <rect x={cx - 3} y={top + 10} width={7} height={14} fill="#f6eccd" opacity={0.55} />
          <rect x={cx + 14} y={top + 9} width={1} height={15} fill="#6b4423" />
          <rect x={cx + 17} y={top + 9} width={1} height={15} fill="#6b4423" />
          <rect x={cx + 14} y={top + 9} width={4} height={1} fill="#8a5a2b" />
          <rect x={cx + 14} y={top + 23} width={4} height={1} fill="#8a5a2b" />
        </>
      )}
      {!open && <Bird id={bird} x={cx - 12} y={top + 9} delay={n * 0.3} />}
      {/* gantangan number tag: the entry number judges score */}
      <rect x={cx - 5} y={top + 33} width={10} height={9} fill="#fffdf7" stroke="#1e2a1f" strokeWidth={1} />
      <text x={cx} y={top + 40.5} textAnchor="middle" fontSize={6} fill="#1e2a1f" className="font-display">
        {n + 1}
      </text>
      {open && <Bird id={bird} x={cx - 12} y={top - 19} flap={n === 2} delay={n * 0.4} />}
    </g>
  );
}

export function HeroScene() {
  return (
    <div aria-hidden className="hs-root pointer-events-none absolute inset-0 overflow-hidden">
      {/* sun */}
      <svg viewBox="0 0 16 16" className="absolute bottom-[270px] right-[8%] w-12 sm:bottom-[330px] lg:bottom-auto lg:left-[56%] lg:right-auto lg:top-[6%] lg:w-20" shapeRendering="crispEdges">
        <path fill="#f6c25b" d="M5 0h6v1h2v2h1v2h1v6h-1v2h-1v2h-2v1H5v-1H3v-2H2v-2H1V5h1V3h1V1h2z" />
        <path fill="#e8a33d" d="M3 11h10v2h-1v2h-2v1H6v-1H4v-2H3z" />
      </svg>
      {/* clouds, three depths */}
      <Cloud className="hs-cloud hs-cloud-far absolute top-[14%] w-20 opacity-80" />
      <Cloud className="hs-cloud hs-cloud-mid absolute top-[26%] w-32" />
      <Cloud className="hs-cloud hs-cloud-near absolute top-[6%] w-44" />
      {/* hills */}
      <svg viewBox="0 0 320 60" preserveAspectRatio="none" className="absolute inset-x-0 bottom-12 h-[38%] w-full" shapeRendering="crispEdges">
        <path fill="#b6d6bc" d="M0 26h20v-6h18v-6h26v6h22v8h30v-10h24v-8h30v8h20v10h28v-6h26v-10h22v10h24v8h30v38H0z" />
        <path fill="#86bb80" d="M0 40h34v-6h30v-4h28v6h26v6h34v-8h28v-6h30v8h22v6h30v-6h26v4h32v20H0z" />
      </svg>
      {/* ground */}
      <div className="hs-ground absolute inset-x-0 bottom-0 h-12" />
      {/* gantangan: two bamboo poles, a crossbar, numbered cages */}
      <svg
        viewBox="0 0 200 150"
        className="absolute bottom-11 right-0 w-full max-w-[640px] lg:right-[2%] lg:w-[52%] lg:max-w-[720px] 2xl:right-[calc(50%-40rem)] 2xl:max-w-[620px]"
        shapeRendering="crispEdges"
      >
        {[6, 190].map((x) => (
          <g key={x}>
            <rect x={x} y={10} width={4} height={140} fill="#d2b04c" />
            <rect x={x + 3} y={10} width={1} height={140} fill="#b08f35" />
            {[30, 54, 78, 102, 126].map((y) => (
              <rect key={y} x={x - 1} y={y} width={6} height={2} fill="#9c7a2a" />
            ))}
          </g>
        ))}
        <rect x={2} y={12} width={196} height={4} fill="#d2b04c" />
        <rect x={2} y={15} width={196} height={1} fill="#9c7a2a" />
        {[50, 100, 150].map((x) => (
          <rect key={x} x={x} y={11} width={2} height={6} fill="#9c7a2a" />
        ))}
        <Bird id={1} x={96} y={-4} delay={0.9} />
        {CAGES.map((c, n) => (
          <Cage key={c.cx} {...c} n={n} />
        ))}
      </svg>
      {/* the one that flew out */}
      <div className="hs-flyer absolute bottom-[300px] w-12 sm:bottom-[360px] sm:w-14 lg:bottom-auto lg:top-[30%] lg:w-16">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={birdDataUri(1)} alt="" className="w-full" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={birdDataUri(1, true)} alt="" className="hs-flap absolute inset-0 w-full" />
      </div>
    </div>
  );
}

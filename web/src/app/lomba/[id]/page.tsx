import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NET } from "@/lib/network";
import { ADDRESS, parseId, readContest } from "@/lib/publicData";

// Shareable, server-rendered result page per contest (X / WhatsApp preview via ./opengraph-image.tsx). Live chain reads.
export const revalidate = 15;

type Props = { params: Promise<{ id: string }> };
const MEDAL = ["🥇", "🥈", "🥉"];
const EXPLORER = NET.explorer;

async function load(raw: string) {
  const id = parseId(raw);
  return id === null ? null : readContest(id).catch(() => null);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await load((await params).id);
  if (!c) return { title: "Kicau contest" };
  const lead = c.entries[0];
  const title = `${c.name} · ${c.class} — Kicau`;
  const description =
    c.status === "Finalized" && lead
      ? `🥇 ${lead.name} (${lead.total} pts) · ${c.entries.length} birds · ${c.poolMon} MON pool · results recorded on Monad.`
      : `${c.status} · ${c.entries.length} birds · ${c.poolMon} MON pool · every judge score is on-chain on Monad.`;
  return { title, description, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
}

export default async function ContestShare({ params }: Props) {
  const raw = (await params).id;
  const c = await load(raw);
  if (!c) notFound();
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/lomba" className="btn-ghost !px-2 !py-2 !text-[0.6rem]">
          ← Contests
        </Link>
        <span className="text-xs text-muted">Contest #{c.id} · {c.status}</span>
      </header>
      <section className="mb-4 rounded-3xl border border-line bg-paper p-4 sm:p-6">
        <span className="border-[3px] border-ink bg-cream px-2 py-0.5 text-xs font-bold">{c.class}</span>
        <h1 className="my-3 break-words font-display text-2xl sm:text-3xl">{c.name}</h1>
        <p className="text-sm text-muted">
          Pool {c.poolMon} MON · entry {c.entryFeeMon} MON · {c.entries.length} birds · {c.judges.length} judge(s)
          {c.verifiedOrganizer && <> · verified organizer “{c.verifiedOrganizer}”</>}
        </p>
      </section>
      <section className="mb-4 rounded-3xl border border-line bg-paper p-4 sm:p-6">
        <h2 className="mb-3 font-display text-xl">{c.status === "Finalized" ? "Final results" : "Current standings"}</h2>
        {!c.entries.length ? (
          <p className="text-muted">No entries yet.</p>
        ) : (
          <ol className="space-y-2">
            {c.entries.map((e) => (
              <li key={e.tokenId} className="flex items-center gap-3 border-[3px] border-ink bg-paper p-2">
                <span className="w-7 text-center font-display text-sm">{e.rank <= 3 ? MEDAL[e.rank - 1] : e.rank}</span>
                {e.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.image} alt="" className="h-10 w-12 object-contain [image-rendering:pixelated]" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-xs">{e.name}</span>
                  {e.keeper && (
                    <a className="block truncate text-xs text-muted underline" href={`${EXPLORER}/address/${e.keeper}`} target="_blank" rel="noreferrer">
                      keeper {e.keeper.slice(0, 6)}…{e.keeper.slice(-4)}
                    </a>
                  )}
                </span>
                <span className="text-right">
                  <span className="block font-display tabular-nums">{e.total}/{c.maxTotal}</span>
                  {e.prizeMon && <span className="block text-xs text-leaf">+{e.prizeMon} MON</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <div className="flex flex-wrap gap-2">
        <Link href={`/lomba#${c.id}`} className="btn-primary">
          {c.status === "Open" || c.status === "Judging" ? "Open live scoreboard" : "Open per-judge scores"}
        </Link>
        <a className="btn-ghost" href={`/api/contest/${raw}`}>
          JSON
        </a>
        <a className="btn-ghost" href={`${EXPLORER}/address/${ADDRESS}`} target="_blank" rel="noreferrer">
          Contract ↗
        </a>
      </div>
      <p className="mt-4 text-xs text-muted">
        Read live from Monad testnet contract {ADDRESS} (getContest / entriesOf). Ties rank the earlier entry first, same as
        finalize().
      </p>
    </main>
  );
}

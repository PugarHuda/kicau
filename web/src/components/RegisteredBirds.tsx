"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { usePublicClient } from "wagmi";
import { Modal, short } from "@/components/ui";
import { EXPLORER, KICAU_ADDRESS } from "@/lib/config";
import { type CustomBird, fetchRegisteredBirds } from "@/lib/customBirds";

/** Community birds: real birds registered by their owners, with pedigree & story read from chain. */
export function RegisteredBirds({ me }: { me?: string }) {
  const client = usePublicClient();
  const [open, setOpen] = useState<CustomBird | null>(null);
  const { data: birds, isLoading } = useQuery({
    queryKey: ["registeredBirds", KICAU_ADDRESS],
    enabled: !!client && !!KICAU_ADDRESS,
    refetchInterval: 15_000,
    queryFn: () => fetchRegisteredBirds(client!, KICAU_ADDRESS),
  });

  return (
    <section className="mt-12">
      <h2 className="mb-1 font-display text-3xl font-bold">Community Birds</h2>
      <p className="mb-5 text-muted">Real songbirds from the community, complete with titles and pedigree. All recorded on-chain.</p>
      {isLoading ? (
        <p className="text-muted">Loading from chain…</p>
      ) : !birds?.length ? (
        <p className="text-muted">None yet. Be the first via “+ Register your bird”.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {birds.map((b) => (
            <button
              key={String(b.tokenId)}
              onClick={() => setOpen(b)}
              className="flex gap-3 rounded-3xl border border-line bg-paper p-4 text-left transition hover:-translate-y-1 hover:shadow-lg"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.image} alt={b.name} className="h-16 w-20 shrink-0 object-contain" />
              <div className="min-w-0">
                <div className="truncate font-display text-sm">{b.name}</div>
                <div className="truncate text-sm text-muted">
                  {b.profile.owner ? `${b.profile.owner} · ` : ""}
                  {short(b.owner)}
                  {me && b.owner.toLowerCase() === me.toLowerCase() && " (you)"}
                </div>
                <Badges bird={b} />
              </div>
            </button>
          ))}
        </div>
      )}

      {open && (
        <Modal onClose={() => setOpen(null)}>
          <BirdProfileCard bird={open} />
        </Modal>
      )}
    </section>
  );
}

export function Badges({ bird }: { bird: CustomBird }) {
  const { titles, certificate, lineage } = bird.profile;
  if (!titles?.length && !certificate && !lineage) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1 text-xs">
      {!!titles?.length && <span className="bg-sun px-1.5 py-0.5 font-semibold text-ink">🏆 {titles.length}× champion</span>}
      {certificate && <span className="bg-leaf px-1.5 py-0.5 text-paper">✔ certified</span>}
      {lineage && <span className="bg-clay px-1.5 py-0.5 text-paper">champion bloodline</span>}
    </div>
  );
}

export function BirdProfileCard({ bird }: { bird: CustomBird }) {
  const p = bird.profile;
  return (
    <div>
      <div className="mb-4 grid place-items-center rounded-2xl bg-cream py-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bird.image} alt={bird.name} className="h-36 w-auto" />
      </div>
      <h2 className="mb-1 font-display text-2xl">{bird.name}</h2>
      <p className="mb-3 text-sm text-muted">
        Owned by {p.owner ? <b className="text-ink">{p.owner}</b> : "owner"} ·{" "}
        <a href={`${EXPLORER}/address/${bird.owner}`} target="_blank" rel="noreferrer" className="font-mono underline">
          {short(bird.owner)}
        </a>{" "}
        · NFT #{String(bird.tokenId)}
      </p>
      <Badges bird={bird} />
      <dl className="mt-4 space-y-3 text-sm">
        {!!p.titles?.length && (
          <div>
            <dt className="font-display text-xs">Titles</dt>
            <dd>
              <ul className="mt-1 list-inside list-disc">
                {p.titles.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {p.certificate && (
          <div>
            <dt className="font-display text-xs">Certificate</dt>
            <dd className="mt-1">{p.certificate}</dd>
          </div>
        )}
        {p.lineage && (
          <div>
            <dt className="font-display text-xs">Lineage</dt>
            <dd className="mt-1">{p.lineage}</dd>
          </div>
        )}
        {p.story && (
          <div>
            <dt className="font-display text-xs">Story</dt>
            <dd className="mt-1 whitespace-pre-line leading-relaxed">{p.story}</dd>
          </div>
        )}
      </dl>
      <p className="mt-4 text-xs text-muted">
        This data is self-declared by the owner and stored permanently in an on-chain event. Roadmap: titles verified by contest
        organizers (attestations).
      </p>
    </div>
  );
}

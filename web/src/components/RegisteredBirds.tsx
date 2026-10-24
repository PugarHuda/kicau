"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { formatEther, parseEther } from "viem";
import { usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { kicauAbi } from "@/lib/abi";
import { BirdProof } from "@/components/BirdProof";
import { CertificateButton } from "@/components/CertificateButton";
import { OwnerDashboard } from "@/components/OwnerDashboard";
import { KicauValue } from "@/components/lomba/KicauValue";
import { Modal, short } from "@/components/ui";
import { EXPLORER, KICAU_ADDRESS } from "@/lib/config";
import { type CustomBird, fetchRegisteredBirds } from "@/lib/customBirds";

type AttestFn = (tokenId: bigint, title: string) => Promise<boolean>;
type SupportFn = (tokenId: bigint, amount: bigint) => Promise<boolean>;
type Actions = { me?: `0x${string}`; busy?: boolean; onAttest?: AttestFn; onSupport?: SupportFn };

/** Community birds: real birds registered by their owners, with pedigree & story read from chain. */
export function RegisteredBirds({ me, busy = false, onAttest, onSupport }: Actions) {
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
                <div className="flex items-center gap-2">
                  <span className="truncate font-display text-sm">{b.name}</span>
                  <NftChip id={b.tokenId} />
                </div>
                {speciesLine(b.profile) && <div className="truncate text-xs text-muted">🔎 {speciesLine(b.profile)}</div>}
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
          <BirdProfileCard bird={open} me={me} busy={busy} onAttest={onAttest} onSupport={onSupport} />
        </Modal>
      )}
    </section>
  );
}

export function NftChip({ id }: { id: bigint | number }) {
  return <span className="shrink-0 border-2 border-ink bg-cream px-1 font-mono text-[0.65rem]">NFT #{String(id)}</span>;
}

/** Non-revoked organizer attestations of a registered bird. */
function useAttestations(tokenId: bigint) {
  const { data } = useReadContract({
    address: KICAU_ADDRESS,
    abi: kicauAbi,
    functionName: "attestationsOf",
    args: [tokenId],
    query: { enabled: !!KICAU_ADDRESS },
  });
  return (data ?? []).filter((a) => !a.revoked);
}

/** "Murai Batu · Copsychus malabaricus · AI 92%" (on-chain profile is untrusted: check types). */
function speciesLine(p: CustomBird["profile"]) {
  if (typeof p.species !== "string" || !p.species) return null;
  const ai = typeof p.aiConfidence === "number" ? `AI ${Math.round(p.aiConfidence * 100)}%` : "owner-declared";
  return [p.species, typeof p.latin === "string" ? p.latin : "", ai].filter(Boolean).join(" · ");
}

export function Badges({ bird }: { bird: CustomBird }) {
  const { titles, certificate, lineage } = bird.profile;
  const verified = useAttestations(bird.tokenId).length;
  if (!titles?.length && !certificate && !lineage && !verified) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1 text-xs">
      {verified > 0 && <span className="bg-leaf-dark px-1.5 py-0.5 font-semibold text-paper">🏅 {verified}× verified</span>}
      {!!titles?.length && (
        <span className="bg-sun px-1.5 py-0.5 font-semibold text-ink" title="Self-declared by the owner">
          🏆 {titles.length}× champion (self-declared)
        </span>
      )}
      {certificate && <span className="bg-leaf px-1.5 py-0.5 text-paper">✔ certified</span>}
      {lineage && <span className="bg-clay px-1.5 py-0.5 text-paper">champion bloodline</span>}
    </div>
  );
}

export function BirdProfileCard({ bird, me, busy = false, onAttest, onSupport }: Actions & { bird: CustomBird }) {
  const p = bird.profile;
  const { data: raised } = useReadContracts({
    contracts: [
      { address: KICAU_ADDRESS, abi: kicauAbi, functionName: "birdSupportOf", args: [bird.tokenId] },
      { address: KICAU_ADDRESS, abi: kicauAbi, functionName: "birdSupporters", args: [bird.tokenId] },
      { address: KICAU_ADDRESS, abi: kicauAbi, functionName: "ownerOf", args: [bird.tokenId] },
      { address: KICAU_ADDRESS, abi: kicauAbi, functionName: "valueOf", args: [bird.tokenId] },
    ],
    query: { enabled: !!KICAU_ADDRESS },
  });
  const attestations = useAttestations(bird.tokenId);
  const orgs = [...new Set(attestations.map((a) => a.organizer))];
  const { data: orgInfo } = useReadContracts({
    contracts: orgs.map((o) => ({ address: KICAU_ADDRESS, abi: kicauAbi, functionName: "organizers", args: [o] }) as const),
    query: { enabled: orgs.length > 0 },
  });
  const orgName = (o: string) => orgInfo?.[orgs.indexOf(o as `0x${string}`)]?.result?.[0] || short(o);
  const { data: meOrg } = useReadContract({
    address: KICAU_ADDRESS,
    abi: kicauAbi,
    functionName: "organizers",
    args: me ? [me] : undefined,
    query: { enabled: !!me && !!onAttest },
  });
  // supportBird requires >= 10% of the bird's Kicau Value (BelowMinSupport otherwise)
  const minSupport = raised?.[3].result ? raised[3].result[1] / 10n : 0n;
  const presets = minSupport > 0n ? [1n, 2n, 5n].map((k) => minSupport * k) : ["0.005", "0.01", "0.05"].map((v) => parseEther(v));
  const [title, setTitle] = useState("");
  const titleBytes = new TextEncoder().encode(title.trim()).length;
  return (
    <div>
      <div className="mb-4 grid place-items-center rounded-2xl bg-cream py-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bird.image} alt={bird.name} className="h-36 w-auto" />
      </div>
      <h2 className="mb-1 font-display text-2xl">{bird.name}</h2>
      {speciesLine(p) && <p className="mb-1 text-sm font-semibold">🔎 {speciesLine(p)}</p>}
      <p className="mb-3 text-sm text-muted">
        Owned by {p.owner ? <b className="text-ink">{p.owner}</b> : "owner"} ·{" "}
        <a href={`${EXPLORER}/address/${bird.owner}`} target="_blank" rel="noreferrer" className="font-mono underline">
          {short(bird.owner)}
        </a>{" "}
        · NFT #{String(bird.tokenId)}
      </p>
      <Badges bird={bird} />
      <KicauValue tokenId={bird.tokenId} className="mt-2" />
      <OwnerDashboard tokenId={bird.tokenId} />
      <dl className="mt-4 space-y-3 text-sm">
        {attestations.length > 0 && (
          <div>
            <dt className="font-display text-xs">Verified titles</dt>
            <dd>
              <ul className="mt-1 space-y-1">
                {attestations.map((a, i) => (
                  <li key={i}>
                    🏅 <b>{a.title}</b> — verified by {orgName(a.organizer)}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {!!p.titles?.length && (
          <div>
            <dt className="font-display text-xs">Titles (self-declared)</dt>
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
      <BirdProof tokenId={bird.tokenId} />
      <div className="mt-4 border-[3px] border-ink bg-cream p-3 text-sm">
        <div className="mb-1 font-display text-xs">Tokenized record</div>
        <p>
          ERC-721 · NFT #{String(bird.tokenId)} · Kicau contract{" "}
          <a href={`${EXPLORER}/address/${KICAU_ADDRESS}`} target="_blank" rel="noreferrer" className="font-mono underline">
            {short(KICAU_ADDRESS)}
          </a>{" "}
          ·{" "}
          <a href={`/metadata/c${bird.tokenId}.json`} target="_blank" rel="noreferrer" className="underline">
            metadata JSON
          </a>
        </p>
        <p className="text-muted">
          Current keeper:{" "}
          {raised?.[2].result ? (
            <a href={`${EXPLORER}/address/${raised[2].result}`} target="_blank" rel="noreferrer" className="font-mono underline">
              {short(raised[2].result)}
            </a>
          ) : (
            "…"
          )}
        </p>
      </div>
      <div className="mt-4 border-t-[3px] border-dashed border-ink pt-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-display text-xs">Support this bird</span>
          <span className="text-sm text-muted">
            Raised {raised?.[0].result !== undefined ? formatEther(raised[0].result) : "…"} MON from {raised?.[1].result?.toString() ?? "…"}{" "}
            supporters · 70% to keeper, 30% conservation
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {presets.map((amt) => (
            <button key={String(amt)} onClick={() => onSupport?.(bird.tokenId, amt)} disabled={busy || !onSupport} className="btn-ghost !py-2">
              {Number(formatEther(amt)).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")} MON
            </button>
          ))}
        </div>
        {minSupport > 0n && (
          <p className="mt-2 text-xs text-muted">Minimum sponsorship = 10% of Kicau Value ({formatEther(minSupport)} MON) — rises as the bird wins.</p>
        )}
        {!onSupport && <p className="mt-2 text-sm text-clay">Hit ⚡ Quick Play or connect a wallet to support.</p>}
      </div>
      <CertificateButton tokenId={bird.tokenId} />
      {meOrg?.[1] && onAttest && (
        <form
          className="mt-4 flex flex-wrap gap-2 border-t-[3px] border-dashed border-ink pt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onAttest(bird.tokenId, title.trim())) setTitle("");
          }}
        >
          <label className="block min-w-0 flex-1 text-sm">
            <span className="text-muted">Attest a title as {meOrg[0]}</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Champion — Piala Raja Jogja 2026"
              className="mt-1 w-full border-[3px] border-ink bg-paper px-3 py-2"
            />
          </label>
          <button className="btn-primary self-end" disabled={busy || titleBytes === 0 || titleBytes > 64}>
            {busy ? "Processing…" : "Attest"}
          </button>
        </form>
      )}
      <p className="mt-4 text-xs text-muted">
        Profile data is self-declared by the owner and stored permanently in an on-chain event. 🏅 titles are attested
        on-chain by registered contest organizers.
      </p>
    </div>
  );
}

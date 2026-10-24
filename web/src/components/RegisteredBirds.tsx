"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { formatEther, parseEther } from "viem";
import { usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { kicauAbi } from "@/lib/abi";
import { BirdProof, useBirdHistory } from "@/components/BirdProof";
import { CertificateButton } from "@/components/CertificateButton";
import { OwnerDashboard } from "@/components/OwnerDashboard";
import { KicauValue } from "@/components/lomba/KicauValue";
import { Modal, short } from "@/components/ui";
import { EXPLORER, KICAU_ADDRESS } from "@/lib/config";
import { type CustomBird, fetchCommunityBirds } from "@/lib/customBirds";
import { fmtMon } from "@/lib/birdHistory";
import { CERT_LABELS, certAttestTitle, sha256Hex, type Certificate, type Lineage, type Win } from "@/lib/pixelate";
import { fmtUsd, useMonUsd } from "@/lib/price";

type AttestFn = (tokenId: bigint, title: string) => Promise<boolean>;
type SupportFn = (tokenId: bigint, amount: bigint) => Promise<boolean>;
type Actions = { me?: `0x${string}`; busy?: boolean; onAttest?: AttestFn; onSupport?: SupportFn };

/** Community birds: real birds registered by their owners, with pedigree & story read from chain. */
export function RegisteredBirds({ me, busy = false, onAttest, onSupport }: Actions) {
  const [open, setOpen] = useState<CustomBird | null>(null);
  const [all, setAll] = useState(false);
  const { data: birds, isLoading } = useCommunityBirds();

  return (
    <section className="mt-12">
      <h2 className="mb-1 font-display text-3xl font-bold">Community Birds</h2>
      <p className="mb-5 text-muted">
        Real songbirds from the community. Species from AI analysis, pedigree as declared by the owner, wins verified on-chain.{" "}
        <span className="text-xs">Sorted by Kicau Value.</span>
      </p>
      {isLoading ? (
        <p className="text-muted">Loading from chain…</p>
      ) : !birds?.length ? (
        <p className="text-muted">None yet. Be the first via “+ Register your bird”.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(all ? birds : birds.slice(0, 6)).map((b) => (
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
      {!!birds && birds.length > 6 && (
        <button className="btn-ghost mt-4 !py-2" onClick={() => setAll(!all)}>
          {all ? "Show less" : `Show all (${birds.length})`}
        </button>
      )}

      {open && (
        <Modal onClose={() => setOpen(null)}>
          <BirdProfileCard bird={open} me={me} busy={busy} onAttest={onAttest} onSupport={onSupport} />
        </Modal>
      )}
    </section>
  );
}

/** Curated registered birds (shared cache with the Kicau Garden scene). */
export function useCommunityBirds() {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["registeredBirds", KICAU_ADDRESS, "curated"],
    enabled: !!client && !!KICAU_ADDRESS,
    refetchInterval: 15_000,
    queryFn: () => fetchCommunityBirds(client!, KICAU_ADDRESS),
  });
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
  const ai = p.speciesSource !== "owner" && typeof p.aiConfidence === "number" ? `AI ${Math.round(p.aiConfidence * 100)}%` : "owner-declared";
  return [p.species, typeof p.latin === "string" ? p.latin : "", ai].filter(Boolean).join(" · ");
}

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as T[]) : []);
const str = (v: unknown) => (typeof v === "string" ? v : "");

export function Badges({ bird }: { bird: CustomBird }) {
  const p = bird.profile;
  const titles = arr<string>([]).concat(Array.isArray(p.titles) ? p.titles.filter((t) => typeof t === "string") : []);
  const certs = arr<Certificate>(p.certificates).length + (str(p.certificate) ? 1 : 0);
  const wins = arr<Win>(p.wins).length + titles.length;
  const verified = useAttestations(bird.tokenId).length;
  if (!certs && !wins && !verified) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1 text-xs">
      {verified > 0 && <span className="bg-leaf-dark px-1.5 py-0.5 font-semibold text-paper">✔ <span className="tabular-nums">{verified}</span>× verified on-chain</span>}
      {wins > 0 && (
        <span className="border-2 border-dashed border-ink px-1.5 py-0.5 text-ink" title="Self-declared by the owner">
          🏆 <span className="tabular-nums">{wins}</span>× win (self-declared)
        </span>
      )}
      {certs > 0 && (
        <span className="border-2 border-dashed border-ink px-1.5 py-0.5 text-ink" title="Self-declared by the owner; not checked by Kicau">
          📄 <span className="tabular-nums">{certs}</span>× certificate (self-declared)
        </span>
      )}
    </div>
  );
}

/** "Sire × Dam → this bird" (+ breeder). Accepts legacy free-text lineage. */
function LineageTree({ lineage, name }: { lineage: unknown; name: string }) {
  if (typeof lineage === "string") return lineage ? <dd className="mt-1">{lineage}</dd> : null;
  if (!lineage || typeof lineage !== "object") return null;
  const l = lineage as Lineage;
  const parent = (x: Lineage["sire"], role: string) => (
    <span className="border-2 border-ink bg-cream px-2 py-1">
      <span className="block text-[0.65rem] text-muted">{role}</span>
      {str(x?.name) || "unknown"}
      {str(x?.ring) && <span className="block font-mono text-[0.65rem] tabular-nums">ring {str(x?.ring)}</span>}
    </span>
  );
  return (
    <dd className="mt-1 space-y-1">
      {(l.sire || l.dam) && (
        <div className="flex flex-wrap items-center gap-1 text-xs">
          {parent(l.sire, "Sire ♂")} × {parent(l.dam, "Dam ♀")} → <b>{name}</b>
        </div>
      )}
      {(str(l.breeder) || str(l.breederRing)) && (
        <div className="text-xs">
          Breeder: {str(l.breeder) || "—"}
          {str(l.breederRing) && <span className="font-mono tabular-nums"> · code {str(l.breederRing)}</span>}
        </div>
      )}
    </dd>
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
  const price = useMonUsd();
  const { data: history } = useBirdHistory(bird.tokenId);
  const onchainWins = (history?.events ?? []).filter((e) => e.kind === "contest");
  const wins = arr<Win>(p.wins);
  const certs = arr<Certificate>(p.certificates);
  const titleAtts = attestations.filter((a) => !a.title.startsWith("CERT:"));
  const certBy = (c: Certificate) => attestations.find((a) => a.title === certAttestTitle(c));
  const [docCheck, setDocCheck] = useState<string>();
  const legacyTitles = Array.isArray(p.titles) ? p.titles.filter((t): t is string => typeof t === "string") : [];
  const titleBytes = new TextEncoder().encode(title.trim()).length;
  return (
    <div>
      <div className="mb-4 grid place-items-center rounded-2xl bg-cream py-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bird.image} alt={bird.name} className="h-36 w-auto" />
      </div>
      <h2 className="mb-1 font-display text-2xl">{bird.name}</h2>
      {typeof p.species === "string" && p.species && (
        <p className="mb-2 border-[3px] border-ink bg-cream px-2 py-1 text-sm">
          <span className="block font-display text-[0.65rem] text-muted">{p.speciesSource === "owner" || typeof p.aiConfidence !== "number" ? "Species (set by owner)" : "Species (AI analysis)"}</span>
          <b>{p.species}</b>
          {str(p.latin) && <i className="text-muted"> · {str(p.latin)}</i>}
          {p.speciesSource !== "owner" && typeof p.aiConfidence === "number" && <span className="tabular-nums text-muted"> · {Math.round(p.aiConfidence * 100)}%</span>}
        </p>
      )}
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
        {titleAtts.length > 0 && (
          <div>
            <dt className="font-display text-xs">Titles (✔ verified on-chain by organizer)</dt>
            <dd>
              <ul className="mt-1 space-y-1">
                {titleAtts.map((a, i) => (
                  <li key={i}>
                    ✔ <b>{a.title}</b> — attested on-chain by {orgName(a.organizer)}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {onchainWins.length > 0 && (
          <div>
            <dt className="font-display text-xs">Contest results (✔ verified on-chain)</dt>
            <dd>
              <ul className="mt-1 space-y-1">
                {onchainWins.map((e) => (
                  <li key={e.txHash}>
                    ✔ <b>{e.label}</b>
                    {e.prizeWei ? <span className="tabular-nums"> · prize {fmtMon(e.prizeWei)} MON</span> : null}{" "}
                    <a href={`${EXPLORER}/tx/${e.txHash}`} target="_blank" rel="noreferrer" className="text-xs underline">
                      tx
                    </a>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {(wins.length > 0 || legacyTitles.length > 0) && (
          <div>
            <dt className="font-display text-xs">Wins (self-declared by owner)</dt>
            <dd>
              <ul className="mt-1 list-inside list-disc">
                {wins.map((w, i) => (
                  <li key={i}>
                    {w.rank && <span className="tabular-nums">#{str(w.rank)} </span>}
                    <b>{str(w.event)}</b>
                    {[str(w.class), str(w.organizer), str(w.location), str(w.date)].filter(Boolean).map((x) => ` · ${x}`)}
                  </li>
                ))}
                {legacyTitles.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {(certs.length > 0 || str(p.certificate)) && (
          <div>
            <dt className="font-display text-xs">Certificates (self-declared, not checked by Kicau)</dt>
            <dd className="mt-1 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-muted">
                  <tr>
                    <th className="pr-2">Type</th>
                    <th className="pr-2">Issuer</th>
                    <th className="pr-2">Number</th>
                    <th className="pr-2">Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {certs.map((c, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="pr-2">{CERT_LABELS[c.type] ?? "Other"}</td>
                      <td className="pr-2">{str(c.issuer)}</td>
                      <td className="pr-2 font-mono tabular-nums">{str(c.number)}</td>
                      <td className="pr-2 tabular-nums">{str(c.date)}</td>
                      <td>
                        {certBy(c) ? (
                          <span className="font-semibold text-leaf-dark">✔ verified by {orgName(certBy(c)!.organizer)}</span>
                        ) : (
                          <span className="text-muted">self-declared</span>
                        )}
                        {str(c.docHash) && (
                          <span className="block font-mono text-[0.65rem] tabular-nums text-muted" title={str(c.docHash)}>
                            doc sha256 {str(c.docHash).slice(0, 12)}…
                          </span>
                        )}
                        {!certBy(c) && meOrg?.[1] && onAttest && str(c.number) && (
                          <button className="btn-ghost mt-1 !px-2 !py-0.5 text-[0.65rem]" disabled={busy} onClick={() => onAttest(bird.tokenId, certAttestTitle(c))}>
                            Verify this certificate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {str(p.certificate) && (
                    <tr className="border-t border-line">
                      <td className="pr-2">Ring / certificate</td>
                      <td className="pr-2">—</td>
                      <td className="pr-2 font-mono tabular-nums">{str(p.certificate)}</td>
                      <td className="pr-2">—</td>
                      <td className="text-muted">self-declared</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {certs.some((c) => str(c.docHash)) && (
                <label className="mt-2 block text-xs">
                  <span className="text-muted">Check a document (hashed locally, never uploaded): </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="text-xs"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return setDocCheck(undefined);
                      const h = await sha256Hex(f);
                      setDocCheck(certs.some((c) => c.docHash === h) ? "✔ match — same file as the fingerprint on-chain" : "✖ no match");
                    }}
                  />
                  {docCheck && <b className={docCheck.startsWith("✔") ? "text-leaf-dark" : "text-clay"}> {docCheck}</b>}
                </label>
              )}
            </dd>
          </div>
        )}
        {p.lineage && (
          <div>
            <dt className="font-display text-xs">Lineage (self-declared)</dt>
            <LineageTree lineage={p.lineage} name={bird.name} />
          </div>
        )}
        {p.story && (
          <div>
            <dt className="font-display text-xs">Story</dt>
            <dd className="mt-1 whitespace-pre-line break-words leading-relaxed">{p.story}</dd>
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
            Raised{" "}
            <span className="tabular-nums">
              {raised?.[0].result !== undefined ? formatEther(raised[0].result) : "…"} MON
              {raised?.[0].result !== undefined && fmtUsd(Number(formatEther(raised[0].result)), price) && ` ${fmtUsd(Number(formatEther(raised[0].result)), price)}`}
            </span>{" "}
            from <span className="tabular-nums">{raised?.[1].result?.toString() ?? "…"}</span> supporters · 70% to keeper, 30% conservation
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {presets.map((amt) => (
            <button key={String(amt)} onClick={() => onSupport?.(bird.tokenId, amt)} disabled={busy || !onSupport} className="btn-ghost !py-2">
              <span className="tabular-nums">
                {Number(formatEther(amt)).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")} MON
                {fmtUsd(Number(formatEther(amt)), price) && <span className="text-xs text-muted"> {fmtUsd(Number(formatEther(amt)), price)}</span>}
              </span>
            </button>
          ))}
        </div>
        {minSupport > 0n && (
          <p className="mt-2 text-xs text-muted">Minimum sponsorship = 10% of Kicau Value (<span className="tabular-nums">{formatEther(minSupport)} MON</span>) — rises as the bird wins.</p>
        )}
        {price && <p className="mt-1 text-[0.65rem] text-muted">USD (Chainlink MON/USD)</p>}
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
        Profile data (certificates, lineage, self-declared wins) is the owner&apos;s claim, stored permanently in an on-chain
        event; Kicau does not check paper documents. ✔ verified items are organizer attestations and on-chain contest results.
      </p>
    </div>
  );
}

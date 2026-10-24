"use client";

import { CERT_LABELS, sha256Hex, type Certificate, type CertificateType, type Lineage, type Win } from "@/lib/pixelate";

const field = "mt-1 w-full border-[3px] border-ink bg-paper px-2 py-1.5 text-sm";

export type Pedigree = { certificates: Certificate[]; lineage: Lineage; wins: Win[] };

export const emptyPedigree = (): Pedigree => ({ certificates: [], lineage: {}, wins: [] });

/** Prefill from an on-chain profile (legacy string lineage is kept as the breeder note). */
export function pedigreeFrom(p: { certificates?: Certificate[]; lineage?: Lineage | string; wins?: Win[] }): Pedigree {
  return {
    certificates: p.certificates ?? [],
    lineage: typeof p.lineage === "string" ? { breeder: p.lineage } : (p.lineage ?? {}),
    wins: p.wins ?? [],
  };
}

function Text({ label, value, onChange, placeholder, max = 60, type = "text", num }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string; max?: number; type?: string; num?: boolean }) {
  return (
    <label className="block text-xs">
      <span className="text-muted">{label}</span>
      <input type={type} value={value ?? ""} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={`${field} ${num || type === "date" ? "tabular-nums" : ""}`} />
    </label>
  );
}

function Rows<T>({ title, hint, add, rows, onChange, blank, render }: { title: string; hint: string; add: string; rows: T[]; onChange: (r: T[]) => void; blank: T; render: (row: T, set: (patch: Partial<T>) => void) => React.ReactNode }) {
  return (
    <fieldset className={`mb-3 ${rows.length ? "border-[3px] border-ink p-3" : ""}`}>
      {rows.length > 0 && <legend className="px-1 font-display text-sm">{title}</legend>}
      {rows.length > 0 && <p className="mb-2 text-xs text-muted">{hint}</p>}
      {rows.map((r, i) => (
        <div key={i} className="mb-2 grid gap-2 border-b-2 border-dashed border-line pb-2 sm:grid-cols-4">
          {render(r, (patch) => onChange(rows.map((x, j) => (j === i ? { ...x, ...patch } : x))))}
          <button type="button" className="text-left text-xs text-clay underline sm:col-span-4" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="btn-ghost !py-1 text-xs" onClick={() => onChange([...rows, { ...blank }])}>
        {rows.length ? "+ Add another" : add}
      </button>
    </fieldset>
  );
}

export function PedigreeFields({ value, onChange }: { value: Pedigree; onChange: (v: Pedigree) => void }) {
  const { certificates, lineage, wins } = value;
  const setLin = (patch: Partial<Lineage>) => onChange({ ...value, lineage: { ...lineage, ...patch } });
  return (
    <>
      <p className="mb-2 text-xs text-muted">
        Optional — only a photo and a name are required. New to kicau mania? You can skip this and add it later with “Update my bird”.
      </p>
      <Rows<Certificate>
        add="+ Add certificate (optional)"
        title="Certificates"
        hint="Breeder ring, BKSDA captive-breeding / transport documents, contest piagam. Stored as your claim — Kicau does not check paper documents."
        rows={certificates}
        onChange={(certificates) => onChange({ ...value, certificates })}
        blank={{ type: "breeder_ring", issuer: "", number: "", date: "" }}
        render={(c, set) => (
          <>
            <label className="block text-xs">
              <span className="text-muted">Type</span>
              <select value={c.type} onChange={(e) => set({ type: e.target.value as CertificateType })} className={field}>
                {Object.entries(CERT_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <Text label="Issuer" value={c.issuer} onChange={(issuer) => set({ issuer })} placeholder="Penangkar / BKSDA / PBI" />
            <Text num label="Number" value={c.number} onChange={(number) => set({ number })} placeholder="ring / permit no." />
            <Text label="Date" type="date" value={c.date} onChange={(date) => set({ date })} />
            <label className="block text-xs sm:col-span-4">
              <span className="text-muted">
                Attach certificate photo/PDF (optional) — only its SHA-256 fingerprint is stored, the file never leaves your device
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="mt-1 block w-full text-xs"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  set({ docHash: f ? await sha256Hex(f) : undefined });
                }}
              />
              {c.docHash && <span className="font-mono tabular-nums text-[0.65rem]">sha256 {c.docHash.slice(0, 16)}…</span>}
            </label>
          </>
        )}
      />

      <details className="mb-3" open={!!(lineage.sire || lineage.dam || lineage.breeder || lineage.breederRing)}>
        <summary className="btn-ghost inline-flex !py-1 text-xs">+ Add lineage (optional)</summary>
        <div className="mt-2 grid gap-2 border-[3px] border-ink p-3 sm:grid-cols-2">
          <Text label="Sire (father) name" value={lineage.sire?.name} onChange={(name) => setLin({ sire: { ...lineage.sire, name } })} />
          <Text num label="Sire ring" value={lineage.sire?.ring} onChange={(ring) => setLin({ sire: { ...lineage.sire, ring } })} />
          <Text label="Dam (mother) name" value={lineage.dam?.name} onChange={(name) => setLin({ dam: { ...lineage.dam, name } })} />
          <Text num label="Dam ring" value={lineage.dam?.ring} onChange={(ring) => setLin({ dam: { ...lineage.dam, ring } })} />
          <Text label="Breeder (penangkar)" value={lineage.breeder} onChange={(breeder) => setLin({ breeder })} max={80} />
          <Text num label="Breeder ring code" value={lineage.breederRing} onChange={(breederRing) => setLin({ breederRing })} />
        </div>
      </details>

      <Rows<Win>
        add="+ Add a past win (optional)"
        title="Self-declared wins"
        hint="Past contest results you claim. Shown as self-declared; wins from on-chain Kicau contests are verified automatically."
        rows={wins}
        onChange={(wins) => onChange({ ...value, wins })}
        blank={{ event: "", organizer: "", class: "", rank: "", date: "", location: "" }}
        render={(w, set) => (
          <>
            <Text label="Event" value={w.event} onChange={(event) => set({ event })} placeholder="Piala Raja 2025" />
            <Text label="Organizer" value={w.organizer} onChange={(organizer) => set({ organizer })} placeholder="PBI" />
            <Text label="Class" value={w.class} onChange={(c) => set({ class: c })} placeholder="Murai Batu A" />
            <Text num label="Rank" value={w.rank} onChange={(rank) => set({ rank })} placeholder="1" max={12} />
            <Text label="Date" type="date" value={w.date} onChange={(date) => set({ date })} />
            <Text label="Location" value={w.location} onChange={(location) => set({ location })} placeholder="Yogyakarta" />
          </>
        )}
      />
    </>
  );
}

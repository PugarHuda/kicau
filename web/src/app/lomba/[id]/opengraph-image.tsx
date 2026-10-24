import { ImageResponse } from "next/og";
import { parseId, readContest } from "@/lib/publicData";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Kicau contest results";
export const revalidate = 15;

const MEDAL = ["#e8a33d", "#b8b8b8", "#b07040"];

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  const c = id === null ? null : await readContest(id).catch(() => null);
  const top = c?.entries.slice(0, 3) ?? [];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f6eedb", padding: 56, color: "#1e2a1f", fontFamily: "serif" }}>
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, color: "#8a6a3c" }}>KICAU · ON-CHAIN GANTANGAN · #{c?.id ?? "?"}</div>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700, marginTop: 12, lineHeight: 1.1 }}>{c ? c.name : "Contest not found"}</div>
        {c && (
          <div style={{ display: "flex", fontSize: 28, marginTop: 10, color: "#5c4a36" }}>
            {`${c.class} · ${c.status} · ${c.entries.length} birds · pool ${c.poolMon} MON`}
          </div>
        )}
        <div style={{ display: "flex", gap: 24, marginTop: 40, flex: 1 }}>
          {top.map((e, i) => (
            <div key={e.tokenId} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, background: "#fffaf0", border: `6px solid ${MEDAL[i]}`, padding: 20 }}>
              <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: MEDAL[i] }}>{`#${i + 1}`}</div>
              {e.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.image} width={150} height={126} alt="" style={{ imageRendering: "pixelated" }} />
              ) : (
                <div style={{ display: "flex", width: 150, height: 126 }} />
              )}
              <div style={{ display: "flex", fontSize: 30, fontWeight: 700, marginTop: 8, lineHeight: 1.3 }}>{e.name.slice(0, 22)}</div>
              <div style={{ display: "flex", fontSize: 26, marginTop: 6, lineHeight: 1.3 }}>{`${e.total}/${c!.maxTotal} pts${e.prizeMon ? ` · +${e.prizeMon} MON` : ""}`}</div>
            </div>
          ))}
          {!top.length && <div style={{ display: "flex", fontSize: 32, color: "#5c4a36" }}>No entries yet.</div>}
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "#5c4a36", marginTop: 24 }}>
          Every judge score is a Monad transaction · kicau.xyz/lomba/{c?.id ?? ""}
        </div>
      </div>
    ),
    size,
  );
}

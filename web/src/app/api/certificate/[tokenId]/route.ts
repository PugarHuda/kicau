import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { decodePaymentSignatureHeader, encodePaymentRequiredHeader, encodePaymentResponseHeader } from "@x402/core/http";
import type { PaymentRequirements, ResourceInfo } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { createPublicClient } from "viem";
import { NET } from "@/lib/network";
import { kicauAbi } from "@/lib/abi";
import { fetchCustomBird, type CustomBird } from "@/lib/customBirds";
import { lineageText } from "@/lib/pixelate";
import { rpcTransport } from "@/lib/rpc";
import { qrSvgPath } from "@/app/pitch/qr";
import { CERTIFICATE_PRICE_USD, MONAD_TESTNET_USDC, X402_FACILITATOR, X402_NETWORK } from "@/lib/x402";

const KICAU_ADDRESS = NET.address;
const client = createPublicClient({ chain: NET.chain, transport: rpcTransport });

const server = new x402ResourceServer(new HTTPFacilitatorClient({ url: X402_FACILITATOR })).register(
  X402_NETWORK,
  new ExactEvmScheme(),
);
let ready: Promise<void> | null = null; // fetches facilitator /supported once per instance

// Paid pedigree certificate: HTTP 402 → client signs an EIP-3009 USDC authorization → Monad facilitator settles on-chain.
export async function GET(req: Request, { params }: { params: Promise<{ tokenId: string }> }) {
  const raw = (await params).tokenId;
  if (!/^\d{1,10}$/.test(raw) || !KICAU_ADDRESS) return Response.json({ error: "Invalid token id" }, { status: 400 });
  const tokenId = BigInt(raw);

  // Look the bird up before asking for money: never charge for a certificate we can't issue.
  const [bird, block, treasury, keeper] = await Promise.all([
    fetchCustomBird(client, KICAU_ADDRESS, tokenId).catch(() => null),
    client.readContract({ address: KICAU_ADDRESS, abi: kicauAbi, functionName: "registeredAt", args: [tokenId] }).catch(() => 0n),
    client.readContract({ address: KICAU_ADDRESS, abi: kicauAbi, functionName: "treasury" }),
    client.readContract({ address: KICAU_ADDRESS, abi: kicauAbi, functionName: "ownerOf", args: [tokenId] }).catch(() => null),
  ]);
  if (!bird || !block) return Response.json({ error: "Not a registered bird" }, { status: 404 });

  try {
    ready ??= server.initialize().catch((e) => {
      ready = null;
      throw e;
    });
    await ready;
    const requirements = await server.buildPaymentRequirements({
      scheme: "exact",
      network: X402_NETWORK,
      payTo: treasury,
      maxTimeoutSeconds: 300,
      // Testnet USDC isn't in @x402/evm's default asset table, so price it in atomic units (6 decimals).
      price: { asset: MONAD_TESTNET_USDC, amount: String(Math.round(CERTIFICATE_PRICE_USD * 1e6)), extra: { name: "USDC", version: "2" } },
    });
    const resource: ResourceInfo = {
      url: req.url,
      description: `Kicau pedigree certificate for registered bird #${raw} (${bird.name})`,
      mimeType: "image/svg+xml",
      serviceName: "Kicau",
    };

    const signature = req.headers.get("payment-signature");
    if (!signature) return paymentRequired(requirements, resource);

    const payload = decodePaymentSignatureHeader(signature);
    const match = server.findMatchingRequirements(requirements, payload);
    if (!match) return paymentRequired(requirements, resource, "Payment does not match requirements");
    const verified = await server.verifyPayment(payload, match);
    if (!verified.isValid) return paymentRequired(requirements, resource, verified.invalidMessage ?? verified.invalidReason ?? "invalid_payment", payload);
    const settled = await server.settlePayment(payload, match);
    if (!settled.success) return paymentRequired(requirements, resource, settled.errorMessage ?? settled.errorReason ?? "settle_failed", payload);

    return new Response(certificateSvg({ ...bird, owner: keeper ?? bird.owner }, block, settled.transaction, settled.payer ?? verified.payer ?? "", new URL(`/api/bird/${raw}`, req.url).href), {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "private, no-store",
        "PAYMENT-RESPONSE": encodePaymentResponseHeader(settled),
        "Access-Control-Expose-Headers": "PAYMENT-RESPONSE, PAYMENT-REQUIRED",
      },
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "x402 error" }, { status: 502 });
  }

  async function paymentRequired(reqs: PaymentRequirements[], resource: ResourceInfo, error?: string, payload?: Parameters<typeof server.createPaymentRequiredResponse>[5]) {
    const body = await server.createPaymentRequiredResponse(reqs, resource, error, undefined, undefined, payload);
    return Response.json(body, {
      status: 402,
      headers: { "PAYMENT-REQUIRED": encodePaymentRequiredHeader(body), "Cache-Control": "private, no-store", "Access-Control-Expose-Headers": "PAYMENT-REQUIRED" },
    });
  }
}

const esc = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Greedy word wrap; ponytail: char-count based, fine for a monospace-ish certificate. */
function wrap(s: string, width: number, maxLines: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of s.replace(/\s+/g, " ").trim().split(" ")) {
    if ((line + " " + word).trim().length > width) {
      lines.push(line);
      line = word;
    } else line = (line + " " + word).trim();
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) lines.splice(maxLines - 1, lines.length, lines[maxLines - 1].slice(0, width - 1) + "…");
  return lines;
}

function certificateSvg(bird: CustomBird, block: bigint, tx: string, payer: string, recordUrl: string) {
  const qr = qrSvgPath(recordUrl);
  const p = bird.profile;
  const rows: [string, string[]][] = [
    ["Keeper", [`${p.owner ? p.owner + " · " : ""}${bird.owner}`]],
    ...(p.titles?.length ? ([["Titles", p.titles.slice(0, 4).flatMap((t) => wrap(`• ${t}`, 62, 1))]] as [string, string[]][]) : []),
    ...(lineageText(p.lineage) ? ([["Lineage (self-declared)", wrap(lineageText(p.lineage), 62, 2)]] as [string, string[]][]) : []),
    ...(Array.isArray(p.wins) && p.wins.length ? ([["Wins (self-declared)", p.wins.slice(0, 3).flatMap((w) => wrap(`• ${[w.rank && `#${w.rank}`, w.event, w.organizer].filter(Boolean).join(" ")}`, 62, 1))]] as [string, string[]][]) : []),
    ...(Array.isArray(p.certificates) && p.certificates.length ? ([["Certificates (self-declared)", p.certificates.slice(0, 3).flatMap((c) => wrap(`• ${[c.issuer, c.number].filter(Boolean).join(" ")}`, 62, 1))]] as [string, string[]][]) : []),
    ...(p.certificate ? ([["Certificate", wrap(p.certificate, 62, 2)]] as [string, string[]][]) : []),
  ];
  let y = 330;
  const body = rows
    .map(([label, lines]) => {
      const out =
        `<text x="420" y="${y}" class="l">${esc(label.toUpperCase())}</text>` +
        lines.map((l, i) => `<text x="420" y="${y + 26 + i * 24}" class="v">${esc(l)}</text>`).join("");
      y += 40 + lines.length * 24;
      return out;
    })
    .join("");
  const issued = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="780" viewBox="0 0 1100 780">
<style>text{font-family:Georgia,'Times New Roman',serif;fill:#2b2118}.l{font:600 13px ui-monospace,Menlo,monospace;letter-spacing:2px;fill:#8a6a3c}.v{font-size:19px}.m{font:12px ui-monospace,Menlo,monospace;fill:#5c4a36}</style>
<rect width="1100" height="780" fill="#f6eedb"/>
<rect x="24" y="24" width="1052" height="732" fill="none" stroke="#8a6a3c" stroke-width="3"/>
<rect x="36" y="36" width="1028" height="708" fill="none" stroke="#8a6a3c" stroke-width="1"/>
<text x="550" y="110" text-anchor="middle" style="font-size:20px;letter-spacing:8px;fill:#8a6a3c">KICAU · ON-CHAIN PEDIGREE</text>
<text x="550" y="180" text-anchor="middle" style="font-size:54px;font-weight:700">${esc(bird.name)}</text>
<text x="550" y="220" text-anchor="middle" class="m">Registered bird NFT #${bird.tokenId} · minted in ${NET.label} block ${block}</text>
<rect x="90" y="290" width="290" height="250" fill="#fffaf0" stroke="#d9c7a3"/>
<image href="${esc(bird.image)}" x="105" y="305" width="260" height="220" preserveAspectRatio="xMidYMid meet" style="image-rendering:pixelated"/>
${body}
<line x1="90" y1="610" x2="1010" y2="610" stroke="#d9c7a3"/>
<text x="90" y="638" class="m">Contract ${KICAU_ADDRESS} (chain ${NET.chainId}) · data from the BirdRegistered event, self-declared by the keeper</text>
<text x="90" y="660" class="m">Issued ${issued} · paid ${CERTIFICATE_PRICE_USD} USDC via x402 (Monad facilitator) by ${esc(payer)}</text>
<text x="90" y="682" class="m">Settlement tx ${esc(tx)}</text>
<text x="90" y="704" class="m">Verify: ${NET.explorer}/tx/${esc(tx)}</text>
<svg x="944" y="52" width="104" height="104" viewBox="0 0 ${qr.size} ${qr.size}" shape-rendering="crispEdges"><rect width="${qr.size}" height="${qr.size}" fill="#fffaf0"/><path d="${qr.d}" fill="#2b2118"/></svg>
<text x="996" y="172" text-anchor="middle" class="m">scan: live record</text>
</svg>`;
}

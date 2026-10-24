# Kicau web

Next.js 15 (App Router) · wagmi v3 · viem · Tailwind v4. Full project docs: [../README.md](../README.md).

```bash
npm install
npm run dev        # http://localhost:3000, no .env needed (defaults to the testnet contract)
npm run build
npm run abi        # regenerate src/lib/abi.ts after `forge build` in ../contracts
```

- `src/app/`: pages `/`, `/lomba`, `/lomba/[id]`, `/taman`, `/me`, `/pitch`; API routes `api/{faucet,identify,certificate/[tokenId],bird/[id],contest/[id],health}`; `metadata/[id]`
- `src/components/`: game, contests, garden, register, dashboards, live feed
- `src/lib/`: `network.ts` (testnet/mainnet switch via `NEXT_PUBLIC_NETWORK`), `useKicau.ts` (tx helpers), `live.ts` + `contestLive.ts` (monadLogs), `pixelate.ts` (bird encoding), `price.ts` (Chainlink)

Optional env: `ANTHROPIC_API_KEY` (AI species ID), `NEXT_PUBLIC_NETWORK=mainnet`, `NEXT_PUBLIC_KICAU_ADDRESS` / `NEXT_PUBLIC_KICAU_DEPLOY_BLOCK`.

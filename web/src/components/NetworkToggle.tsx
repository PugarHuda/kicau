"use client";

import { usePathname } from "next/navigation";
import { NETWORK, NET } from "@/lib/network";

/** "Testnet | Mainnet" segmented switch: the active network is highlighted, the other links to its deployment on the same path. */
export function NetworkToggle() {
  const path = usePathname() ?? "/";
  const seg = "px-1.5 py-1 font-display text-[0.5rem] uppercase leading-none sm:px-2 sm:text-[0.6rem]";
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <span className="inline-flex border-[3px] border-ink bg-paper" role="group" aria-label="Network">
        {(["testnet", "mainnet"] as const).map((n) =>
          n === NETWORK ? (
            <span key={n} className={`${seg} bg-ink text-paper`} aria-current="true">
              {n}
            </span>
          ) : (
            <a key={n} className={`${seg} text-muted hover:text-ink`} href={`${NET.otherUrl}${path}`}>
              {n}
            </a>
          ),
        )}
      </span>
      {NETWORK === "mainnet" && <span className="whitespace-nowrap bg-clay px-1.5 py-1 font-display text-[0.5rem] leading-none text-paper max-sm:hidden">MAINNET · real MON</span>}
    </span>
  );
}

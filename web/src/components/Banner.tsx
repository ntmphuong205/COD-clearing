"use client";
import Link from "next/link";
import { MODE, useApp } from "@/lib/app";
import { SimBanner } from "@/components/sim/SimPages";

const LINKS = [["/courier", "Courier"], ["/seller", "Seller"], ["/carrier", "Carrier"], ["/admin", "Admin"]];

export function Banner() {
  return MODE === "sim" ? <SimBanner /> : <ChainBanner />;
}

function ChainBanner() {
  const app = useApp();
  return (
    <header>
      <div className="bg-yellow-300 text-neutral-950 text-xs px-3 py-1.5 leading-snug">
        <b>{MODE.toUpperCase()}</b> mode · {app.hub.name} (chain {app.hub.cfg.chainId}) · Demo settings: 60 s dispute window,
        25,000 VND = 1 USDC, testnet funds only
      </div>
      <nav className="flex gap-4 px-3 py-2 border-b-2 border-neutral-200 text-sm font-semibold">
        <Link href="/">COD Clearing</Link>
        {LINKS.map(([h, l]) => <Link key={h} href={h} className="text-neutral-600 hover:text-neutral-950">{l}</Link>)}
      </nav>
    </header>
  );
}

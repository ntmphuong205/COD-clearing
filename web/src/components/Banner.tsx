"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MODE, useApp } from "@/lib/app";
import { simReset } from "@/lib/sim";

const LINKS = [["/courier", "Courier"], ["/seller", "Seller"], ["/carrier", "Carrier"], ["/admin", "Admin"]];

function Header({ badge, detail, right }: { badge: string; detail: string; right?: ReactNode }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#070b14]/85 backdrop-blur">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3">
        <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight text-white">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-rose-700 text-white shadow" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M12 3 2.5 20h6.2l3.3-5.8L15.3 20h6.2z" /></svg>
          </span>
          <span className="hidden sm:inline">COD Clearing</span>
        </Link>
        <nav className="flex gap-0.5 sm:gap-1 text-sm font-semibold">
          {LINKS.map(([h, l]) => (
            <Link key={h} href={h} className={`rounded-lg px-2.5 sm:px-3 py-1.5 transition ${path === h ? "bg-white/15 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}>{l}</Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="chip hidden sm:inline-flex bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30 uppercase tracking-wide">{badge}</span>
          <span className="hidden md:inline text-slate-400">{detail}</span>
          {right}
        </div>
      </div>
    </header>
  );
}

export function Banner() {
  return MODE === "sim" ? (
    <Header
      badge="Simulated demo"
      detail="Runs in your browser · no wallet needed"
      right={<button className="font-semibold text-slate-400 underline hover:text-white" onClick={() => { if (confirm("Reset the demo to its starting state?")) simReset(); }}>Reset</button>}
    />
  ) : <ChainBanner />;
}

function ChainBanner() {
  const app = useApp();
  return <Header badge={`${MODE} mode`} detail={`${app.hub.name} (chain ${app.hub.cfg.chainId}) · 60 s window · 25,000 VND = 1 USDC`} />;
}

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
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-rose-700 text-white shadow" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M12 3 2.5 20h6.2l3.3-5.8L15.3 20h6.2z" /></svg>
          </span>
          <span className="hidden sm:inline">COD Clearing</span>
        </Link>
        <nav className="flex gap-1 text-sm font-semibold">
          {LINKS.map(([h, l]) => (
            <Link key={h} href={h} className={`rounded-lg px-3 py-1.5 transition ${path === h ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{l}</Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="chip bg-amber-100 text-amber-800 uppercase tracking-wide">{badge}</span>
          <span className="hidden md:inline text-slate-500">{detail}</span>
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
      right={<button className="font-semibold text-slate-600 underline hover:text-slate-900" onClick={() => { if (confirm("Reset the demo to its starting state?")) simReset(); }}>Reset</button>}
    />
  ) : <ChainBanner />;
}

function ChainBanner() {
  const app = useApp();
  return <Header badge={`${MODE} mode`} detail={`${app.hub.name} (chain ${app.hub.cfg.chainId}) · 60 s window · 25,000 VND = 1 USDC`} />;
}

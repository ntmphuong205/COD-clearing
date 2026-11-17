"use client";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { short } from "@/lib/format";
import { ROLES, setWallet, simReset, useSim, type Role } from "@/lib/sim";
import { toast } from "@/lib/toast";
import { closeWalletModal, openWalletModal, useWalletModal } from "@/lib/wallet";

const ORDER: Role[] = ["courier", "seller", "admin", "carrier"];

export function WalletButton() {
  const { wallet } = useSim();
  return wallet ? (
    <button onClick={openWalletModal} className="flex items-center gap-2 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold ring-1 ring-white/15 hover:bg-white/15">
      <span className="h-2 w-2 rounded-full bg-emerald-400" />
      <span>{ROLES[wallet].label}</span>
      <span className="hidden sm:inline font-mono text-slate-400">{short(ROLES[wallet].address)}</span>
    </button>
  ) : (
    <button onClick={openWalletModal} className="btn-primary whitespace-nowrap px-3 py-1.5 text-xs">Connect<span className="hidden sm:inline">&nbsp;wallet</span></button>
  );
}

export function WalletModal() {
  const isOpen = useWalletModal();
  const { wallet } = useSim();
  const router = useRouter();
  if (!isOpen) return null;

  function pick(role: Role) {
    setWallet(role);
    closeWalletModal();
    toast(`Connected as ${ROLES[role].label}`, "ok");
    router.push(ROLES[role].path);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={closeWalletModal}>
      <div className="pop w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1322] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Connect wallet">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold">Connect wallet</h2>
            <p className="mt-0.5 text-sm text-slate-400">Pick a demo account. This is simulated: no real wallet or funds.</p>
          </div>
          <button onClick={closeWalletModal} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10" aria-label="Close">✕</button>
        </div>
        <ul className="mt-4 space-y-2">
          {ORDER.map((r) => (
            <li key={r}>
              <button onClick={() => pick(r)} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left ring-1 transition hover:bg-white/10 ${wallet === r ? "bg-white/10 ring-emerald-400/50" : "bg-white/[0.03] ring-white/10"}`}>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-brand to-orange-500 text-sm font-extrabold text-white">{ROLES[r].label[0]}</span>
                <span className="flex-1">
                  <span className="block font-bold">{ROLES[r].label}{wallet === r && <span className="ml-2 text-xs font-semibold text-emerald-400">connected</span>}</span>
                  <span className="block text-xs text-slate-400">{ROLES[r].blurb}</span>
                  <span className="block font-mono text-xs text-slate-500">{short(ROLES[r].address)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button className="mt-3 w-full text-center text-xs font-semibold text-slate-500 underline hover:text-slate-300" onClick={() => { if (confirm("Reset the demo to its starting state?")) { simReset(); closeWalletModal(); toast("Demo reset", "info"); } }}>Reset demo data</button>
        {wallet && (
          <button className="btn-ghost mt-3 w-full py-2 text-sm" onClick={() => { setWallet(null); closeWalletModal(); toast("Wallet disconnected", "info"); }}>Disconnect</button>
        )}
      </div>
    </div>
  );
}

/** Shows its children only when the matching demo account is connected. */
export function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const { wallet } = useSim();
  if (wallet === role) return <>{children}</>;
  const r = ROLES[role];
  return (
    <div className="mx-auto mt-6 max-w-md space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/10 text-2xl">🔐</div>
      <div>
        <h1 className="text-2xl font-extrabold">{wallet ? `Switch to the ${r.label} account` : "Connect a wallet to continue"}</h1>
        <p className="mt-1 text-slate-400">
          {wallet ? `You are connected as ${ROLES[wallet].label}. This page is for the ${r.label}.` : `This page is for the ${r.label}: ${r.blurb.toLowerCase()}.`}
        </p>
      </div>
      <div className="rounded-xl bg-white/5 px-3 py-2 font-mono text-sm text-slate-300 ring-1 ring-white/10">{short(r.address)}</div>
      <button className="btn-primary w-full py-3.5 text-lg" onClick={() => { setWallet(role); toast(`Connected as ${r.label}`, "ok"); }}>
        {wallet ? `Switch to ${r.label}` : `Connect as ${r.label}`}
      </button>
      <button className="text-sm font-semibold text-slate-400 underline hover:text-white" onClick={openWalletModal}>Choose another account</button>
    </div>
  );
}

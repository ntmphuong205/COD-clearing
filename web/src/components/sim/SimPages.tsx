"use client";
import { useState } from "react";
import Link from "next/link";
import { countdown, short, usdc, usdcFromVnd, vnd, when } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import {
  CARRIER_NAMES, SIM_RATE, SIM_WINDOW, simClaim, simClosePeriod, simCourier, simDeposit, simReset, useSim,
} from "@/lib/sim";

const LINKS = [["/courier", "Courier"], ["/seller", "Seller"], ["/carrier", "Carrier"], ["/admin", "Admin"]];
const STATUS = ["-", "Created", "Picked up", "Delivered", "Returned"];
type Action = "pickup" | "delivered" | "returned";
const LABEL: Record<Action, string> = { pickup: "Picked up", delivered: "Delivered & paid", returned: "Returned" };
const big = (n: number) => BigInt(Math.trunc(n));
const Err = ({ msg }: { msg: string | null }) =>
  msg ? <p className="rounded-lg bg-red-100 border-2 border-red-700 p-3 font-semibold">{msg}</p> : null;
const Tx = ({ hash }: { hash: string }) => <span className="font-mono" title="Simulated transaction hash">{short(hash)}</span>;

export function SimBanner() {
  return (
    <header>
      <div className="bg-yellow-300 text-neutral-950 text-xs px-3 py-1.5 leading-snug flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          <b>SIMULATED DEMO</b> · runs in your browser, no wallet or blockchain needed · same rules as the contracts · 60 s dispute
          window, 25,000 VND = 1 USDC, testnet funds only
        </span>
        <button className="underline font-semibold" onClick={() => { if (confirm("Reset the demo to its starting state?")) simReset(); }}>Reset demo</button>
      </div>
      <nav className="flex gap-4 px-3 py-2 border-b-2 border-neutral-200 text-sm font-semibold">
        <Link href="/">COD Clearing</Link>
        {LINKS.map(([h, l]) => <Link key={h} href={h} className="text-neutral-600 hover:text-neutral-950">{l}</Link>)}
      </nav>
    </header>
  );
}

export function SimGuide() {
  const steps = [
    ["/courier", "Courier", "Open Carrier A, tap Delivered & paid on an order, then Confirm."],
    ["/seller", "Seller", "A few seconds later the balance and History update. This is the cross-chain message arriving at the hub."],
    ["/admin", "Admin", "Tap Close period. Balances become a payout, and a 60 s dispute window starts."],
    ["/seller", "Seller", "When the countdown ends, tap Claim. The seller receives USDC from both carriers' escrows in one step."],
  ];
  return (
    <section className="card space-y-2">
      <h2 className="text-lg font-bold">Try the demo in 4 steps</h2>
      <ol className="list-decimal pl-5 space-y-1">
        {steps.map(([h, t, d], i) => (
          <li key={i}><Link href={h} className="font-bold underline">{t}</Link>: {d}</li>
        ))}
      </ol>
      <p className="text-sm text-neutral-600">
        This page is a simulation of the system for demonstration. The real contracts and a local blockchain demo are in the project repository.
      </p>
    </section>
  );
}

export function SimCourier() {
  const s = useSim();
  const [ci, setCi] = useState(0);
  const [confirm, setConfirm] = useState<{ code: string; action: Action } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(code: string, action: Action) {
    setConfirm(null);
    setBusy(code);
    setError(null);
    try { setLastTx(await simCourier(code, action)); } catch (e) { setError((e as Error).message); }
    setBusy(null);
  }
  const list = s.orders.filter((o) => o.carrier === ci).sort((a, b) => Number(a.status >= 3) - Number(b.status >= 3));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Courier</h1>
      <div className="grid grid-cols-2 gap-2">
        {CARRIER_NAMES.map((n, i) => <button key={n} onClick={() => setCi(i)} className={i === ci ? "btn-primary" : "btn-ghost"}>{n}</button>)}
      </div>
      <p className="text-sm text-neutral-600">Simulated courier wallet connected. Each order belongs to the seller shown on the Seller page.</p>
      {lastTx && <p className="text-sm">Last confirmed tx: <Tx hash={lastTx} /></p>}
      <Err msg={error} />
      <ul className="space-y-3">
        {list.map((o) => {
          const isBusy = busy === o.code;
          const done = o.status >= 3;
          const isConfirming = confirm?.code === o.code;
          return (
            <li key={o.code} className={`card ${done ? "opacity-70" : "border-neutral-950"}`}>
              <div className="flex justify-between items-baseline">
                <span className="text-xl font-extrabold">{o.code}</span>
                <span className="font-semibold">{STATUS[o.status]}</span>
              </div>
              <p className="text-lg mt-1">Collect <b>{vnd(o.cod)}</b></p>
              {isBusy && <p className="mt-3 text-lg font-bold animate-pulse">Pending… waiting for the block</p>}
              {!isBusy && !isConfirming && o.status === 2 && (
                <div className="grid grid-cols-1 gap-3 mt-3">
                  <button className="btn-ok py-6 text-2xl" onClick={() => setConfirm({ code: o.code, action: "delivered" })}>Delivered &amp; paid</button>
                  <button className="btn-warn py-5 text-xl" onClick={() => setConfirm({ code: o.code, action: "returned" })}>Returned</button>
                </div>
              )}
              {!isBusy && isConfirming && (
                <div className="mt-3 rounded-xl border-2 border-neutral-950 p-3">
                  <p className="text-lg font-bold">Confirm: {LABEL[confirm.action]}?</p>
                  <p className="text-sm text-neutral-700">This is sent to the carrier ledger and cannot be undone.</p>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <button className="btn-ghost py-4" onClick={() => setConfirm(null)}>Cancel</button>
                    <button className={`${confirm.action === "returned" ? "btn-warn" : "btn-ok"} py-4`} onClick={() => run(o.code, confirm.action)}>Confirm</button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SimSeller() {
  const s = useSim();
  const now = useNow();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = s.balances.reduce((a, b) => a + b, 0);
  const payouts = s.payouts.filter((p) => p.usdc.some((x) => x > 0));

  async function claim(epoch: number) {
    setPending(true);
    setError(null);
    try { await simClaim(epoch); } catch (e) { setError((e as Error).message); }
    setPending(false);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">Seller</h1>
      <p className="text-sm text-neutral-600">Simulated seller wallet connected. USDC received so far: <b>{usdc(big(s.sellerUsdc))}</b></p>
      <Err msg={error} />

      <section className="grid sm:grid-cols-3 gap-3">
        {CARRIER_NAMES.map((n, i) => (
          <div key={n} className="card">
            <div className="text-sm font-semibold text-neutral-600">{n}</div>
            <div className="text-2xl font-extrabold">{vnd(s.balances[i])}</div>
            <div className="text-sm">≈ {usdc(usdcFromVnd(big(s.balances[i]), BigInt(SIM_RATE)))}</div>
          </div>
        ))}
        <div className="card bg-neutral-950 text-white border-neutral-950">
          <div className="text-sm font-semibold text-neutral-300">Total</div>
          <div className="text-2xl font-extrabold">{vnd(total)}</div>
          <div className="text-sm">≈ {usdc(usdcFromVnd(big(total), BigInt(SIM_RATE)))}</div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">Claimable payouts</h2>
        {payouts.length === 0 && <p className="text-neutral-600">None yet. Payouts appear after the admin closes a period.</p>}
        {payouts.map((p) => {
          const left = p.claimableAt - now;
          const totalUsdc = p.usdc.reduce((a, x) => a + x, 0);
          return (
            <div key={p.epoch} className="card flex items-center justify-between gap-3 mb-2">
              <div>
                <div className="font-bold">Period {p.epoch}</div>
                <div className="text-sm">{p.vnd.map((v, i) => `${CARRIER_NAMES[i]}: ${vnd(v)}`).join(" · ")}</div>
                <div className="font-semibold">{usdc(big(totalUsdc))}</div>
              </div>
              {p.claimed ? <span className="font-semibold text-green-800">Claimed</span> : (
                <button className="btn-ok" disabled={left > 0 || pending} onClick={() => claim(p.epoch)}>
                  {pending ? "Pending…" : left > 0 ? `Claim in ${countdown(left)}` : "Claim"}
                </button>
              )}
            </div>
          );
        })}
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b-2 border-neutral-200"><th className="py-1 pr-2">Carrier</th><th className="pr-2">Order</th><th className="pr-2">Kind</th><th className="pr-2 text-right">Amount</th><th className="pr-2">Time</th><th>Tx</th></tr></thead>
            <tbody>
              {s.history.map((h) => (
                <tr key={h.tx} className="border-b border-neutral-100">
                  <td className="py-1 pr-2">{CARRIER_NAMES[h.carrier]}</td>
                  <td className="pr-2 font-mono">{h.code}</td>
                  <td className="pr-2">{h.kind === 1 ? "Delivered" : "Returned"}</td>
                  <td className={`pr-2 text-right font-semibold ${h.delta < 0 ? "text-red-700" : "text-green-800"}`}>{vnd(h.delta)}</td>
                  <td className="pr-2 whitespace-nowrap">{when(h.time)}</td>
                  <td><Tx hash={h.tx} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {s.history.length === 0 && <p className="text-neutral-600 py-2">No settlements yet. Mark an order delivered on the Courier page.</p>}
        </div>
      </section>
    </div>
  );
}

export function SimAdmin() {
  const s = useSim();
  const now = useNow();
  const [pending, setPending] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const prev = s.payouts[s.payouts.length - 1];
  const left = prev ? prev.claimableAt - now : 0;

  async function close() {
    setPending(true);
    setLastTx(await simClosePeriod());
    setPending(false);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">Admin</h1>
      <p className="text-sm text-neutral-600">Simulated hub owner wallet connected.</p>
      <section className="card space-y-2">
        <div className="text-sm text-neutral-600">Current period</div>
        <div className="text-3xl font-extrabold">{s.epoch}</div>
        <div className="text-sm">Dispute window {SIM_WINDOW} s · rate {SIM_RATE.toLocaleString("vi-VN")} VND = 1 USDC</div>
        <button className="btn-primary" disabled={pending} onClick={close}>{pending ? "Pending…" : "Close period"}</button>
        {lastTx && <p className="text-sm">Tx: <Tx hash={lastTx} /></p>}
        {prev && (
          <p className="font-semibold">
            Period {prev.epoch}: {left > 0 ? `dispute window open, claims in ${countdown(left)}` : "claims are open"}
          </p>
        )}
      </section>
      <section>
        <h2 className="text-lg font-bold mb-2">Registered carriers</h2>
        <ul className="space-y-2">
          {CARRIER_NAMES.map((n, i) => (
            <li key={n} className="card text-sm">
              <div className="font-bold text-base">#{i + 1} {n}</div>
              <div>Own Avalanche L1 · ledger and escrow registered on the hub</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function SimCarrier() {
  const s = useSim();
  const [ci, setCi] = useState(0);
  const [amount, setAmount] = useState("100");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const e = s.escrow[ci];

  async function deposit() {
    setPending(true);
    setError(null);
    try { await simDeposit(ci, Number(amount)); } catch (err) { setError((err as Error).message); }
    setPending(false);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">Carrier</h1>
      <div className="grid grid-cols-2 gap-2">
        {CARRIER_NAMES.map((n, i) => <button key={n} onClick={() => setCi(i)} className={i === ci ? "btn-primary" : "btn-ghost"}>{n}</button>)}
      </div>
      <p className="text-sm text-neutral-600">Simulated carrier wallet connected.</p>
      <Err msg={error} />
      <section className="grid grid-cols-3 gap-3">
        {([["Escrow balance", e.balance], ["Committed", e.committed], ["Available", e.balance - e.committed]] as const).map(([l, v]) => (
          <div key={l} className="card"><div className="text-xs font-semibold text-neutral-600">{l}</div><div className="text-lg font-extrabold">{usdc(big(v))}</div></div>
        ))}
      </section>
      <section className="card space-y-2">
        <h2 className="font-bold">Deposit USDC</h2>
        <p className="text-sm">Wallet balance: {usdc(big(s.carrierUsdc))}</p>
        <div className="flex gap-2">
          <input className="border-2 border-neutral-950 rounded-xl px-3 py-2 w-32 text-lg" inputMode="decimal" value={amount} onChange={(x) => setAmount(x.target.value)} />
          <button className="btn-primary" disabled={pending} onClick={deposit}>{pending ? "Pending…" : "Approve & deposit"}</button>
        </div>
      </section>
      <section>
        <h2 className="text-lg font-bold mb-2">Messages sent to the hub</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b-2 border-neutral-200"><th className="py-1">Seq</th><th>Order</th><th>Kind</th><th>Status</th><th>Tx</th></tr></thead>
          <tbody>
            {s.msgs.filter((m) => m.carrier === ci).map((m) => (
              <tr key={m.tx} className="border-b border-neutral-100">
                <td className="py-1">{m.seq}</td>
                <td className="font-mono">{m.code}</td>
                <td>{m.kind === 1 ? "Delivered" : "Returned"}</td>
                <td className={m.recorded ? "text-green-800 font-semibold" : "text-orange-700 font-semibold"}>{m.recorded ? "recorded on hub" : "sent"}</td>
                <td><Tx hash={m.tx} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {s.msgs.filter((m) => m.carrier === ci).length === 0 && <p className="text-neutral-600 py-2">No messages yet.</p>}
      </section>
    </div>
  );
}

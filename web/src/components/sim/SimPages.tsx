"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { countdown, short, usdc, usdcFromVnd, vnd, when } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { RoleGate } from "./Wallet";
import {
  CARRIER_NAMES, SIM_RATE, SIM_WINDOW, simClaim, simClosePeriod, simCourier, simDeposit, useSim, type SimMsg,
} from "@/lib/sim";

const DOT = ["bg-rose-400", "bg-sky-400"];
const big = (n: number) => BigInt(Math.trunc(n));
const EMPTY_STATE = "rounded-2xl border border-dashed border-white/15 p-6 text-center text-slate-400";

const Err = ({ msg }: { msg: string | null }) =>
  msg ? <p className="rounded-xl bg-rose-500/10 ring-1 ring-rose-400/40 p-3 font-semibold text-rose-200">{msg}</p> : null;
const Tx = ({ hash }: { hash: string }) => <span className="font-mono text-slate-500" title="Receipt ID (simulated)">{short(hash)}</span>;

function Head({ title, role }: { title: string; role: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
      <span className="chip bg-white/10 text-slate-300 ring-1 ring-white/15">You are the {role}</span>
    </div>
  );
}

/** Plain-language "what is going on" box shown at the top of each page. */
function Explain({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-sky-500/10 p-4 text-sm leading-relaxed text-sky-100 ring-1 ring-sky-400/25">
      <span className="text-lg" aria-hidden>💡</span>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function CarrierTabs({ ci, setCi, counts, label }: { ci: number; setCi: (i: number) => void; counts?: string[]; label: string }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="seg">
        {CARRIER_NAMES.map((n, i) => (
          <button key={n} onClick={() => setCi(i)} className={`flex items-center justify-center gap-2 ${i === ci ? "seg-on" : "seg-off"}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${DOT[i]}`} />{n}
            {counts && <span className="hidden sm:inline text-xs font-medium text-slate-400">· {counts[i]}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Where a driver's tap goes: company records -> shared ledger. */
function Pipeline({ msg }: { msg?: SimMsg }) {
  const stage = !msg ? -1 : msg.recorded ? 3 : 1;
  const nodes = [["Company saves it", "parcel marked"], ["Sent to the ledger", "on its way"], ["Shared ledger", "shop balance updated"]];
  return (
    <div className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <h2 className="font-bold">What happens after you tap</h2>
        <span className="text-xs text-slate-400">
          {msg ? `${msg.code} · ${CARRIER_NAMES[msg.carrier]}` : "Tap a parcel below to see it travel"}
        </span>
      </div>
      <div className="mt-4 flex items-start">
        {nodes.map(([t, d], i) => {
          const done = stage === 3 || stage > i;
          const active = stage === i;
          return (
            <div key={t} className="flex flex-1 items-start last:flex-none">
              <div className="flex w-20 flex-col items-center text-center sm:w-28">
                <span className={`grid h-10 w-10 place-items-center rounded-full text-sm font-extrabold transition ${done ? "bg-emerald-500 text-emerald-950" : active ? "bg-brand text-white animate-pulse" : "bg-white/10 text-slate-400"}`}>
                  {done ? "✓" : i + 1}
                </span>
                <span className="mt-1.5 text-xs font-bold">{t}</span>
                <span className="text-[11px] text-slate-400">{d}</span>
              </div>
              {i < nodes.length - 1 && (
                <div className="relative mx-1 mt-[18px] h-1 flex-1 overflow-hidden rounded bg-white/10">
                  {(stage === 3 || (stage === 1 && i === 0)) && <div className="absolute inset-0 bg-emerald-500" />}
                  {stage === 1 && i === 1 && <div className="flow-bar absolute inset-y-0 w-1/3 rounded bg-brand" />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CourierBody() {
  const s = useSim();
  const [ci, setCi] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(code: string, action: "delivered" | "returned") {
    setBusy(code);
    setError(null);
    try { await simCourier(code, action); } catch (e) { setError((e as Error).message); }
    setBusy(null);
  }
  const mine = s.orders.filter((o) => o.carrier === ci);
  const todo = mine.filter((o) => o.status < 3);
  const done = mine.filter((o) => o.status >= 3);
  const left = (c: number) => `${s.orders.filter((o) => o.carrier === c && o.status < 3).length} parcels left`;

  return (
    <div className="space-y-5">
      <Head title="Delivery driver" role="delivery driver" />
      <Explain>
        <p>You drive for a shipping company. Every parcel below is paid <b>in cash by the customer</b> when you hand it over.</p>
        <p>Tap <b>Delivered &amp; paid</b> after you collect the cash, or <b>Returned</b> if the customer refused. That instantly tells the shop owner how much money is now on its way to them.</p>
      </Explain>
      <CarrierTabs ci={ci} setCi={setCi} counts={[left(0), left(1)]} label="Which company do you drive for?" />
      <Pipeline msg={s.msgs[0]} />
      <Err msg={error} />

      {todo.length === 0 && <div className={EMPTY_STATE}>All {CARRIER_NAMES[ci]} parcels are done. Switch company, or follow the next step in the bar below.</div>}
      <ul className="space-y-2">
        {todo.map((o) => {
          const isBusy = busy === o.code;
          return (
            <li key={o.code} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-400">Parcel {o.code}</div>
                <div className="text-sm text-slate-400">Customer pays in cash: <b className="num text-xl text-white">{vnd(o.cod)}</b></div>
              </div>
              {isBusy ? (
                <span className="font-semibold text-orange-300 animate-pulse">Saving…</span>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:w-96">
                  <button className="btn-ok whitespace-nowrap" onClick={() => run(o.code, "delivered")}>Delivered &amp; paid</button>
                  <button className="btn-ghost text-rose-300" onClick={() => run(o.code, "returned")}>Returned</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {done.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-400">Already done ({done.length})</h2>
          <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.02]">
            {done.map((o) => (
              <li key={o.code} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-semibold">{o.code}</span>
                <span className="num text-slate-400">{vnd(o.cod)}</span>
                <span className={`chip ${o.status === 3 ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>{o.status === 3 ? "Delivered" : "Returned"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SellerBody() {
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
    <div className="space-y-6">
      <Head title="Shop owner" role="shop owner" />
      <Explain>
        <p>You are <b>Lan</b>, an online shop owner. Two shipping companies deliver your parcels and collect cash from your customers.</p>
        <p>The big number is <b>everything the companies owe you right now</b>, added up. It grows every time a driver marks a parcel delivered. Once the payment manager closes a round, you can withdraw it all in one tap.</p>
      </Explain>
      <Err msg={error} />

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-[#0b1120] p-6 ring-1 ring-white/10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/30 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-400">Total owed to you</div>
            <div className="num text-4xl font-extrabold tracking-tight sm:text-5xl">{vnd(total)}</div>
            <div className="mt-1 text-slate-300">≈ {usdc(usdcFromVnd(big(total), BigInt(SIM_RATE)))} <span className="text-slate-500">(digital dollars)</span></div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-slate-400">Money you have withdrawn</div>
            <div className="num text-2xl font-extrabold text-emerald-400">{usdc(big(s.sellerUsdc))}</div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Who owes you what</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {CARRIER_NAMES.map((n, i) => (
            <div key={n} className="card">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-400"><span className={`h-2.5 w-2.5 rounded-full ${DOT[i]}`} />{n} owes you</div>
              <div className="num mt-1 text-2xl font-extrabold">{vnd(s.balances[i])}</div>
              <div className="text-sm text-slate-500">≈ {usdc(usdcFromVnd(big(s.balances[i]), BigInt(SIM_RATE)))}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Ready to withdraw</h2>
        {payouts.length === 0 && <div className={EMPTY_STATE}>Nothing yet. After the payment manager closes a round, your money shows up here.</div>}
        {payouts.map((p) => {
          const left = p.claimableAt - now;
          const totalUsdc = p.usdc.reduce((a, x) => a + x, 0);
          const pct = Math.min(100, Math.max(0, ((SIM_WINDOW - left) / SIM_WINDOW) * 100));
          return (
            <div key={p.epoch} className="card mb-2 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold">Payment round {p.epoch}</div>
                  <div className="text-sm text-slate-400">{p.vnd.map((v, i) => `${CARRIER_NAMES[i]}: ${vnd(v)}`).join(" · ")}</div>
                  <div className="num text-xl font-extrabold">{usdc(big(totalUsdc))}</div>
                </div>
                {p.claimed ? <span className="chip bg-emerald-500/15 text-sm text-emerald-300">Withdrawn ✓</span> : (
                  <button className="btn-ok min-w-40" disabled={left > 0 || pending} onClick={() => claim(p.epoch)}>
                    {pending ? "Working…" : left > 0 ? `Withdraw in ${countdown(left)}` : "Withdraw money"}
                  </button>
                )}
              </div>
              {!p.claimed && (
                <div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${pct}%` }} /></div>
                  <div className="mt-1 text-xs text-slate-400">
                    {left > 0
                      ? `Short waiting time (${SIM_WINDOW} s in this demo, days in real life) so a shipping company can flag a mistake before money moves.`
                      : "Waiting time is over. You can withdraw now."}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Every delivery that counted</h2>
        {s.history.length === 0 ? (
          <div className={EMPTY_STATE}>Nothing yet. <Link href="/courier" className="font-semibold text-brand underline">Mark a parcel delivered</Link> as the driver and it appears here.</div>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead><tr className="bg-white/5 text-left text-slate-400"><th className="px-3 py-2">Company</th><th>Parcel</th><th>Result</th><th className="text-right">Added to your balance</th><th className="pl-4">Time</th><th className="px-3">Receipt</th></tr></thead>
              <tbody>
                {s.history.map((h) => (
                  <tr key={h.tx} className="border-t border-white/5">
                    <td className="px-3 py-2">{CARRIER_NAMES[h.carrier]}</td>
                    <td className="font-mono">{h.code}</td>
                    <td><span className={`chip ${h.kind === 1 ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>{h.kind === 1 ? "Delivered" : "Returned"}</span></td>
                    <td className={`num text-right font-bold ${h.delta < 0 ? "text-rose-300" : "text-emerald-300"}`}>{vnd(h.delta)}</td>
                    <td className="whitespace-nowrap pl-4 text-slate-400">{when(h.time)}</td>
                    <td className="px-3"><Tx hash={h.tx} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-between gap-3 py-1.5">{children}</div>;
}

function AdminBody() {
  const s = useSim();
  const now = useNow();
  const [pending, setPending] = useState(false);
  const prev = s.payouts[s.payouts.length - 1];
  const left = prev ? prev.claimableAt - now : 0;
  const pay = s.balances.map((b) => Math.max(b, 0));
  const payUsdc = pay.map((v) => Math.floor((v * 1e6) / SIM_RATE));
  const nothing = pay.every((v) => v === 0);

  async function close() {
    setPending(true);
    await simClosePeriod();
    setPending(false);
  }

  return (
    <div className="space-y-6">
      <Head title="Payment manager" role="payment manager" />
      <Explain>
        <p>Every so often you close a <b>payment round</b>, like a payday. Everything the shipping companies owe the shop so far turns into one payout.</p>
        <p>Returned parcels cost the shop a small fee. If a company&apos;s total is negative, it simply carries over to the next round.</p>
      </Explain>
      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-400">Current payment round</div>
            <div className="num text-5xl font-extrabold tracking-tight">{s.epoch}</div>
          </div>
          <div className="text-right text-sm text-slate-400">
            <div>Waiting time before payout <b className="text-slate-200">{SIM_WINDOW} s</b></div>
            <div>Demo rate <b className="text-slate-200">{SIM_RATE.toLocaleString("vi-VN")} ₫</b> = 1 USDC</div>
          </div>
        </div>

        <div className="rounded-xl bg-white/5 px-4 py-2 ring-1 ring-white/10">
          <div className="pt-1 text-xs font-bold uppercase tracking-wide text-slate-400">If you close the round now, the shop owner can withdraw</div>
          {CARRIER_NAMES.map((n, i) => (
            <Row key={n}>
              <span className="flex items-center gap-2 text-slate-300"><span className={`h-2.5 w-2.5 rounded-full ${DOT[i]}`} />{n}</span>
              <span className="num text-sm text-slate-400">{vnd(pay[i])} → <b className="text-white">{usdc(big(payUsdc[i]))}</b></span>
            </Row>
          ))}
          <div className="num mt-1 border-t border-white/10 py-2 text-right font-extrabold text-emerald-300">Total {usdc(big(payUsdc.reduce((a, b) => a + b, 0)))}</div>
        </div>

        <button className="btn-primary w-full py-4 text-lg" disabled={pending || nothing} onClick={close}>{pending ? "Working…" : "Close payment round"}</button>
        {nothing && <p className="text-sm text-slate-400">Nothing to pay yet. <Link href="/courier" className="font-semibold text-brand underline">Deliver a parcel</Link> as the driver first.</p>}
        {prev && (
          <p className={`rounded-xl p-3 text-sm font-semibold ${left > 0 ? "bg-amber-500/10 text-amber-300" : "bg-emerald-500/10 text-emerald-300"}`}>
            Round {prev.epoch}: {left > 0 ? `waiting time running, shop owner can withdraw in ${countdown(left)}` : "the shop owner can withdraw now"}
          </p>
        )}
      </section>
      <section>
        <h2 className="mb-2 text-lg font-bold">Shipping companies on the ledger</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {CARRIER_NAMES.map((n, i) => (
            <li key={n} className="card">
              <div className="flex items-center gap-2 font-bold"><span className={`h-2.5 w-2.5 rounded-full ${DOT[i]}`} />{n}</div>
              <div className="mt-1 text-sm text-slate-400">Reports every delivery to the shared ledger and keeps money in reserve to pay shops.</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CarrierBody() {
  const s = useSim();
  const [ci, setCi] = useState(0);
  const [amount, setAmount] = useState("100");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const e = s.escrow[ci];
  const mine = s.msgs.filter((m) => m.carrier === ci);

  async function deposit() {
    setPending(true);
    setError(null);
    try { await simDeposit(ci, Number(amount)); } catch (err) { setError((err as Error).message); }
    setPending(false);
  }

  return (
    <div className="space-y-5">
      <Head title="Shipping company" role="shipping company" />
      <Explain>
        <p>Shops trust a payment more when the money is already there. So before paying anyone, a shipping company keeps funds <b>in reserve</b>.</p>
        <p>This page is optional for the demo. Add practice money to the reserve and watch the records your drivers send to the shared ledger.</p>
      </Explain>
      <CarrierTabs ci={ci} setCi={setCi} label="Which company are you?" />
      <Err msg={error} />
      <section className="grid grid-cols-3 gap-3">
        {([["In reserve", e.balance, "", "All money set aside"], ["Promised to shops", e.committed, "text-amber-300", "Already owed in closed rounds"], ["Free to use", e.balance - e.committed, "text-emerald-300", "Not promised yet"]] as const).map(([l, v, c, hint]) => (
          <div key={l} className="card"><div className="text-xs font-semibold text-slate-400">{l}</div><div className={`num text-base font-extrabold sm:text-xl ${c}`}>{usdc(big(v))}</div><div className="mt-0.5 hidden text-[11px] text-slate-500 sm:block">{hint}</div></div>
        ))}
      </section>
      <section className="card space-y-3">
        <h2 className="font-bold">Add money to the reserve</h2>
        <p className="text-sm text-slate-400">Your practice wallet has <b className="text-slate-200">{usdc(big(s.carrierUsdc))}</b></p>
        <div className="flex gap-2">
          <input className="w-32 rounded-xl border border-white/15 bg-white/90 px-3 py-2 text-lg focus:border-brand focus:outline-none" inputMode="decimal" value={amount} onChange={(x) => setAmount(x.target.value)} aria-label="Amount in USDC" />
          <button className="btn-primary" disabled={pending} onClick={deposit}>{pending ? "Working…" : "Add to reserve"}</button>
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-bold">Records you have sent to the ledger</h2>
        {mine.length === 0 ? (
          <div className={EMPTY_STATE}>None yet. A record is sent each time a driver marks a parcel.</div>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead><tr className="bg-white/5 text-left text-slate-400"><th className="px-3 py-2">#</th><th>Parcel</th><th>Result</th><th>Status</th><th className="px-3">Receipt</th></tr></thead>
              <tbody>
                {mine.map((m) => (
                  <tr key={m.tx} className="border-t border-white/5">
                    <td className="px-3 py-2">{m.seq}</td>
                    <td className="font-mono">{m.code}</td>
                    <td>{m.kind === 1 ? "Delivered" : "Returned"}</td>
                    <td><span className={`chip ${m.recorded ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>{m.recorded ? "on the ledger" : "on its way"}</span></td>
                    <td className="px-3"><Tx hash={m.tx} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function SimCourier() {
  return <RoleGate role="courier"><CourierBody /></RoleGate>;
}
export function SimSeller() {
  return <RoleGate role="seller"><SellerBody /></RoleGate>;
}
export function SimAdmin() {
  return <RoleGate role="admin"><AdminBody /></RoleGate>;
}
export function SimCarrier() {
  return <RoleGate role="carrier"><CarrierBody /></RoleGate>;
}

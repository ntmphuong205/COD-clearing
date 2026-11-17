"use client";
import { useState, type ReactNode } from "react";
import { countdown, short, usdc, usdcFromVnd, vnd, when } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import {
  CARRIER_NAMES, SIM_RATE, SIM_WINDOW, simClaim, simClosePeriod, simCourier, simDeposit, useSim, type SimMsg,
} from "@/lib/sim";

const STATUS = ["-", "Created", "Picked up", "Delivered", "Returned"];
const STATUS_CHIP: Record<number, string> = {
  2: "bg-amber-100 text-amber-800", 3: "bg-emerald-100 text-emerald-800", 4: "bg-rose-100 text-rose-800",
};
const DOT = ["bg-rose-500", "bg-sky-500"];
type Action = "pickup" | "delivered" | "returned";
const LABEL: Record<Action, string> = { pickup: "Picked up", delivered: "Delivered & paid", returned: "Returned" };
const big = (n: number) => BigInt(Math.trunc(n));

const Err = ({ msg }: { msg: string | null }) =>
  msg ? <p className="rounded-xl bg-rose-50 ring-1 ring-rose-200 p-3 font-semibold text-rose-800">{msg}</p> : null;
const Tx = ({ hash }: { hash: string }) => <span className="font-mono text-slate-500" title="Simulated transaction hash">{short(hash)}</span>;

function Head({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1 text-slate-600">{sub}</p>
    </div>
  );
}

function CarrierTabs({ ci, setCi }: { ci: number; setCi: (i: number) => void }) {
  return (
    <div className="seg">
      {CARRIER_NAMES.map((n, i) => (
        <button key={n} onClick={() => setCi(i)} className={`flex items-center justify-center gap-2 ${i === ci ? "seg-on" : "seg-off"}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${DOT[i]}`} />{n}
        </button>
      ))}
    </div>
  );
}

/** Live view of the last cross-chain message: carrier ledger -> ICM relay -> hub. */
function Pipeline({ msg }: { msg?: SimMsg }) {
  const stage = !msg ? -1 : msg.recorded ? 3 : 1;
  const nodes = [
    ["Carrier ledger", "order written"],
    ["ICM relay", "in flight"],
    ["Settlement hub", "balance updated"],
  ];
  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-bold">Cross-chain message</h2>
        <span className="text-xs text-slate-500">
          {msg ? `${msg.code} · ${CARRIER_NAMES[msg.carrier]} · seq ${msg.seq}` : "Waiting for the first delivery"}
        </span>
      </div>
      <div className="mt-4 flex items-start">
        {nodes.map(([t, d], i) => {
          const done = stage > i || stage === 3;
          const active = stage === i;
          return (
            <div key={t} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center text-center w-28">
                <span className={`grid h-10 w-10 place-items-center rounded-full text-sm font-extrabold transition ${done ? "bg-emerald-500 text-white" : active ? "bg-brand text-white animate-pulse" : "bg-slate-200 text-slate-500"}`}>
                  {done ? "✓" : i + 1}
                </span>
                <span className="mt-1.5 text-xs font-bold">{t}</span>
                <span className="text-[11px] text-slate-500">{d}</span>
              </div>
              {i < nodes.length - 1 && (
                <div className="relative mx-1 mt-[18px] h-1 flex-1 overflow-hidden rounded bg-slate-200">
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

function Stat({ children }: { children: ReactNode }) {
  return <div className="card">{children}</div>;
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
  const open = list.filter((o) => o.status < 3).length;

  return (
    <div className="space-y-5">
      <Head title="Courier" sub="Mark each parcel when it is delivered or returned. Each tap becomes one message to the hub." />
      <CarrierTabs ci={ci} setCi={setCi} />
      <Pipeline msg={s.msgs[0]} />
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span><b className="text-slate-900">{open}</b> of {list.length} orders still to deliver</span>
        {lastTx && <span>Last tx <Tx hash={lastTx} /></span>}
      </div>
      <Err msg={error} />
      <ul className="space-y-3">
        {list.map((o) => {
          const isBusy = busy === o.code;
          const done = o.status >= 3;
          const isConfirming = confirm?.code === o.code;
          return (
            <li key={o.code} className={`card transition ${done ? "bg-slate-50 opacity-75" : "hover:shadow-md"}`}>
              <div className="flex items-center justify-between">
                <span className="text-lg font-extrabold tracking-tight">{o.code}</span>
                <span className={`chip ${STATUS_CHIP[o.status]}`}>{STATUS[o.status]}</span>
              </div>
              <p className="mt-1 text-slate-600">Collect cash <b className="text-slate-900 text-xl">{vnd(o.cod)}</b></p>
              {isBusy && <p className="mt-3 font-bold text-brand animate-pulse">Pending… waiting for the block</p>}
              {!isBusy && !isConfirming && o.status === 2 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button className="btn-ok col-span-2 py-4 text-lg" onClick={() => setConfirm({ code: o.code, action: "delivered" })}>Delivered &amp; paid</button>
                  <button className="btn-ghost py-4 text-rose-700" onClick={() => setConfirm({ code: o.code, action: "returned" })}>Returned</button>
                </div>
              )}
              {!isBusy && isConfirming && (
                <div className="mt-3 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3">
                  <p className="font-bold">Confirm: {LABEL[confirm.action]}?</p>
                  <p className="text-sm text-slate-600">This is sent to the carrier ledger and cannot be undone.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
                    <button className={confirm.action === "returned" ? "btn-warn" : "btn-ok"} onClick={() => run(o.code, confirm.action)}>Confirm</button>
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
    <div className="space-y-6">
      <Head title="Seller" sub="One live balance across every carrier, and one payout when the period closes." />
      <Err msg={error} />

      <section className="relative overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/40 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-400">Net balance owed to you</div>
            <div className="text-4xl sm:text-5xl font-extrabold tracking-tight">{vnd(total)}</div>
            <div className="mt-1 text-slate-300">≈ {usdc(usdcFromVnd(big(total), BigInt(SIM_RATE)))}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-slate-400">USDC received so far</div>
            <div className="text-2xl font-extrabold text-emerald-400">{usdc(big(s.sellerUsdc))}</div>
          </div>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 gap-3">
        {CARRIER_NAMES.map((n, i) => (
          <Stat key={n}>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-600"><span className={`h-2.5 w-2.5 rounded-full ${DOT[i]}`} />{n}</div>
            <div className="mt-1 text-2xl font-extrabold">{vnd(s.balances[i])}</div>
            <div className="text-sm text-slate-500">≈ {usdc(usdcFromVnd(big(s.balances[i]), BigInt(SIM_RATE)))}</div>
          </Stat>
        ))}
      </section>

      <Pipeline msg={s.msgs[0]} />

      <section>
        <h2 className="mb-2 text-lg font-bold">Claimable payouts</h2>
        {payouts.length === 0 && <div className="card text-slate-500">None yet. Payouts appear after the admin closes a period.</div>}
        {payouts.map((p) => {
          const left = p.claimableAt - now;
          const totalUsdc = p.usdc.reduce((a, x) => a + x, 0);
          const pct = Math.min(100, Math.max(0, ((SIM_WINDOW - left) / SIM_WINDOW) * 100));
          return (
            <div key={p.epoch} className="card mb-2 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold">Period {p.epoch}</div>
                  <div className="text-sm text-slate-600">{p.vnd.map((v, i) => `${CARRIER_NAMES[i]}: ${vnd(v)}`).join(" · ")}</div>
                  <div className="text-xl font-extrabold">{usdc(big(totalUsdc))}</div>
                </div>
                {p.claimed ? <span className="chip bg-emerald-100 text-emerald-800 text-sm">Claimed ✓</span> : (
                  <button className="btn-ok min-w-36" disabled={left > 0 || pending} onClick={() => claim(p.epoch)}>
                    {pending ? "Pending…" : left > 0 ? `Claim in ${countdown(left)}` : "Claim USDC"}
                  </button>
                )}
              </div>
              {!p.claimed && (
                <div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} /></div>
                  <div className="mt-1 text-xs text-slate-500">{left > 0 ? "Dispute window open" : "Dispute window closed, ready to claim"}</div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">History</h2>
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left text-slate-500"><th className="px-3 py-2">Carrier</th><th>Order</th><th>Kind</th><th className="text-right">Amount</th><th className="pl-4">Time</th><th className="px-3">Tx</th></tr></thead>
            <tbody>
              {s.history.map((h) => (
                <tr key={h.tx} className="border-t border-slate-100">
                  <td className="px-3 py-2">{CARRIER_NAMES[h.carrier]}</td>
                  <td className="font-mono">{h.code}</td>
                  <td><span className={`chip ${h.kind === 1 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>{h.kind === 1 ? "Delivered" : "Returned"}</span></td>
                  <td className={`text-right font-bold ${h.delta < 0 ? "text-rose-700" : "text-emerald-700"}`}>{vnd(h.delta)}</td>
                  <td className="whitespace-nowrap pl-4 text-slate-500">{when(h.time)}</td>
                  <td className="px-3"><Tx hash={h.tx} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {s.history.length === 0 && <p className="p-4 text-slate-500">No settlements yet. Mark an order delivered on the Courier page.</p>}
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
    <div className="space-y-6">
      <Head title="Admin" sub="Close the period: positive balances become payouts, negative ones carry over." />
      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-500">Current period</div>
            <div className="text-5xl font-extrabold tracking-tight">{s.epoch}</div>
          </div>
          <div className="text-right text-sm text-slate-600">
            <div>Dispute window <b>{SIM_WINDOW} s</b></div>
            <div>Rate <b>{SIM_RATE.toLocaleString("vi-VN")} VND</b> = 1 USDC</div>
          </div>
        </div>
        <button className="btn-primary w-full py-4 text-lg" disabled={pending} onClick={close}>{pending ? "Pending…" : "Close period"}</button>
        {lastTx && <p className="text-sm text-slate-600">Tx <Tx hash={lastTx} /></p>}
        {prev && (
          <p className={`rounded-xl p-3 font-semibold ${left > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
            Period {prev.epoch}: {left > 0 ? `dispute window open, claims in ${countdown(left)}` : "claims are open"}
          </p>
        )}
      </section>
      <section>
        <h2 className="mb-2 text-lg font-bold">Registered carriers</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {CARRIER_NAMES.map((n, i) => (
            <li key={n} className="card">
              <div className="flex items-center gap-2 font-bold"><span className={`h-2.5 w-2.5 rounded-full ${DOT[i]}`} />#{i + 1} {n}</div>
              <div className="mt-1 text-sm text-slate-600">Own Avalanche L1 · ledger and escrow registered on the hub</div>
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
  const mine = s.msgs.filter((m) => m.carrier === ci);

  async function deposit() {
    setPending(true);
    setError(null);
    try { await simDeposit(ci, Number(amount)); } catch (err) { setError((err as Error).message); }
    setPending(false);
  }

  return (
    <div className="space-y-5">
      <Head title="Carrier" sub="Pre-fund the escrow that pays sellers, and watch messages reach the hub." />
      <CarrierTabs ci={ci} setCi={setCi} />
      <Err msg={error} />
      <section className="grid grid-cols-3 gap-3">
        {([["Escrow balance", e.balance, ""], ["Committed", e.committed, "text-amber-700"], ["Available", e.balance - e.committed, "text-emerald-700"]] as const).map(([l, v, c]) => (
          <Stat key={l}><div className="text-xs font-semibold text-slate-500">{l}</div><div className={`text-lg sm:text-xl font-extrabold ${c}`}>{usdc(big(v))}</div></Stat>
        ))}
      </section>
      <section className="card space-y-3">
        <h2 className="font-bold">Deposit USDC</h2>
        <p className="text-sm text-slate-600">Wallet balance: <b>{usdc(big(s.carrierUsdc))}</b></p>
        <div className="flex gap-2">
          <input className="w-32 rounded-xl border border-slate-300 px-3 py-2 text-lg focus:border-brand focus:outline-none" inputMode="decimal" value={amount} onChange={(x) => setAmount(x.target.value)} />
          <button className="btn-primary" disabled={pending} onClick={deposit}>{pending ? "Pending…" : "Approve & deposit"}</button>
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-bold">Messages sent to the hub</h2>
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left text-slate-500"><th className="px-3 py-2">Seq</th><th>Order</th><th>Kind</th><th>Status</th><th className="px-3">Tx</th></tr></thead>
            <tbody>
              {mine.map((m) => (
                <tr key={m.tx} className="border-t border-slate-100">
                  <td className="px-3 py-2">{m.seq}</td>
                  <td className="font-mono">{m.code}</td>
                  <td>{m.kind === 1 ? "Delivered" : "Returned"}</td>
                  <td><span className={`chip ${m.recorded ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{m.recorded ? "recorded on hub" : "in flight"}</span></td>
                  <td className="px-3"><Tx hash={m.tx} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {mine.length === 0 && <p className="p-4 text-slate-500">No messages yet.</p>}
        </div>
      </section>
    </div>
  );
}

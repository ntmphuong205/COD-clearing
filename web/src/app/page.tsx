import Link from "next/link";
import { MODE } from "@/lib/mode";

const BEFORE = [
  ["🧾", "Two spreadsheets", "Each company sends its own, in its own format."],
  ["⏳", "Paid late", "Money arrives days or weeks after the customer paid."],
  ["❓", "Hard to check", "If a number looks wrong, there is nothing to compare it with."],
];
const AFTER = [
  ["📒", "One shared ledger", "Updated the moment a driver marks a parcel delivered."],
  ["💸", "One payout", "A single withdrawal covers every shipping company."],
  ["✅", "Anyone can verify", "Every entry has a receipt that cannot be changed later."],
];

const STEPS = [
  ["/courier", "1", "As the delivery driver", "A customer hands over cash. Tap “Delivered & paid” and watch the record travel to the shared ledger."],
  ["/admin", "2", "As the payment manager", "Close the payment round, like a payday. Everything owed turns into one payout."],
  ["/seller", "3", "As Lan, the shop owner", "After a short waiting time, withdraw the money from both companies in one tap."],
];

const WORDS = [
  ["Shared ledger", "A record book that everyone involved can read and nobody can secretly change. Built on the Avalanche blockchain."],
  ["Cash on delivery (COD)", "The customer pays cash to the driver when the parcel arrives. The shipping company holds that cash until it pays the shop."],
  ["Payment round", "A time window, like a pay period. When it closes, what is owed gets turned into a payout."],
  ["Waiting time", "A short pause before money moves, so a shipping company can flag a mistake. 60 seconds in this demo, days in real life."],
  ["Money in reserve", "Funds a shipping company sets aside in advance to guarantee the shop will be paid."],
  ["USDC", "A digital dollar always worth $1. Used here for payouts. In this demo it is practice money."],
  ["Wallet", "Like a login for the blockchain. In this demo it is simulated: you just pick who you want to be."],
];

export default function Home() {
  return (
    <div className="space-y-14">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-[#0b1120] px-6 py-12 ring-1 ring-white/10 sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/40 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="relative">
          <span className="chip bg-white/10 text-rose-200 ring-1 ring-white/20">Built on Avalanche · Team Snowball</span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Online shops get paid <span className="bg-gradient-to-r from-brand to-orange-400 bg-clip-text text-transparent">fairly and on time</span>.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-300">
            When a customer pays cash on delivery, the shipping company keeps the money and pays the shop weeks later. COD Clearing puts every
            delivery on one shared record, so the shop always knows what it is owed and gets paid in one go.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/courier" className="btn-primary px-6 py-3.5 text-lg">Try the demo (3 minutes) →</Link>
            <a href="#problem" className="btn bg-white/10 px-6 py-3.5 text-lg text-white ring-1 ring-white/25 hover:bg-white/20">See the problem first</a>
          </div>
        </div>
      </section>

      <section id="problem" className="scroll-mt-20 space-y-5">
        <div className="max-w-3xl space-y-2">
          <h2 className="text-2xl font-extrabold tracking-tight">Meet Lan</h2>
          <p className="text-lg text-slate-300">
            Lan sells clothes online in Vietnam. She works with <b className="text-white">two shipping companies</b>. Every day their drivers collect cash
            from her customers. But each company pays her later, on its own schedule, with its own spreadsheet. Lan can never be sure how much she is owed.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card space-y-3 border-rose-400/20">
            <h3 className="font-bold text-rose-300">Today</h3>
            {BEFORE.map(([i, t, d]) => (
              <div key={t} className="flex gap-3"><span className="text-xl">{i}</span><div><div className="font-semibold">{t}</div><div className="text-sm text-slate-400">{d}</div></div></div>
            ))}
          </div>
          <div className="card space-y-3 border-emerald-400/30 bg-emerald-400/[0.04]">
            <h3 className="font-bold text-emerald-300">With COD Clearing</h3>
            {AFTER.map(([i, t, d]) => (
              <div key={t} className="flex gap-3"><span className="text-xl">{i}</span><div><div className="font-semibold">{t}</div><div className="text-sm text-slate-400">{d}</div></div></div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="max-w-3xl space-y-1">
          <h2 className="text-2xl font-extrabold tracking-tight">Try it yourself: play three roles</h2>
          <p className="text-slate-300">You do not need any knowledge of shipping or blockchain. Follow the three steps, in order. A bar at the bottom of every page tells you what to do next.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {STEPS.map(([h, n, t, d]) => (
            <Link key={n} href={h} className="card group flex flex-col gap-2 transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-lg font-extrabold group-hover:bg-brand">{n}</span>
              <span className="font-bold">{t}</span>
              <span className="text-sm text-slate-400">{d}</span>
              <span className="mt-auto pt-1 text-sm font-semibold text-brand">Open →</span>
            </Link>
          ))}
        </div>
        {MODE === "sim" && (
          <p className="text-sm text-slate-500">
            This hosted demo is a simulation that runs in your browser with the same rules as our real smart contracts. All money is practice money.
            Use <b>Reset</b> in the top bar to start over.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-extrabold tracking-tight">Words you will see</h2>
        <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03]">
          {WORDS.map(([t, d]) => (
            <details key={t} className="group px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                {t}<span className="text-slate-500 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-1.5 text-sm text-slate-400">{d}</p>
            </details>
          ))}
        </div>
      </section>

      <section>
        <details className="card group">
          <summary className="flex cursor-pointer list-none items-center justify-between font-bold">
            For technical readers<span className="text-slate-500 transition group-open:rotate-45">+</span>
          </summary>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Each shipping company runs its own Avalanche L1 with a delivery ledger contract. Marking a parcel delivered or returned sends a small
            ICM (Teleporter) message to a settlement hub on Fuji C-Chain. The message carries only an order hash, the seller&apos;s address and
            amounts, never buyer personal data. The hub keeps a net balance per carrier and seller, closes periods, and lets the seller claim one
            USDC payout from escrows the carriers pre-funded. The code, contracts and tests are in the GitHub repository.
          </p>
        </details>
      </section>
    </div>
  );
}

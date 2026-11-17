import Link from "next/link";
import { MODE } from "@/lib/mode";

const FLOW = [
  ["📦", "Courier", "Taps “Delivered & paid” on a phone."],
  ["⛓️", "Carrier L1", "The carrier's own Avalanche chain records the order."],
  ["✉️", "ICM message", "A tiny cross-chain message: hash, amounts, no buyer data."],
  ["🏦", "Settlement hub", "One net balance per carrier and seller."],
  ["💵", "Seller claims", "One USDC payout from every carrier's escrow."],
];

const STEPS = [
  ["/courier", "Courier", "Open Carrier A and mark an order Delivered & paid."],
  ["/seller", "Seller", "Watch the balance and History update as the message lands on the hub."],
  ["/admin", "Admin", "Close the period. Balances become payouts and a 60 s dispute window starts."],
  ["/seller", "Seller", "When the countdown ends, claim USDC from both escrows in one step."],
];

const STATS = [["2", "carrier L1s, one shared balance"], ["4", "roles in one flow: courier, seller, carrier, admin"], ["60 s", "dispute window in the demo"], ["0", "buyer personal data on-chain"]];

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-[#0b1120] ring-1 ring-white/10 px-6 py-12 sm:px-12 sm:py-16 text-white shadow-xl">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/40 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="relative">
          <span className="chip bg-white/10 text-rose-200 ring-1 ring-white/20">Built on Avalanche · Team Snowball</span>
          <h1 className="mt-5 text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05]">
            One number every <span className="bg-gradient-to-r from-brand to-orange-400 bg-clip-text text-transparent">carrier</span> agrees on.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-300">
            Online sellers in Vietnam ship with several carriers, and each one collects cash on delivery and pays out later from its own
            spreadsheet. COD Clearing turns every delivery into a verifiable balance, settled to the seller in a single payout.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/courier" className="btn-primary px-6 py-3.5 text-lg">Try the live demo →</Link>
            <a href="#how" className="btn bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20 px-6 py-3.5 text-lg">How it works</a>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STATS.map(([n, l]) => (
          <div key={l} className="card text-center">
            <div className="text-3xl font-extrabold text-brand">{n}</div>
            <div className="mt-1 text-sm text-slate-400">{l}</div>
          </div>
        ))}
      </section>

      <section id="how" className="space-y-4 scroll-mt-20">
        <h2 className="text-2xl font-extrabold tracking-tight">How a delivery becomes a payout</h2>
        <ol className="grid gap-3 md:grid-cols-5">
          {FLOW.map(([icon, t, d], i) => (
            <li key={t} className="relative card">
              <div className="text-2xl">{icon}</div>
              <div className="mt-2 font-bold">{t}</div>
              <p className="mt-1 text-sm text-slate-400">{d}</p>
              <span className="absolute right-3 top-3 text-xs font-bold text-slate-600">{i + 1}</span>
              {i < FLOW.length - 1 && <span className="hidden md:block absolute -right-3 top-1/2 z-10 -translate-y-1/2 text-slate-500">›</span>}
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-extrabold tracking-tight">Try it in four steps</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {STEPS.map(([h, t, d], i) => (
            <Link key={i} href={h} className="card group flex gap-4 transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-lg font-extrabold text-white group-hover:bg-brand">{i + 1}</span>
              <span>
                <span className="block font-bold">{t}</span>
                <span className="block text-sm text-slate-400">{d}</span>
              </span>
            </Link>
          ))}
        </div>
        {MODE === "sim" && (
          <p className="text-sm text-slate-500">
            This hosted page is a simulation of the system: it runs in your browser with the same rules as the contracts. The real contracts and the
            multi-chain local demo are in the project repository. Use <b>Reset</b> in the top bar to start over.
          </p>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[["/courier", "Courier", "Mark orders delivered or returned."], ["/seller", "Seller", "One live balance, history and claim."], ["/carrier", "Carrier", "Fund the escrow, watch messages."], ["/admin", "Admin", "Close periods, see carriers."]].map(([h, t, d]) => (
          <Link key={h} href={h} className="card transition hover:border-white/30"><div className="font-bold">{t}</div><div className="text-sm text-slate-400">{d}</div></Link>
        ))}
      </section>
    </div>
  );
}

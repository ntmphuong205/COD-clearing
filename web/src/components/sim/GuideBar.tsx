"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODE } from "@/lib/mode";
import { countdown } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { setWallet, simReset, useSim, type Role } from "@/lib/sim";

const STEPS = ["Deliver", "Close round", "Withdraw"];

/** Sticky "what do I do next" bar for the simulated demo. */
export function GuideBar() {
  const s = useSim();
  const now = useNow();
  const path = usePathname();
  if (MODE !== "sim" || path === "/") return null;

  const delivered = s.msgs.some((m) => m.recorded);
  const closed = s.payouts.length > 0;
  const claimed = s.payouts.some((p) => p.claimed);
  const step = claimed ? 3 : closed ? 2 : delivered ? 1 : 0;
  const open = s.payouts.find((p) => !p.claimed);
  const left = open ? open.claimableAt - now : 0;

  let text: string;
  let cta: { href: string; label: string; role: Role } | null = null;
  if (step === 0) {
    text = "Step 1: you are the delivery driver. Tap “Delivered & paid” on any parcel.";
    if (path !== "/courier") cta = { href: "/courier", label: "Go to Driver", role: "courier" };
  } else if (step === 1) {
    text = "Done! The shop is now owed that money. Step 2: the payment manager closes the round.";
    cta = path === "/admin" ? null : { href: "/admin", label: "Go to Manager", role: "admin" };
  } else if (step === 2) {
    text = left > 0
      ? `Round closed. A short waiting time is running, so withdrawing unlocks in ${countdown(left)}.`
      : "Ready! Step 3: the shop owner withdraws the money.";
    cta = path === "/seller" ? null : { href: "/seller", label: left > 0 ? "See the shop owner" : "Withdraw as shop owner", role: "seller" };
  } else {
    text = "That is the whole flow: delivery, shared record, one payout. 🎉";
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#070b14]/90 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
        <ol className="hidden sm:flex items-center gap-1.5">
          {STEPS.map((t, i) => (
            <li key={t} className="flex items-center gap-1.5">
              <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-extrabold ${i < step ? "bg-emerald-500 text-emerald-950" : i === step ? "bg-brand text-white" : "bg-white/10 text-slate-400"}`}>
                {i < step ? "✓" : i + 1}
              </span>
              <span className={`text-xs font-semibold ${i === step ? "text-white" : "text-slate-500"}`}>{t}</span>
              {i < STEPS.length - 1 && <span className="mx-1 h-px w-4 bg-white/15" />}
            </li>
          ))}
        </ol>
        <p className="flex-1 text-sm font-semibold text-slate-200">
          <span className="sm:hidden mr-1 text-brand">Step {Math.min(step + 1, 3)}/3 ·</span>{text}
        </p>
        {cta && <Link href={cta.href} onClick={() => setWallet(cta!.role)} className="btn-primary whitespace-nowrap px-4 py-2 text-sm">{cta.label} →</Link>}
        {step === 3 && <button className="btn-ghost whitespace-nowrap px-4 py-2 text-sm" onClick={simReset}>Replay</button>}
      </div>
    </div>
  );
}

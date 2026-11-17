import Link from "next/link";
import { MODE } from "@/lib/mode";
import { SimGuide } from "@/components/sim/SimPages";

const PAGES = [
  ["/courier", "Courier", "Mark orders Delivered & paid or Returned from a phone."],
  ["/seller", "Seller", "One live balance across all carriers, history, and claim."],
  ["/carrier", "Carrier", "Fund the escrow and watch messages reach the hub."],
  ["/admin", "Admin", "Close the period and see registered carriers."],
];

export default function Home() {
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-extrabold">COD Clearing</h1>
      <p className="text-lg">
        Online sellers in Vietnam ship with several carriers, and each carrier collects cash on delivery and pays out later on its
        own schedule. COD Clearing gives everyone one shared, verifiable number: when a courier marks an order delivered or returned
        on the carrier&apos;s own Avalanche L1, a small cross-chain message updates the seller&apos;s net balance on a hub contract. At
        the end of a period the seller claims one payout in USDC. No buyer personal data is ever on-chain.
      </p>
      {MODE === "sim" && <SimGuide />}
      <ul className="grid sm:grid-cols-2 gap-3">
        {PAGES.map(([h, t, d]) => (
          <li key={h}><Link href={h} className="card block hover:border-neutral-950"><div className="font-bold text-lg">{t}</div><div className="text-sm text-neutral-700">{d}</div></Link></li>
        ))}
      </ul>
    </div>
  );
}

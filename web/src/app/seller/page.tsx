"use client";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { parseAbiItem, type Address, type Hex } from "viem";
import { MODE, useApp } from "@/lib/app";
import { SimSeller } from "@/components/sim/SimPages";
import { hubAbi } from "@/lib/abi";
import { countdown, short, usdc, usdcFromVnd, vnd, when } from "@/lib/format";
import { useSend } from "@/lib/useSend";
import { useNow } from "@/lib/useNow";
import { ConnectBar } from "@/components/ConnectBar";
import { TxLink } from "@/components/TxLink";

const recorded = parseAbiItem(
  "event SettlementRecorded(uint256 indexed carrierId, address indexed seller, uint64 seq, bytes32 orderKey, uint8 kind, int256 deltaVnd, int256 newBalance)",
);

function ChainSellerPage() {
  const app = useApp();
  const { address } = useAccount();
  const now = useNow();
  const { send, pending, error } = useSend();
  const demoSeller = app.seed?.seller;
  const seller = (address ?? demoSeller) as Address | undefined;
  const hub = app.d.hubChain.hub;

  const data = useQuery({
    queryKey: ["seller", seller],
    enabled: !!seller,
    refetchInterval: 3000,
    queryFn: async () => {
      const c = app.hub.client;
      const read = <T,>(functionName: string, args: unknown[] = []) =>
        c.readContract({ address: hub, abi: hubAbi, functionName, args } as never) as Promise<T>;
      const [balances, rate, epoch] = await Promise.all([
        read<bigint[]>("balancesOf", [seller]), read<bigint>("vndPerUsdc"), read<bigint>("currentEpoch"),
      ]);
      const payouts = [];
      for (let e = 1n; e < epoch; e++) {
        const [pv, pu, claimed] = await read<[bigint[], bigint[], boolean]>("payoutsOf", [e, seller]);
        const [, claimable] = await read<[bigint, bigint, bigint]>("epochInfo", [e]);
        if (pu.some((x) => x > 0n)) payouts.push({ epoch: e, vnd: pv, usdc: pu, claimed, claimableAt: Number(claimable) });
      }
      const logs = await c.getLogs({
        address: hub, event: recorded, args: { seller }, fromBlock: BigInt(app.d.hubChain.fromBlock ?? 0), toBlock: "latest",
      });
      const times = new Map<bigint, number>();
      for (const bn of new Set(logs.map((l) => l.blockNumber!))) {
        times.set(bn, Number((await c.getBlock({ blockNumber: bn })).timestamp));
      }
      const history = logs.map((l) => ({
        carrierId: Number(l.args.carrierId), orderKey: l.args.orderKey as Hex, kind: Number(l.args.kind),
        delta: l.args.deltaVnd as bigint, tx: l.transactionHash, time: times.get(l.blockNumber!) ?? 0, bn: l.blockNumber!,
      })).sort((a, b) => Number(b.bn - a.bn));
      return { balances, rate, payouts, history };
    },
  });

  const rate = data.data?.rate ?? 25000n;
  const total = (data.data?.balances ?? []).reduce((s, b) => s + b, 0n);
  const nameOf = (id: number) => app.carriers.find((c) => c.id === id)?.name ?? `#${id}`;
  const codes = new Map([...(app.seed?.carrierA ?? []), ...(app.seed?.carrierB ?? [])].map((o) => [o.orderKey, o.code]));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">Seller</h1>
      <ConnectBar />
      {!address && demoSeller && <p className="text-sm text-neutral-600">Showing demo seller {short(demoSeller)} (read-only). Connect that wallet to claim.</p>}
      {!seller && <p>Connect your wallet to see your balances.</p>}
      {error && <p className="rounded-lg bg-red-100 border-2 border-red-700 p-3 font-semibold">{error}</p>}

      {seller && (
        <>
          <section className="grid sm:grid-cols-3 gap-3">
            {app.carriers.map((c, i) => {
              const b = data.data?.balances[i] ?? 0n;
              return (
                <div key={c.key} className="card">
                  <div className="text-sm font-semibold text-neutral-600">{c.name}</div>
                  <div className="text-2xl font-extrabold">{vnd(b)}</div>
                  <div className="text-sm">≈ {usdc(usdcFromVnd(b, rate))}</div>
                </div>
              );
            })}
            <div className="card bg-neutral-950 text-white border-neutral-950">
              <div className="text-sm font-semibold text-neutral-300">Total</div>
              <div className="text-2xl font-extrabold">{vnd(total)}</div>
              <div className="text-sm">≈ {usdc(usdcFromVnd(total, rate))}</div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Claimable payouts</h2>
            {data.data?.payouts.length === 0 && <p className="text-neutral-600">None yet. Payouts appear after the admin closes a period.</p>}
            {data.data?.payouts.map((p) => {
              const left = p.claimableAt - now;
              const totalUsdc = p.usdc.reduce((s, x) => s + x, 0n);
              const mine = address && address.toLowerCase() === seller.toLowerCase();
              return (
                <div key={String(p.epoch)} className="card flex items-center justify-between gap-3 mb-2">
                  <div>
                    <div className="font-bold">Period {String(p.epoch)}</div>
                    <div className="text-sm">{p.vnd.map((v, i) => `${app.carriers[i]?.name}: ${vnd(v)}`).join(" · ")}</div>
                    <div className="font-semibold">{usdc(totalUsdc)}</div>
                  </div>
                  {p.claimed ? <span className="font-semibold text-green-800">Claimed</span> : (
                    <button
                      className="btn-ok"
                      disabled={left > 0 || pending || !mine}
                      onClick={async () => { await send(app.hub, { address: hub, abi: hubAbi, functionName: "claim", args: [p.epoch] }); data.refetch(); }}
                    >
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
                  {data.data?.history.map((h) => (
                    <tr key={h.tx + h.orderKey} className="border-b border-neutral-100">
                      <td className="py-1 pr-2">{nameOf(h.carrierId)}</td>
                      <td className="pr-2 font-mono" title={h.orderKey}>{codes.get(h.orderKey) ?? short(h.orderKey)}</td>
                      <td className="pr-2">{h.kind === 1 ? "Delivered" : "Returned"}</td>
                      <td className={`pr-2 text-right font-semibold ${h.delta < 0n ? "text-red-700" : "text-green-800"}`}>{vnd(h.delta)}</td>
                      <td className="pr-2 whitespace-nowrap">{h.time ? when(h.time) : "-"}</td>
                      <td><TxLink hash={h.tx} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.data?.history.length === 0 && <p className="text-neutral-600 py-2">No settlements yet.</p>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default function SellerPage() {
  return MODE === "sim" ? <SimSeller /> : <ChainSellerPage />;
}

"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { parseAbiItem, parseUnits, type Hex } from "viem";
import { MODE, useApp } from "@/lib/app";
import { SimCarrier } from "@/components/sim/SimPages";
import { erc20Abi, escrowAbi, hubAbi } from "@/lib/abi";
import { short, usdc } from "@/lib/format";
import { useSend } from "@/lib/useSend";
import { ConnectBar } from "@/components/ConnectBar";
import { TxLink } from "@/components/TxLink";

const sent = parseAbiItem("event SettlementSent(uint64 indexed seq, bytes32 indexed orderKey, uint8 kind, bytes32 messageId)");

function ChainCarrierPage() {
  const app = useApp();
  const { address } = useAccount();
  const { send, pending, error } = useSend();
  const [ci, setCi] = useState(0);
  const [amount, setAmount] = useState("100");
  const [step, setStep] = useState<string | null>(null);
  const c = app.carriers[ci];
  const usdcAddr = app.d.hubChain.usdc;
  const codes = new Map([...(app.seed?.carrierA ?? []), ...(app.seed?.carrierB ?? [])].map((o) => [o.orderKey, o.code]));

  const escrow = useQuery({
    queryKey: ["escrow", c.key, address],
    refetchInterval: 3000,
    queryFn: async () => {
      const r = (fn: string) => app.hub.client.readContract({ address: c.cc.escrow, abi: escrowAbi, functionName: fn } as never) as Promise<bigint>;
      const [balance, committed, available] = await Promise.all([r("balance"), r("committed"), r("available")]);
      const wallet = address
        ? ((await app.hub.client.readContract({ address: usdcAddr, abi: erc20Abi, functionName: "balanceOf", args: [address] })) as bigint)
        : 0n;
      return { balance, committed, available, wallet };
    },
  });

  const msgs = useQuery({
    queryKey: ["msgs", c.key],
    refetchInterval: 3000,
    queryFn: async () => {
      const logs = await c.client.getLogs({ address: c.cc.ledger, event: sent, fromBlock: 0n, toBlock: "latest" });
      return Promise.all(
        logs.map(async (l) => ({
          seq: l.args.seq as bigint, orderKey: l.args.orderKey as Hex, kind: Number(l.args.kind), tx: l.transactionHash,
          recorded: (await app.hub.client.readContract({
            address: app.d.hubChain.hub, abi: hubAbi, functionName: "processed", args: [BigInt(c.id), l.args.seq as bigint],
          })) as boolean,
        })),
      ).then((r) => r.reverse());
    },
  });

  async function deposit() {
    const amt = parseUnits(amount || "0", 6);
    if (amt === 0n || !address) return;
    setStep("Approving USDC…");
    const allowance = (await app.hub.client.readContract({
      address: usdcAddr, abi: erc20Abi, functionName: "allowance", args: [address, c.cc.escrow],
    })) as bigint;
    if (allowance < amt) {
      const ok = await send(app.hub, { address: usdcAddr, abi: erc20Abi, functionName: "approve", args: [c.cc.escrow, amt] });
      if (!ok) return setStep(null);
    }
    setStep("Depositing…");
    await send(app.hub, { address: c.cc.escrow, abi: escrowAbi, functionName: "deposit", args: [amt] });
    setStep(null);
    escrow.refetch();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">Carrier</h1>
      <div className="grid grid-cols-2 gap-2">
        {app.carriers.map((x, i) => <button key={x.key} onClick={() => setCi(i)} className={i === ci ? "btn-primary" : "btn-ghost"}>{x.name}</button>)}
      </div>
      <ConnectBar hint="Connect the carrier wallet to fund its escrow." />
      {error && <p className="rounded-lg bg-red-100 border-2 border-red-700 p-3 font-semibold">{error}</p>}

      <section className="grid grid-cols-3 gap-3">
        {([["Escrow balance", escrow.data?.balance], ["Committed", escrow.data?.committed], ["Available", escrow.data?.available]] as const).map(([l, v]) => (
          <div key={l} className="card"><div className="text-xs font-semibold text-neutral-600">{l}</div><div className="text-lg font-extrabold">{v === undefined ? "…" : usdc(v)}</div></div>
        ))}
      </section>

      <section className="card space-y-2">
        <h2 className="font-bold">Deposit USDC</h2>
        <p className="text-sm">Wallet balance: {escrow.data ? usdc(escrow.data.wallet) : "…"}</p>
        <div className="flex gap-2">
          <input className="border-2 border-neutral-950 rounded-xl px-3 py-2 w-32 text-lg" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button className="btn-primary" disabled={pending || !address} onClick={deposit}>{pending ? step ?? "Pending…" : "Approve & deposit"}</button>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">Messages sent to the hub</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b-2 border-neutral-200"><th className="py-1">Seq</th><th>Order</th><th>Kind</th><th>Status</th><th>Tx</th></tr></thead>
          <tbody>
            {msgs.data?.map((m) => (
              <tr key={String(m.seq)} className="border-b border-neutral-100">
                <td className="py-1">{String(m.seq)}</td>
                <td className="font-mono" title={m.orderKey}>{codes.get(m.orderKey) ?? short(m.orderKey)}</td>
                <td>{m.kind === 1 ? "Delivered" : "Returned"}</td>
                <td className={m.recorded ? "text-green-800 font-semibold" : "text-orange-700 font-semibold"}>{m.recorded ? "recorded on hub" : "sent"}</td>
                <td><TxLink hash={m.tx} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {msgs.data?.length === 0 && <p className="text-neutral-600 py-2">No messages yet.</p>}
      </section>
    </div>
  );
}

export default function CarrierPage() {
  return MODE === "sim" ? <SimCarrier /> : <ChainCarrierPage />;
}

"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import type { Hex } from "viem";
import { MODE, useApp } from "@/lib/app";
import { SimCourier } from "@/components/sim/SimPages";
import { ledgerAbi } from "@/lib/abi";
import { vnd, short } from "@/lib/format";
import { STATUS_LABEL, Status } from "@/lib/types";
import { useSend } from "@/lib/useSend";
import { ConnectBar } from "@/components/ConnectBar";
import { TxLink } from "@/components/TxLink";

type Action = "pickup" | "delivered" | "returned";
const FN: Record<Action, string> = { pickup: "markPickedUp", delivered: "markDelivered", returned: "markReturned" };
const LABEL: Record<Action, string> = { pickup: "Picked up", delivered: "Delivered & paid", returned: "Returned" };

function ChainCourierPage() {
  const app = useApp();
  const { address } = useAccount();
  const [ci, setCi] = useState(0);
  const [confirm, setConfirm] = useState<{ key: Hex; action: Action } | null>(null);
  const [busyKey, setBusyKey] = useState<Hex | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const { send, error } = useSend();
  const c = app.carriers[ci];
  const codes = new Map([...(app.seed?.carrierA ?? []), ...(app.seed?.carrierB ?? [])].map((o) => [o.orderKey, o.code]));

  const orders = useQuery({
    queryKey: ["courier-orders", c.key, address],
    enabled: !!address,
    refetchInterval: 3000,
    queryFn: async () => {
      const keys = (await c.client.readContract({ address: c.cc.ledger, abi: ledgerAbi, functionName: "ordersOfCourier", args: [address!] })) as Hex[];
      return Promise.all(
        keys.map(async (key) => ({
          key,
          o: await c.client.readContract({ address: c.cc.ledger, abi: ledgerAbi, functionName: "getOrder", args: [key] }),
        })),
      );
    },
  });

  async function run(key: Hex, action: Action) {
    setConfirm(null);
    setBusyKey(key);
    const hash = await send(c, { address: c.cc.ledger, abi: ledgerAbi, functionName: FN[action], args: [key] });
    if (hash) setLastTx(hash);
    setBusyKey(null);
    orders.refetch();
  }

  const list = (orders.data ?? []).slice().sort((a, b) => Number(a.o.status >= 3) - Number(b.o.status >= 3));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Courier</h1>
      <div className="grid grid-cols-2 gap-2">
        {app.carriers.map((x, i) => (
          <button key={x.key} onClick={() => setCi(i)} className={i === ci ? "btn-primary" : "btn-ghost"}>{x.name}</button>
        ))}
      </div>
      <ConnectBar hint="Connect the courier wallet assigned to these orders." />
      {lastTx && <p className="text-sm">Last confirmed tx: <TxLink hash={lastTx} /></p>}
      {error && <p className="rounded-lg bg-red-100 border-2 border-red-700 p-3 font-semibold">{error}</p>}
      {address && orders.isLoading && <p>Loading orders…</p>}
      {address && orders.data && list.length === 0 && <p>No orders assigned to this wallet at {c.name}.</p>}

      <ul className="space-y-3">
        {list.map(({ key, o }) => {
          const busy = busyKey === key;
          const done = o.status >= Status.Delivered;
          const code = codes.get(key) ?? short(key);
          const isConfirming = confirm?.key === key;
          return (
            <li key={key} className={`card ${done ? "opacity-70" : "border-neutral-950"}`}>
              <div className="flex justify-between items-baseline">
                <span className="text-xl font-extrabold">{code}</span>
                <span className="font-semibold">{STATUS_LABEL[o.status]}</span>
              </div>
              <p className="text-lg mt-1">Collect <b>{vnd(o.codVnd)}</b></p>

              {busy && <p className="mt-3 text-lg font-bold animate-pulse">Pending… confirm in wallet, then wait for the block</p>}

              {!busy && !isConfirming && o.status === Status.Created && (
                <button className="btn-primary w-full mt-3 py-5 text-xl" onClick={() => setConfirm({ key, action: "pickup" })}>Picked up</button>
              )}
              {!busy && !isConfirming && o.status === Status.PickedUp && (
                <div className="grid grid-cols-1 gap-3 mt-3">
                  <button className="btn-ok py-6 text-2xl" onClick={() => setConfirm({ key, action: "delivered" })}>Delivered &amp; paid</button>
                  <button className="btn-warn py-5 text-xl" onClick={() => setConfirm({ key, action: "returned" })}>Returned</button>
                </div>
              )}
              {!busy && isConfirming && (
                <div className="mt-3 rounded-xl border-2 border-neutral-950 p-3">
                  <p className="text-lg font-bold">Confirm: {LABEL[confirm.action]}?</p>
                  <p className="text-sm text-neutral-700">This is sent to the carrier ledger and cannot be undone.</p>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <button className="btn-ghost py-4" onClick={() => setConfirm(null)}>Cancel</button>
                    <button className={`${confirm.action === "returned" ? "btn-warn" : "btn-ok"} py-4`} onClick={() => run(key, confirm.action)}>Confirm</button>
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

export default function CourierPage() {
  return MODE === "sim" ? <SimCourier /> : <ChainCourierPage />;
}

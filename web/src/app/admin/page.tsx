"use client";
import { useQuery } from "@tanstack/react-query";
import { MODE, useApp } from "@/lib/app";
import { SimAdmin } from "@/components/sim/SimPages";
import { hubAbi } from "@/lib/abi";
import { countdown, short } from "@/lib/format";
import { useSend } from "@/lib/useSend";
import { useNow } from "@/lib/useNow";
import { ConnectBar } from "@/components/ConnectBar";
import { TxLink } from "@/components/TxLink";
import { useState } from "react";

type CarrierRow = { sourceBlockchainID: string; ledger: string; escrow: string; name: string };

function ChainAdminPage() {
  const app = useApp();
  const now = useNow();
  const { send, pending, error } = useSend();
  const [lastTx, setLastTx] = useState<string | null>(null);
  const hub = app.d.hubChain.hub;

  const info = useQuery({
    queryKey: ["admin"],
    refetchInterval: 3000,
    queryFn: async () => {
      const c = app.hub.client;
      const read = <T,>(functionName: string, args: unknown[] = []) =>
        c.readContract({ address: hub, abi: hubAbi, functionName, args } as never) as Promise<T>;
      const [epoch, window, rate, carriers] = await Promise.all([
        read<bigint>("currentEpoch"), read<bigint>("disputeWindow"), read<bigint>("vndPerUsdc"), read<CarrierRow[]>("getCarriers"),
      ]);
      const prev = epoch > 1n ? await read<[bigint, bigint, bigint]>("epochInfo", [epoch - 1n]) : null;
      return { epoch, window, rate, carriers, prevClaimableAt: prev ? Number(prev[1]) : 0 };
    },
  });
  const d = info.data;
  const left = d ? d.prevClaimableAt - now : 0;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">Admin</h1>
      <ConnectBar hint="Connect the hub owner wallet to close a period." />
      {error && <p className="rounded-lg bg-red-100 border-2 border-red-700 p-3 font-semibold">{error}</p>}

      <section className="card space-y-2">
        <div className="text-sm text-neutral-600">Current period</div>
        <div className="text-3xl font-extrabold">{d ? String(d.epoch) : "…"}</div>
        <div className="text-sm">Dispute window {d ? `${d.window} s` : "…"} · rate {d ? `${d.rate.toLocaleString("vi-VN")} VND = 1 USDC` : "…"}</div>
        <button
          className="btn-primary"
          disabled={pending || !d}
          onClick={async () => { setLastTx(await send(app.hub, { address: hub, abi: hubAbi, functionName: "closeEpoch" })); info.refetch(); }}
        >
          {pending ? "Pending…" : "Close period"}
        </button>
        {lastTx && <p className="text-sm">Tx: <TxLink hash={lastTx} /></p>}
        {d && d.epoch > 1n && (
          <p className="font-semibold">
            Period {String(d.epoch - 1n)}: {left > 0 ? `dispute window open, claims in ${countdown(left)}` : "claims are open"}
          </p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">Registered carriers</h2>
        <ul className="space-y-2">
          {d?.carriers.map((c, i) => (
            <li key={c.ledger + i} className="card text-sm">
              <div className="font-bold text-base">#{i + 1} {c.name}</div>
              <div>Ledger <span className="font-mono">{short(c.ledger)}</span> · Escrow <span className="font-mono">{short(c.escrow)}</span></div>
              <div>Source chain <span className="font-mono">{short(c.sourceBlockchainID)}</span></div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function AdminPage() {
  return MODE === "sim" ? <SimAdmin /> : <ChainAdminPage />;
}

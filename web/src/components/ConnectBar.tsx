"use client";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { short } from "@/lib/format";

export function ConnectBar({ hint }: { hint?: string }) {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  if (isConnected && address) {
    return (
      <div className="flex items-center justify-between gap-2 text-sm">
        <span>Wallet <b>{short(address)}</b></span>
        <button className="underline" onClick={() => disconnect()}>Disconnect</button>
      </div>
    );
  }
  return (
    <div>
      <button className="btn-primary w-full" disabled={isPending} onClick={() => connect({ connector: connectors[0] })}>
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
      {hint && <p className="text-sm text-neutral-600 mt-2">{hint}</p>}
      {error && <p className="text-sm text-red-700 mt-2">{error.message.split("\n")[0]}</p>}
    </div>
  );
}

"use client";
import { useState } from "react";
import { useAccount, useSwitchChain, useWriteContract } from "wagmi";
import type { Abi, Address } from "viem";
import type { ChainInfo } from "./app";

type Call = { address: Address; abi: Abi; functionName: string; args?: readonly unknown[] };

/** Switches the wallet to the right chain, sends the tx, waits for the receipt. */
export function useSend() {
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(info: ChainInfo, call: Call): Promise<string | null> {
    setPending(true);
    setError(null);
    try {
      if (chainId !== info.chain.id) await switchChainAsync({ chainId: info.chain.id });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hash = await writeContractAsync({ ...(call as any), chainId: info.chain.id });
      await info.client.waitForTransactionReceipt({ hash });
      return hash;
    } catch (e) {
      const err = e as { shortMessage?: string; message: string };
      setError(err.shortMessage ?? err.message.split("\n")[0]);
      return null;
    } finally {
      setPending(false);
    }
  }
  return { send, pending, error };
}

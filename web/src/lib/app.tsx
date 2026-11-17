"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { createPublicClient, defineChain, type Chain, type PublicClient } from "viem";
import type { CarrierCfg, ChainCfg, Deployment, Seed } from "./types";

import { MODE } from "./mode";
export { MODE };

export type ChainInfo = { key: string; name: string; cfg: ChainCfg; chain: Chain; client: PublicClient };
export type CarrierInfo = ChainInfo & { id: number; cc: CarrierCfg };
export type App = {
  d: Deployment;
  seed: Seed | null;
  hub: ChainInfo;
  carriers: CarrierInfo[];
  txUrl: (hash: string) => string | null;
};

const Ctx = createContext<App | null>(null);
export const useApp = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("outside provider");
  return v;
};

function mkChain(cfg: ChainCfg, name: string): Chain {
  return defineChain({
    id: cfg.chainId, name,
    nativeCurrency: { name: "Gas", symbol: "GAS", decimals: 18 },
    rpcUrls: { default: { http: [cfg.rpc] } },
    blockExplorers: cfg.explorer ? { default: { name: "Explorer", url: cfg.explorer } } : undefined,
  });
}
function mkInfo(key: string, name: string, cfg: ChainCfg): ChainInfo {
  const chain = mkChain(cfg, name);
  return { key, name, cfg, chain, client: createPublicClient({ chain, transport: http(cfg.rpc) }) as PublicClient };
}

/** In sim mode there is no chain and no wallet, so the chain providers are skipped entirely. */
export function Providers({ children }: { children: ReactNode }) {
  return MODE === "sim" ? <>{children}</> : <ChainProviders>{children}</ChainProviders>;
}

function ChainProviders({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ d: Deployment; seed: Seed | null } | { error: string } | null>(null);
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } }));

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/deployments/${MODE}.json`, { cache: "no-store" });
        if (!r.ok) throw new Error(`deployments/${MODE}.json not found`);
        const d = (await r.json()) as Deployment;
        const s = await fetch(`/deployments/seed-${MODE}.json`, { cache: "no-store" }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
        setState({ d, seed: s });
      } catch (e) {
        setState({ error: (e as Error).message });
      }
    })();
  }, []);

  const app = useMemo<App | null>(() => {
    if (!state || "error" in state) return null;
    const { d, seed } = state;
    const hub = mkInfo("hub", MODE === "fuji" ? "Fuji C-Chain" : "Hub (local)", d.hubChain);
    const carriers: CarrierInfo[] = [
      { ...mkInfo("carrierA", d.carrierA.name, d.carrierA), id: d.carrierA.carrierId, cc: d.carrierA },
      { ...mkInfo("carrierB", d.carrierB.name, d.carrierB), id: d.carrierB.carrierId, cc: d.carrierB },
    ];
    return { d, seed, hub, carriers, txUrl: (h) => (d.explorer ? `${d.explorer}/tx/${h}` : null) };
  }, [state]);

  const wagmi = useMemo(() => {
    if (!app) return null;
    const chains = [app.hub.chain, ...app.carriers.map((c) => c.chain)] as [Chain, ...Chain[]];
    return createConfig({
      chains,
      connectors: [injected()],
      transports: Object.fromEntries(
        [app.hub, ...app.carriers].map((c) => [c.chain.id, http(c.cfg.rpc)]),
      ) as Record<number, ReturnType<typeof http>>,
      ssr: false,
    });
  }, [app]);

  if (state && "error" in state) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <h1 className="text-xl font-bold">Not deployed yet</h1>
        <p className="mt-2">{state.error}. Start the local demo with <code>pnpm demo:local</code> (or deploy to Fuji), then reload.</p>
      </div>
    );
  }
  if (!app || !wagmi) return <div className="p-6">Loading…</div>;
  return (
    <QueryClientProvider client={qc}>
      <WagmiProvider config={wagmi}>
        <Ctx.Provider value={app}>{children}</Ctx.Provider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}

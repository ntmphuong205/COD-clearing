import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient, createWalletClient, defineChain, http, keccak256, toHex,
  type Abi, type Address, type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
try { process.loadEnvFile(resolve(ROOT, ".env")); } catch { /* no .env: fine for local mode */ }

export type ChainCfg = { rpc: string; chainId: number; blockchainId: Hex };
export type Deployment = {
  mode: "local" | "fuji";
  explorer: string;
  hubChain: ChainCfg & { messenger: Address; usdc: Address; hub: Address };
  carrierA: ChainCfg & { name: string; messenger: Address; ledger: Address; escrow: Address; carrierId: number };
  carrierB: ChainCfg & { name: string; messenger: Address; ledger: Address; escrow: Address; carrierId: number };
};

export function loadDeployment(mode = process.env.MODE ?? "local"): Deployment {
  const p = resolve(ROOT, `deployments/${mode}.json`);
  if (!existsSync(p)) throw new Error(`missing ${p}; deploy first`);
  return JSON.parse(readFileSync(p, "utf8"));
}

/** ABI from forge build output (run `forge build` first). */
export function abi(name: string): Abi {
  const p = resolve(ROOT, `contracts/out/${name}.sol/${name}.json`);
  return JSON.parse(readFileSync(p, "utf8")).abi;
}

export function chainOf(c: ChainCfg, name: string) {
  return defineChain({
    id: c.chainId, name,
    nativeCurrency: { name: "Gas", symbol: "GAS", decimals: 18 },
    rpcUrls: { default: { http: [c.rpc] } },
  });
}

export function clients(c: ChainCfg, name: string, key?: Hex) {
  const chain = chainOf(c, name);
  const pub = createPublicClient({ chain, transport: http(c.rpc) });
  const wallet = key
    ? createWalletClient({ chain, transport: http(c.rpc), account: privateKeyToAccount(key) })
    : undefined;
  return { chain, pub, wallet };
}

/** Public Anvil dev keys. Local mode only. */
export const ANVIL = {
  admin: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  courier: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  carrierA: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  carrierB: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  seller: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  relayer: "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6",
} as const satisfies Record<string, Hex>;

export const addr = (k: Hex) => privateKeyToAccount(k).address;
export const orderKey = (code: string): Hex => keccak256(toHex(code));
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

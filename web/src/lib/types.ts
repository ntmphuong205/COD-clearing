import type { Address, Hex } from "viem";

export type ChainCfg = { rpc: string; chainId: number; blockchainId: Hex; explorer?: string };
export type CarrierCfg = ChainCfg & { name: string; messenger: Address; ledger: Address; escrow: Address; carrierId: number };
export type Deployment = {
  mode: "local" | "fuji";
  explorer: string;
  hubChain: ChainCfg & { messenger: Address; usdc: Address; hub: Address; fromBlock?: number };
  carrierA: CarrierCfg;
  carrierB: CarrierCfg;
};
export type SeedOrder = { code: string; orderKey: Hex; willReturn: boolean };
export type Seed = { seller: Address; courier: Address; carrierA: SeedOrder[]; carrierB: SeedOrder[] };

export const Status = { None: 0, Created: 1, PickedUp: 2, Delivered: 3, Returned: 4 } as const;
export const STATUS_LABEL = ["-", "Created", "Picked up", "Delivered", "Returned"];

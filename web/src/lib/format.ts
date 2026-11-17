import type { Hex } from "viem";

const nf = new Intl.NumberFormat("vi-VN");
export const vnd = (n: bigint | number) => `${nf.format(n)} ₫`;
export const usdcFromVnd = (v: bigint, rate: bigint) => (rate === 0n ? 0n : (v * 1_000_000n) / rate);
export const usdc = (micro: bigint) => `${(Number(micro) / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
export const short = (h: Hex | string) => `${h.slice(0, 8)}…${h.slice(-4)}`;
export const when = (ts: number) => new Date(ts * 1000).toLocaleString("vi-VN");
export const countdown = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

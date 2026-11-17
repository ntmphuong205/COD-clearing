"use client";
import { useSyncExternalStore } from "react";

// In-browser simulation of the COD Clearing flow (same rules as the contracts, no chain, no wallet).
// Rules mirrored from the local demo: DELIVERED = +cod - codFee, RETURNED = -returnFee,
// closeEpoch pays positive balances in USDC at a fixed rate, claim opens after a dispute window.

export const SIM_RATE = 25_000; // VND per USDC
export const SIM_WINDOW = 60; // seconds
export const CARRIER_NAMES = ["Carrier A", "Carrier B"];
const PREFIX = ["GHA", "GHB"];
const KEY = "cod-clearing-sim-v1";

export type SimOrder = { code: string; carrier: number; cod: number; codFee: number; returnFee: number; status: 2 | 3 | 4 };
export type SimHist = { carrier: number; code: string; kind: 1 | 2; delta: number; tx: string; time: number };
export type SimMsg = { carrier: number; seq: number; code: string; kind: 1 | 2; tx: string; recorded: boolean; delta: number; time: number };
export type SimPayout = { epoch: number; vnd: number[]; usdc: number[]; claimed: boolean; claimableAt: number };
export type SimState = {
  orders: SimOrder[];
  balances: number[];
  history: SimHist[];
  msgs: SimMsg[];
  seq: number[];
  epoch: number;
  payouts: SimPayout[];
  escrow: { balance: number; committed: number }[];
  sellerUsdc: number;
  carrierUsdc: number;
  lastClose: number;
};

function initial(): SimState {
  const orders: SimOrder[] = [];
  for (let c = 0; c < 2; c++) {
    for (let i = 0; i < 9; i++) {
      const cod = (3 + ((i * 7) % 9)) * 100_000;
      orders.push({ code: `${PREFIX[c]}-${String(i + 1).padStart(4, "0")}`, carrier: c, cod, codFee: Math.floor(cod / 100), returnFee: 15_000, status: 2 });
    }
  }
  return {
    orders, balances: [0, 0], history: [], msgs: [], seq: [0, 0], epoch: 1, payouts: [],
    escrow: [{ balance: 500e6, committed: 0 }, { balance: 500e6, committed: 0 }],
    sellerUsdc: 0, carrierUsdc: 10_000e6, lastClose: 0,
  };
}

let state: SimState = initial();
let loaded = false;
const listeners = new Set<() => void>();
const SERVER = initial();

const now = () => Math.floor(Date.now() / 1000);
const fakeHash = () => "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage may be blocked */ }
}
function set(next: SimState) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}
function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw) as SimState;
  } catch { /* ignore broken storage */ }
  // a refresh mid-relay must not leave a message unrecorded forever
  state.msgs.filter((m) => !m.recorded).forEach((m) => finalize(m.carrier, m.seq));
}

function finalize(carrier: number, seq: number) {
  const m = state.msgs.find((x) => x.carrier === carrier && x.seq === seq);
  if (!m || m.recorded) return;
  const balances = state.balances.slice();
  balances[carrier] += m.delta;
  set({
    ...state,
    balances,
    msgs: state.msgs.map((x) => (x === m ? { ...x, recorded: true } : x)),
    history: [{ carrier, code: m.code, kind: m.kind, delta: m.delta, tx: m.tx, time: now() }, ...state.history],
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Courier action. Resolves after the simulated block; the hub is updated a moment later (simulated relayer). */
export async function simCourier(code: string, action: "pickup" | "delivered" | "returned"): Promise<string> {
  await sleep(900);
  const o = state.orders.find((x) => x.code === code)!;
  const status = action === "pickup" ? 2 : action === "delivered" ? 3 : 4;
  const tx = fakeHash();
  if (action === "pickup") {
    set({ ...state, orders: state.orders.map((x) => (x === o ? { ...x, status: 2 } : x)) });
    return tx;
  }
  const seq = state.seq.slice();
  seq[o.carrier] += 1;
  const kind = action === "delivered" ? 1 : 2;
  const delta = action === "delivered" ? o.cod - o.codFee : -o.returnFee;
  set({
    ...state,
    seq,
    orders: state.orders.map((x) => (x === o ? { ...x, status } : x)),
    msgs: [{ carrier: o.carrier, seq: seq[o.carrier], code, kind, tx, recorded: false, delta, time: now() }, ...state.msgs],
  });
  const s = seq[o.carrier];
  setTimeout(() => finalize(o.carrier, s), 1800);
  return tx;
}

export async function simClosePeriod(): Promise<string> {
  await sleep(900);
  const vndAmts = state.balances.map((b) => Math.max(b, 0));
  const usdcAmts = vndAmts.map((v) => Math.floor((v * 1e6) / SIM_RATE));
  const t = now();
  set({
    ...state,
    epoch: state.epoch + 1,
    balances: state.balances.map((b) => Math.min(b, 0)), // negatives carry over
    payouts: [...state.payouts, { epoch: state.epoch, vnd: vndAmts, usdc: usdcAmts, claimed: false, claimableAt: t + SIM_WINDOW }],
    escrow: state.escrow.map((e, i) => ({ ...e, committed: e.committed + usdcAmts[i] })),
    lastClose: t,
  });
  return fakeHash();
}

export async function simClaim(epoch: number): Promise<string> {
  await sleep(900);
  const p = state.payouts.find((x) => x.epoch === epoch)!;
  set({
    ...state,
    payouts: state.payouts.map((x) => (x === p ? { ...x, claimed: true } : x)),
    escrow: state.escrow.map((e, i) => ({ balance: e.balance - p.usdc[i], committed: e.committed - p.usdc[i] })),
    sellerUsdc: state.sellerUsdc + p.usdc.reduce((s, x) => s + x, 0),
  });
  return fakeHash();
}

export async function simDeposit(carrier: number, amountUsdc: number): Promise<string> {
  await sleep(900);
  const micro = Math.round(amountUsdc * 1e6);
  if (micro <= 0 || micro > state.carrierUsdc) throw new Error("Amount exceeds the carrier wallet balance");
  set({
    ...state,
    carrierUsdc: state.carrierUsdc - micro,
    escrow: state.escrow.map((e, i) => (i === carrier ? { ...e, balance: e.balance + micro } : e)),
  });
  return fakeHash();
}

export function simReset() {
  set(initial());
}

function subscribe(l: () => void) {
  load();
  listeners.add(l);
  return () => { listeners.delete(l); };
}
export function getSim(): SimState {
  load();
  return state;
}
export function useSim(): SimState {
  return useSyncExternalStore(subscribe, getSim, () => SERVER);
}

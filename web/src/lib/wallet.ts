"use client";
import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();
const set = (v: boolean) => { open = v; listeners.forEach((l) => l()); };

export const openWalletModal = () => set(true);
export const closeWalletModal = () => set(false);
export function useWalletModal(): boolean {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => open, () => false);
}

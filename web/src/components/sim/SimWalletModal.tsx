"use client";
import { MODE } from "@/lib/mode";
import { WalletModal } from "./Wallet";

export function SimWalletModal() {
  return MODE === "sim" ? <WalletModal /> : null;
}

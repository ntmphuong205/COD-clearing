"use client";
import { useSyncExternalStore } from "react";

export type Toast = { id: number; text: string; kind: "ok" | "info" | "warn" };
let list: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function toast(text: string, kind: Toast["kind"] = "info") {
  const id = nextId++;
  list = [...list, { id, text, kind }].slice(-3);
  notify();
  setTimeout(() => { list = list.filter((t) => t.id !== id); notify(); }, 4200);
}

const EMPTY: Toast[] = [];
export function useToasts(): Toast[] {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => list, () => EMPTY);
}

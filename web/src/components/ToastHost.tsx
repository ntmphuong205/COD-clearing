"use client";
import { useToasts } from "@/lib/toast";

const STYLE = {
  ok: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/40",
  info: "bg-sky-500/15 text-sky-200 ring-sky-400/40",
  warn: "bg-amber-500/15 text-amber-200 ring-amber-400/40",
};

export function ToastHost() {
  const toasts = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-40 flex flex-col items-center gap-2 px-4" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`pop rounded-xl px-4 py-2.5 text-sm font-semibold shadow-lg ring-1 backdrop-blur ${STYLE[t.kind]}`}>{t.text}</div>
      ))}
    </div>
  );
}

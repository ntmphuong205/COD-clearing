"use client";
import { useApp } from "@/lib/app";
import { short } from "@/lib/format";

export function TxLink({ hash, label }: { hash?: string | null; label?: string }) {
  const { txUrl } = useApp();
  if (!hash) return <span>-</span>;
  const url = txUrl(hash);
  const text = label ?? short(hash);
  return url ? <a className="underline text-blue-800" href={url} target="_blank" rel="noreferrer">{text}</a> : <span title="No explorer in local mode">{text}</span>;
}

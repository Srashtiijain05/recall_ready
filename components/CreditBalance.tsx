"use client";

import { useCredits } from "./CreditProvider";

export function dispatchCreditBalanceRefresh() {
  // This function is no longer needed with context
  if (typeof window === "undefined") return;
  // Keep for backward compatibility if needed
}

export default function CreditBalance() {
  const { balance, warning, loading } = useCredits();

  if (loading) {
    return (
      <div className="rounded-2xl bg-[var(--muted)] p-4 text-sm text-[var(--muted-foreground)]">
        Loading credits...
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[var(--muted)] p-4 text-sm text-[var(--foreground)]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">Credits</span>
        <span className="text-lg font-semibold">{balance ?? "--"}</span>
      </div>
      {warning ? (
        <p className="mt-2 text-xs text-amber-500">{warning}</p>
      ) : (
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
          Credits are used for projects, uploads, embeddings, and chat.
        </p>
      )}
    </div>
  );
}

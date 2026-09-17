import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface PendingEntry {
  id: string;
  label: string;
}

interface PendingTransfersContextValue {
  pending: PendingEntry[];
  begin(label: string): string;
  settle(id: string): void;
}

const PendingTransfersContext = createContext<PendingTransfersContextValue | null>(null);

/// Lifted above the tab switch (App.tsx) so a transfer started on the
/// Transfer tab stays visible in the Explorer tab's pending panel (DL-5.3)
/// even though only one tab's component tree is mounted at a time.
/// Optimistic: begin() fires the moment a send starts, settle() fires once
/// the REST call resolves — by then the underlying tx is already confirmed
/// (TransferService awaits the receipt), so this window is the real
/// wall-clock "in flight" period, not a simulated one.
export function PendingTransfersProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingEntry[]>([]);
  const counter = useRef(0);

  const begin = useCallback((label: string) => {
    const id = `p${counter.current++}`;
    setPending((prev) => [...prev, { id, label }]);
    return id;
  }, []);

  const settle = useCallback((id: string) => {
    setPending((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return <PendingTransfersContext.Provider value={{ pending, begin, settle }}>{children}</PendingTransfersContext.Provider>;
}

export function usePendingTransfers(): PendingTransfersContextValue {
  const ctx = useContext(PendingTransfersContext);
  if (!ctx) throw new Error("usePendingTransfers must be used within PendingTransfersProvider");
  return ctx;
}

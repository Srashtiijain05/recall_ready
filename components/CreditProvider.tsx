"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface CreditContextType {
  balance: number | null;
  warning: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const CreditContext = createContext<CreditContextType | undefined>(undefined);

export function useCredits() {
  const context = useContext(CreditContext);
  if (!context) {
    throw new Error("useCredits must be used within CreditProvider");
  }
  return context;
}

export function CreditProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBalance = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/credits?t=${Date.now()}`);
      if (!res.ok) throw new Error("Unable to load credits");
      const data = await res.json();
      setBalance(data?.data?.balance ?? null);
      setWarning(data?.data?.warning ?? null);
    } catch (error) {
      console.error("Failed to load credit balance", error);
      setBalance(null);
      setWarning(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  const refresh = async () => {
    // Wait a moment for server-side changes to commit
    await new Promise(resolve => setTimeout(resolve, 500));
    await fetchBalance();
  };

  return (
    <CreditContext.Provider value={{ balance, warning, loading, refresh }}>
      {children}
    </CreditContext.Provider>
  );
}
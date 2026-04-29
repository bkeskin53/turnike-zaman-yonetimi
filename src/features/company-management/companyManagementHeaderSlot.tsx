"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type CompanyManagementHeaderSlotContextValue = {
  slot: ReactNode | null;
  setSlot: (slot: ReactNode | null) => void;
};

const CompanyManagementHeaderSlotContext =
  createContext<CompanyManagementHeaderSlotContextValue | null>(null);

export function CompanyManagementHeaderSlotProvider(props: {
  children: ReactNode;
}) {
  const [slot, setSlot] = useState<ReactNode | null>(null);

  const value = useMemo(
    () => ({
      slot,
      setSlot,
    }),
    [slot],
  );

  return (
    <CompanyManagementHeaderSlotContext.Provider value={value}>
      {props.children}
    </CompanyManagementHeaderSlotContext.Provider>
  );
}

export function CompanyManagementHeaderSlotOutlet() {
  const ctx = useContext(CompanyManagementHeaderSlotContext);
  return <>{ctx?.slot ?? null}</>;
}

export function useCompanyManagementHeaderSlot() {
  const ctx = useContext(CompanyManagementHeaderSlotContext);
  if (!ctx) {
    throw new Error("COMPANY_MANAGEMENT_HEADER_SLOT_PROVIDER_MISSING");
  }
  return ctx.setSlot;
}
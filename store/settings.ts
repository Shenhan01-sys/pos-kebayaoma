"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Settings {
  storeName: string;
  address: string;
  phone: string;
  taxRate: number; // percent
  printerType: "escpos-bluetooth" | "browser" | "cloud";
  cashierName: string;
}

interface SettingsState extends Settings {
  update: (patch: Partial<Settings>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      storeName: "Kebaya Oma",
      address: "Jl. Sudirman No. 123, Jakarta",
      phone: "021-1234-5678",
      taxRate: 12,
      printerType: "escpos-bluetooth",
      cashierName: "Ani",
      update: (patch) => set(patch),
    }),
    { name: "kebaya-oma-settings" }
  )
);
